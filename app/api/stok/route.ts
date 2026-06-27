import { NextResponse } from 'next/server';
import * as sql from 'mssql';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    const aramaRaw = searchParams.get('search')?.trim().toLocaleUpperCase('tr-TR') || '';
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
            req.input('exact', sql.VarChar, aramaRaw);
            req.input('startSearch', sql.VarChar, `${aramaRaw}%`);

            const temizArama = aramaRaw.replace(/-/g, ' ');
            const akilliArama = temizArama.replace(/([A-Z]+)([0-9]+)/g, '$1 $2').replace(/([0-9]+)([A-Z]+)/g, '$1 $2');
            const anaKelimeler = Array.from(new Set([...aramaRaw.split(/\s+/), ...akilliArama.split(/\s+/)])).filter(k => k.length > 0);

            const turkceToIngilizce = (text: string) => {
                return text
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/İ/g, "I");
            };

            // PERFORMANS: İndekslerin kilitlenmemesi için dinamik COLLATE ifadeleri kaldırıldı.
            let exactCondition = `(urunkodu = @exact OR OEM = @exact OR urunkodu LIKE @startSearch OR OEM LIKE @startSearch)`;
            let anaKelimeBloklari: string[] = [];
            
            anaKelimeler.forEach((anaKelime, anaIndex) => {
                const ingilizceHali = turkceToIngilizce(anaKelime);
                const varyasyonlar = Array.from(new Set([anaKelime, ingilizceHali]));
                let icSubConditions: string[] = [];

                varyasyonlar.forEach((varyasyon, varIndex) => {
                    const paramName = `p_${anaIndex}_${varIndex}`;
                    req.input(paramName, sql.VarChar, `%${varyasyon}%`);

                    icSubConditions.push(`(
                        urun      LIKE @${paramName} OR 
                        urunalt   LIKE @${paramName} OR 
                        urunkodu  LIKE @${paramName} OR 
                        OEM       LIKE @${paramName} OR 
                        OEM_0     LIKE @${paramName} OR 
                        OEM_1     LIKE @${paramName} OR 
                        OEM_2     LIKE @${paramName} OR 
                        OEM_3     LIKE @${paramName}
                    )`);
                });

                if (icSubConditions.length > 0) {
                    anaKelimeBloklari.push(`(${icSubConditions.join(' OR ')})`);
                }
            });

            if (anaKelimeBloklari.length > 0) {
                filterSql += ` AND ( ${exactCondition} OR ( ${anaKelimeBloklari.join(' AND ')} ) ) `;
            } else {
                filterSql += ` AND ${exactCondition} `;
            }

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

        if (grubu) { req.input('grubu', sql.VarChar, grubu); filterSql += ` AND grubu = @grubu`; }
        if (kategori) { req.input('kategori', sql.VarChar, kategori); filterSql += ` AND kateGOri = @kategori`; }
        if (tipi) { req.input('tipi', sql.VarChar, tipi); filterSql += ` AND tipi = @tipi`; }

        // SİHİRLİ DOKUNUŞ: COUNT sorgusunu tamamen uçurduk. 
        // COUNT(1) OVER() ifadesiyle toplam kayıt sayısını tek sorguda mainQuery içinden alıyoruz!
        const mainQuery = `
            SELECT 
                urunkodu, urun, urunalt, ureticifirma, 
                grubu, kateGOri, tipi, Raf, fiyatı, 
                OEM, STK_FULL, 
                OEM_0, OEM_1, OEM_2, OEM_3, OEM_4, OEM_5, OEM_6, OEM_7, OEM_8, OEM_9,
                MevcutBakiye,
                ${relevanceSql},
                COUNT(1) OVER() AS TotalRecords
            FROM [dbo].[vw_StokListesi] WITH (NOEXPAND, NOLOCK)
            ${filterSql}
            ORDER BY 
                relevance DESC,
                urunkodu ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await req.query(mainQuery);
        
        // Eğer hiçbir kayıt yoksa boş dönüyoruz
        if (!result.recordset || result.recordset.length === 0) {
            return NextResponse.json([], {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, must-revalidate',
                    'X-Total-Count': '0',
                    'X-Total-Pages': '0'
                }
            });
        }

        // İlk satırdaki TotalRecords alanından toplam kayıt sayısını güvenle alıyoruz
        const totalRecords = result.recordset[0].TotalRecords || 0;

        return NextResponse.json(result.recordset, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, must-revalidate',
                'X-Total-Count': totalRecords.toString(),
                'X-Total-Pages': Math.ceil(totalRecords / limit).toString()
            }
        });

    } catch (err: any) {
        console.error("API Hatası Detayı:", err.message);
        return NextResponse.json({ error: "Sunucu hatası", details: err.message }, { status: 500 });
    }
}