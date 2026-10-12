import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';

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
    let queryStr = `
      SELECT 
        v.id,
        v.kodu,
        v.firma,
        v.sehir,
        v.CariTipi,
        v.NetBakiyeTL,
        v.Kanali,
        CONVERT(VARCHAR(10), v.SonIslemTarihi, 120) AS SonIslemTarihi,
        ISNULL(v.GecikmeGunSayisi, 0) AS GecikmeGunSayisi,
        c.tel1,
        c.tel2,
        c.email,
        c.ilgili AS yetkili,
        c.adresi,
        c.vergidairesi,
        c.vergino,
        CASE 
          WHEN ISNULL(v.GecikmeGunSayisi, 0) <= 30 THEN 'GUNCEL'
          WHEN ISNULL(v.GecikmeGunSayisi, 0) <= 60 THEN 'DIKKAT'
          WHEN ISNULL(v.GecikmeGunSayisi, 0) <= 90 THEN 'KRITIK'
          ELSE 'YUKSEK_RISK'
        END AS riskSeviyesi
      FROM [dbo].[V_CariAnalizRaporu] v WITH (NOLOCK)
      LEFT JOIN [dbo].[cari] c WITH (NOLOCK) ON v.id = c.id
      WHERE 1=1
    `;
    const req = pool.request();

    if (tip && tip.trim() !== '') {
      const cleanTip = tip.toLowerCase().trim();
      
      if (cleanTip === 'trendyol') {
        queryStr += ` AND (LOWER(v.firma) LIKE @tip OR LOWER(v.Kanali) LIKE @tip)`;
        req.input('tip', '%trendyol%');
      } else if (cleanTip === 'geciken' || cleanTip === 'riskli') {
        queryStr += ` AND v.kodu NOT LIKE '770%' AND v.NetBakiyeTL > 0 AND ISNULL(v.GecikmeGunSayisi, 0) > 15`;
      } else {
        queryStr += ` AND LOWER(v.kodu) LIKE @tip`;
        
        let dbTip = '%770%'; 
        if (cleanTip.includes('musteri') || cleanTip === '120') {
          dbTip = '%120%';
        } else if (cleanTip.includes('tedarikci') || cleanTip === '320') {
          dbTip = '%320%';
        }
        
        req.input('tip', dbTip);
      }
    }

    queryStr += ` ORDER BY v.NetBakiyeTL DESC`;

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

      // Yaşlandırma dilimleri
      yaslandirma: {
        guncelTutar: cariler.filter(c => c.NetBakiyeTL > 0 && c.riskSeviyesi === 'GUNCEL').reduce((acc, c) => acc + c.NetBakiyeTL, 0),
        dikkatTutar: cariler.filter(c => c.NetBakiyeTL > 0 && c.riskSeviyesi === 'DIKKAT').reduce((acc, c) => acc + c.NetBakiyeTL, 0),
        kritikTutar: cariler.filter(c => c.NetBakiyeTL > 0 && c.riskSeviyesi === 'KRITIK').reduce((acc, c) => acc + c.NetBakiyeTL, 0),
        yuksekRiskTutar: cariler.filter(c => c.NetBakiyeTL > 0 && c.riskSeviyesi === 'YUKSEK_RISK').reduce((acc, c) => acc + c.NetBakiyeTL, 0),
        borcluCariSayisi: cariler.filter(c => c.NetBakiyeTL > 0).length
      },
      
      toplamCariKayıt: cariler.length
    };

    return NextResponse.json({ ozet, cariler });

  } catch (error: any) {
    console.error("--> API HATASI:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ========================================================
// 4. ADIM: CARİ BİLGİLERİNİ GÜNCELLEME (POST)
// ========================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, tel1, tel2, email, yetkili, adresi, sehir, vergidairesi, vergino } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Cari ID gereklidir.' }, { status: 400 });
    }

    const pool = await getDbConnection();
    await pool.request()
      .input('id', id)
      .input('tel1', (tel1 || '').slice(0, 50))
      .input('tel2', (tel2 || '').slice(0, 50))
      .input('email', (email || '').slice(0, 100))
      .input('ilgili', (yetkili || '').slice(0, 100))
      .input('adresi', (adresi || '').slice(0, 500))
      .input('sehir', (sehir || '').slice(0, 50))
      .input('vergidairesi', (vergidairesi || '').slice(0, 100))
      .input('vergino', (vergino || '').slice(0, 50))
      .query(`
        UPDATE [dbo].[cari]
        SET 
          tel1 = @tel1,
          tel2 = @tel2,
          email = @email,
          ilgili = @ilgili,
          adresi = @adresi,
          sehir = @sehir,
          vergidairesi = @vergidairesi,
          vergino = @vergino,
          UP_DATE = GETDATE()
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: 'Cari bilgileri başarıyla güncellendi.'
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Cari Güncelleme API Hatası:', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}