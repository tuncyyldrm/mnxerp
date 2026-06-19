import { NextResponse } from 'next/server';
import * as sql from 'mssql';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    const aramaRaw = searchParams.get('search')?.trim().toUpperCase() || '';
    const grubu = searchParams.get('grubu')?.trim() || '';
    const kategori = searchParams.get('kategori')?.trim() || '';
    const tipi = searchParams.get('tipi')?.trim() || '';
    
    const limit = 24;
    const sayfa = Math.max(1, parseInt(searchParams.get('sayfa') || '1'));
    const offset = (sayfa - 1) * limit;

    try {
        const pool = await getDbConnection();
        const req = pool.request();

        req.input('offset', sql.Int, Number(offset));
        req.input('limit', sql.Int, Number(limit));

        let filterSql = " WHERE 1=1 "; 
        let relevanceSql = "10 AS relevance"; 

        if (aramaRaw) {
            req.input('exact', sql.NVarChar, aramaRaw);
            req.input('startSearch', sql.NVarChar, `${aramaRaw}%`);

            // Gelişmiş Kelime Ayrıştırma: Boşluklara göre ayırıyoruz
            const kelimeler = aramaRaw.split(/\s+/).filter(k => k.length > 0);
            
            let searchConditions: string[] = [];

            // 1. ÖNCELİK (Tam Eşleşme Skoru İçin): Eğer ürün kodu veya OEM direkt eşleşiyorsa paranteze başla
            let exactCondition = `(urunkodu = @exact OR OEM = @exact OR urunkodu LIKE @startSearch OR OEM LIKE @startSearch)`;
            
            // 2. B2B AKILLI ARAMA ALGORİTMASI: 
            // Her kelime (opel, kapı, soket, arka) kendi içinde bir 'OR' bloğudur 
            // ama bu bloklar birbirine 'AND' ile bağlanır. Böylece sıra bağımsız her kelime aranır.
            let wordConditions: string[] = [];
            
            kelimeler.forEach((kelime, index) => {
                const paramName = `p${index}`;
                req.input(paramName, sql.NVarChar, `%${kelime}%`);

                // View'da NULL olan OEM_5 ile OEM_9 arasını buraya yazmıyoruz ki SQL hata verip boş dönmesin.
                wordConditions.push(`(
                    urun      LIKE @${paramName} OR 
                    urunalt   LIKE @${paramName} OR 
                    urunkodu  LIKE @${paramName} OR 
                    OEM       LIKE @${paramName} OR 
                    OEM_0 LIKE @${paramName} OR OEM_1 LIKE @${paramName} OR 
                    OEM_2 LIKE @${paramName} OR OEM_3 LIKE @${paramName} OR 
                    OEM_4 LIKE @${paramName}
                )`);
            });

            // Kelimelerin tümünün satırda geçmesini zorunlu kılıyoruz (AND ile birleştirme)
            if (wordConditions.length > 0) {
                // Hem tam eşleşme kontrolünü hem de kelime kombinasyonlarını tek potada eritiyoruz
                filterSql += ` AND ( ${exactCondition} OR ( ${wordConditions.join(' AND ')} ) ) `;
            } else {
                filterSql += ` AND ${exactCondition} `;
            }

            // Alaka düzeyi puanlaması (Sıralamayı en kusursuz hale getirmek için optimize edildi)
            relevanceSql = `
                CASE 
                    WHEN urunkodu = @exact THEN 1000
                    WHEN OEM = @exact THEN 900
                    WHEN urunkodu LIKE @startSearch THEN 500
                    WHEN urun LIKE @startSearch THEN 400
                    WHEN urunalt LIKE @startSearch THEN 300
                    ELSE 10 
                END AS relevance
            `;
        }

        // Sabit Filtreler
        if (grubu) { req.input('grubu', sql.NVarChar, grubu); filterSql += ` AND grubu = @grubu`; }
        if (kategori) { req.input('kategori', sql.NVarChar, kategori); filterSql += ` AND kateGOri = @kategori`; }
        if (tipi) { req.input('tipi', sql.NVarChar, tipi); filterSql += ` AND tipi = @tipi`; }

        const mainQuery = `
            SELECT 
                urunkodu, urun, urunalt, ureticifirma, 
                grubu, kateGOri, tipi, Raf, fiyatı, 
                OEM, STK_FULL, OEM_0, OEM_1, OEM_2, OEM_3, OEM_4,
                OEM_5, OEM_6, OEM_7, OEM_8, OEM_9,
                MevcutBakiye,
                ${relevanceSql},
                COUNT(*) OVER() AS TotalRecords
            FROM [dbo].[vw_StokListesi] WITH (NOLOCK)
            ${filterSql}
            ORDER BY 
                relevance DESC,
                urunkodu ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await req.query(mainQuery);

        const totalRecords = (result.recordset && result.recordset.length > 0) 
            ? result.recordset[0].TotalRecords 
            : 0;

        // Ön yüz yapını asla bozmamak için TotalRecords alanını gizleyip saf array üretiyoruz
        const data = result.recordset.map(row => {
            const { TotalRecords, ...rest } = row;
            return rest;
        });

        // ÇIKTI FORMATI DEĞİŞMEDİ: Ön yüzün doğrudan okuduğu saf dizi ([]) formatı döndürülüyor.
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, must-revalidate',
                // Sayfalama ihtiyacın için veriler arka planda Header'da akmaya devam eder.
                'X-Total-Count': totalRecords.toString(),
                'X-Total-Pages': Math.ceil(totalRecords / limit).toString()
            }
        });

    } catch (err: any) {
        console.error("API Hatası Detayı:", err.message);
        return NextResponse.json({ 
            error: "Sunucu hatası", 
            details: err.message 
        }, { status: 500 });
    }
}