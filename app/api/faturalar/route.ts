import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const id = searchParams.get('id') || searchParams.get('islemNo');
  const tip = searchParams.get('tip');            
  const baslangic = searchParams.get('baslangic'); 
  const bitis = searchParams.get('bitis');         
  const isFullPageRequest = searchParams.get('fullPage') === 'true';

  try {
    const pool = await getDbConnection();

    // ========================================================
    // 1. DETAY SATIRLARI SORGUSU (Tekil Belge / Fatura Detay)
    // ========================================================
    if (id) {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        return NextResponse.json({ success: false, error: 'Geçersiz İşlem No' }, { status: 400 });
      }

      // Yenilenen vw_FaturaDetayRaporu üzerinden tertemiz alt sorgusuz detay çekimi
      const result = await pool.request()
        .input('IslemNo', numericId) 
        .input('IslemTipi', tip || '') 
        .query(`
          SELECT 
            UrunAdi,
            StokKodu,
            Miktar,
            BirimFiyat,                
            KdvOrani,                    
            KdvTutari,                   
            KdvDahilBirimFiyat,          
            SatirTutarı, 
            Birim,
            CariAdi,
            IslemTipi,
            FaturaTarihi AS IslemTarihi,
            BelgeNo,
            FaturaToplamTutar,
            FaturaNotu,
            CASE 
              WHEN IslemTipi IN ('VRM', 'VRMC', 'VİRMAN') THEN
                CASE WHEN SatirTutarı < 0 THEN 'CIKIS' ELSE 'GIRIS' END
              WHEN IslemTipi IN ('SF', 'PSI', 'GELHE', 'NT', 'BTA') THEN 'GIRIS'
              WHEN IslemTipi IN ('AF', 'GIDHE', 'NÖ', 'BTE', 'KÖ') THEN 'CIKIS'
              ELSE 'GIRIS'
            END AS Yon
          FROM [dbo].[vw_FaturaDetayRaporu]
          WHERE IslemNo = @IslemNo
            ${tip ? 'AND IslemTipi = @IslemTipi' : ''}
        `);
      
      const rows = result.recordset || [];

      if (isFullPageRequest) {
        if (rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Belge detay kaydı bulunamadı.' }, { status: 404 });
        }
        
        const ilkSatir = rows[0];
        return NextResponse.json({
          success: true,
          data: {
            islemNo: numericId,
            cariAdi: ilkSatir.CariAdi || 'Bilinmeyen Cari',
            islemTipi: ilkSatir.IslemTipi || tip || 'BELGE',
            faturaTarihi: ilkSatir.IslemTarihi || new Date().toISOString(),
            belgeNo: ilkSatir.BelgeNo && ilkSatir.BelgeNo !== '-' ? ilkSatir.BelgeNo : 'Yok',
            faturaToplamTutar: Number(ilkSatir.FaturaToplamTutar || rows.reduce((acc: number, curr: any) => acc + (curr.SatirTutarı || 0), 0)),
            faturaNotu: ilkSatir.FaturaNotu || '',
            satirlar: rows.map((row: any, idx: number) => ({
              satirId: idx + 1,
              urunAdi: row.UrunAdi || 'Tanımsız Ürün',
              stokKodu: row.StokKodu || '-',
              birim: row.Birim || 'ADET',
              miktar: Number(row.Miktar || 0),
              birimFiyat: Number(row.BirimFiyat || 0),
              kdvOrani: Number(row.KdvOrani || 0),
              kdvTutari: Number(row.KdvTutari || 0),
              kdvDahilBirimFiyat: Number(row.KdvDahilBirimFiyat || 0),
              satirTutari: Number(row.SatirTutarı || 0),
              yon: row.Yon
            }))
          }
        });
      }

      return NextResponse.json(rows);
    } 
    
    // ========================================================
    // 2. ANA FATURA LİSTESİ SORGUSU (Çoklu Satır Listeleme)
    // ========================================================
    else {
      let queryStr = `
        SELECT 
          IslemNo,
          MAX(CariAdi) AS CariAdi,
          IslemTipi,
          FaturaTarihi AS Tarih,
          MAX(FaturaToplamTutar) AS ToplamTutar, 
          MAX(FaturaNotu) AS IslemNotu,
          MAX(BelgeNo) AS BelgeNo,
          CASE 
            WHEN IslemTipi IN ('VRM', 'VRMC', 'VİRMAN') THEN 'TRANSFER'
            WHEN IslemTipi IN ('SF', 'PSI', 'GELHE', 'NT') THEN 'GIRIS'
            ELSE 'CIKIS'
          END AS Yon
        FROM [dbo].[vw_FaturaDetayRaporu]
        WHERE 1=1
      `;

      const req = pool.request();

      if (baslangic) {
        queryStr += ` AND FaturaTarihi >= @baslangic`;
        req.input('baslangic', baslangic);
      }
      if (bitis) {
        queryStr += ` AND FaturaTarihi <= DATEADD(day, 1, CAST(@bitis AS DATETIME))`;
        req.input('bitis', bitis);
      }

      queryStr += ` 
        GROUP BY 
          IslemNo, 
          IslemTipi, 
          FaturaTarihi
        ORDER BY Tarih DESC
      `;

      const result = await req.query(queryStr);
      
      const mappedRecords = (result.recordset || []).map((fatura: any) => ({
        ...fatura,
        Id: `${fatura.IslemTipi?.trim().toUpperCase()}-${fatura.IslemNo}`
      }));

      return NextResponse.json(mappedRecords);
    }

  } catch (error: any) {
    console.error("--> FATURA GLOBAL SORGUSU PATLADI:", error.message);
    return NextResponse.json({ success: false, error: 'Veritabanı veya sorgu sunucu hatası.' }, { status: 500 }); 
  }
}