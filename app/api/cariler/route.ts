import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import * as sql from 'mssql'; // 🚀 Eksik olma ihtimaline karşı import ekledik

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const detayId = searchParams.get('detayId');   
  const tip = searchParams.get('tip');
  const search = searchParams.get('search');     

  try {
    const pool = await getDbConnection();

    // ========================================================
    // 🚀 REVİZE ADIM: CANLI CARİ ARAMA (V_CariAnalizRaporu Üzerinden)
    // ========================================================
    if (search && search.trim().length >= 2) {
      // Hata riskini sıfırlamak için zaten sisteminde çalışan V_CariAnalizRaporu'nu kullanıyoruz
      const result = await pool.request()
        .input('searchTerm', `%${search.trim()}%`)
        .query(`
          SELECT TOP 10 
            id, 
            id_name = firma, -- Frontend id_name beklediği için firma alanını alias ile alıyoruz
            kodu
          FROM [dbo].[V_CariAnalizRaporu]
          WHERE (firma LIKE @searchTerm OR kodu LIKE @searchTerm OR CAST(id AS VARCHAR) LIKE @searchTerm)
            AND kodu NOT LIKE '770%' -- Giderleri eliyoruz
          ORDER BY firma ASC
        `);

      return NextResponse.json({ 
        success: true, 
        data: result.recordset || [] 
      });
    }

    // ========================================================
    // 1. ADIM: SEÇİLEN FATURANIN İÇİNDEKİ ÜRÜN KALEMLERİ
    // ========================================================
    const gelenIslemId = searchParams.get('islemId') || searchParams.get('islemNo');

    if (gelenIslemId) {
      const islemNo = parseInt(gelenIslemId.trim(), 10);

      if (isNaN(islemNo)) {
        return NextResponse.json(
          { success: false, error: "Geçersiz İşlem Numarası." }, 
          { status: 400 }
        );
      }

      const result = await pool.request()
        .input('IslemNo', islemNo)
        .query(`
          SELECT 
            IslemNo,
            CariAdi,
            IslemTipi,
            FaturaTarihi,
            BelgeNo,
            FaturaToplamTutar,
            FaturaNotu,
            SatirId,
            UrunAdi,
            StokKodu,
            Birim,
            BirimFiyat,
            Miktar,
            KdvOrani,
            KdvTutari,
            KdvDahilBirimFiyat,
            SatirTutarı AS SatirTutari
          FROM [dbo].[vw_FaturaDetayRaporu]
          WHERE IslemNo = @IslemNo
        `);

      if (!result.recordset || result.recordset.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: `#${islemNo} numaralı işlem sistemde bulunamadı.` 
        }, { status: 404 });
      }

      const ilkSatir = result.recordset[0];

      const gecerliSatirlar = result.recordset
        .filter((row: any) => row.SatirId !== null)
        .map((row: any) => ({
          satirId: row.SatirId,
          urunAdi: row.UrunAdi || "Tanımsız Stok Hareketi",
          stokKodu: row.StokKodu || "-",
          birim: row.Birim || "ADET",
          miktar: Number(row.Miktar || 0),
          birimFiyat: Number(row.BirimFiyat || 0),
          kdvOrani: Number(row.KdvOrani || 0),
          kdvTutari: Number(row.KdvTutari || 0),
          kdvDahilBirimFiyat: Number(row.KdvDahilBirimFiyat || row.BirimFiyat || 0),
          satirTutari: Number(row.SatirTutari || 0)
        }));

      const faturaDetayResponse = {
        islemNo: ilkSatir.IslemNo,
        cariAdi: ilkSatir.CariAdi || "Bilinmeyen Cari",
        islemTipi: ilkSatir.IslemTipi || "BELGE",
        faturaTarihi: ilkSatir.FaturaTarihi,
        belgeNo: ilkSatir.BelgeNo && ilkSatir.BelgeNo !== "-" ? ilkSatir.BelgeNo : "Yok",
        faturaToplamTutar: Number(ilkSatir.FaturaToplamTutar || 0),
        faturaNotu: ilkSatir.FaturaNotu || "",
        satirlar: gecerliSatirlar
      };

      return NextResponse.json({ success: true, data: faturaDetayResponse });
    }

    // ========================================================
    // 2. ADIM: CARİYE AİT TÜM İŞLEMLERİN LİSTESİ (Özet Ekstre)
    // ========================================================
    if (detayId) {
      const result = await pool.request()
        .input('CariID', detayId)
        .query(`
          SELECT 
            CariID,
            CariKodu,
            FirmaAdi,
            IslemNo,
            IslemTarihi,
            BelgeNo,
            IslemTipi,
            IslemTutari,
            Yon
          FROM [dbo].[vw_CariEkstreDetay] 
          WHERE CariID = @CariID 
          ORDER BY IslemTarihi DESC
        `);
      return NextResponse.json(result.recordset || []);
    }

    // ========================================================
    // 3. ADIM: ANA CARİ ÖZET PANELİ & TABLO LİSTESİ
    // ========================================================
    let queryStr = `SELECT * FROM [dbo].[V_CariAnalizRaporu] WHERE 1=1`;
    const req = pool.request();

    if (tip && tip.trim() !== '') {
      const cleanTip = tip.toLowerCase().trim();
      
      if (cleanTip === 'trendyol') {
        queryStr += ` AND (LOWER(firma) LIKE @tip OR LOWER(Kanali) LIKE @tip)`;
        req.input('tip', '%trendyol%');
      } else if (cleanTip === 'geciken' || cleanTip === 'riskli') {
        queryStr += ` AND kodu NOT LIKE '770%' AND NetBakiyeTL > 0 AND ISNULL(GecikmeGunSayisi, 0) > 15`;
      } else {
        queryStr += ` AND LOWER(kodu) LIKE @tip`;
        
        let dbTip = '%770%'; 
        if (cleanTip.includes('musteri') || cleanTip === '120') {
          dbTip = '%120%';
        } else if (cleanTip.includes('tedarikci') || cleanTip === '320') {
          dbTip = '%320%';
        }
        
        req.input('tip', dbTip);
      }
    }

    const result = await req.query(queryStr);
    const cariler = result.recordset || [];

    // Dinamik Özet Hesaplama Bölümü
    const ozet = {
      toplamMusteriAlacak: cariler
        .filter(c => !(c.kodu || '').startsWith('770') && (c.NetBakiyeTL || 0) > 0)
        .reduce((acc, c) => acc + (c.NetBakiyeTL || 0), 0),
      
      toplamTedarikciBorc: cariler
        .filter(c => !(c.kodu || '').startsWith('770') && (c.NetBakiyeTL || 0) < 0)
        .reduce((acc, c) => acc + Math.abs(c.NetBakiyeTL || 0), 0),
      
      toplamGiderTutar: cariler
        .filter(c => (c.kodu || '').startsWith('770'))
        .reduce((acc, c) => acc + Math.abs(c.NetBakiyeTL || 0), 0),

      trendyolCariSayisi: cariler.filter(c => (c.Kanali || '') === 'Trendyol' || (c.firma || '').toLowerCase().includes('trendyol')).length,
      
      riskliCariSayisi: cariler.filter(c => {
        if ((c.kodu || '').startsWith('770')) return false;
        if ((c.NetBakiyeTL || 0) <= 0) return false; 

        const gecikmeGunu = Number(c.GecikmeGunSayisi || 0);
        return gecikmeGunu > 30; 
      }).length,
      
      toplamCariKayıt: cariler.length
    };

    return NextResponse.json({ ozet, cariler });

  } catch (error: any) {
    console.error("--> API HATASI:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}