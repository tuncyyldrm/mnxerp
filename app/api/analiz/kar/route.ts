import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const baslangic = searchParams.get('baslangic');
  const bitis = searchParams.get('bitis');
  const stokKodu = searchParams.get('stokKodu');
  const muhtelifDahil = searchParams.get('muhtelifDahil') === 'true';

  try {
    const pool = await getDbConnection();

    // ========================================================
    // 1. TEK ÜRÜNÜN DETAY SATIŞ GEÇMİŞİ (Hareket İnceleme)
    // ========================================================
    if (stokKodu) {
      let detailQuery = `
        SELECT 
          i.islemid,
          COALESCE(ik.id_name, N'Bilinmeyen Cari / Müşteri') AS cariAdi,
          COALESCE(NULLIF(ik.faturanumarası, ''), ik.belgenumarası, '-') AS belgeNo,
          CONVERT(VARCHAR(10), i.I_DATE, 120) AS tarih,
          ISNULL(ik.belgesaati, '00:00:00') AS saat,
          i.satısmiktar AS miktar,
          i.birimfiyat AS birimFiyat,
          COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat) AS satisTutari
        FROM [dbo].[islem] i WITH (NOLOCK)
        LEFT JOIN [dbo].[islemkaydı] ik WITH (NOLOCK) ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
        WHERE i.satısmiktar > 0
          AND i.I_TYPE = 'S'
          AND i.detay_kodu = @stokKodu
      `;

      const req = pool.request();
      req.input('stokKodu', stokKodu);

      if (baslangic) {
        detailQuery += ` AND i.I_DATE >= @baslangic`;
        req.input('baslangic', baslangic);
      }
      if (bitis) {
        detailQuery += ` AND i.I_DATE < DATEADD(day, 1, CAST(@bitis AS DATETIME))`;
        req.input('bitis', bitis);
      }

      detailQuery += ` ORDER BY i.I_DATE DESC, i.islemid DESC`;

      const result = await req.query(detailQuery);
      return NextResponse.json({
        success: true,
        stokKodu,
        hareketler: result.recordset || []
      });
    }

    // ========================================================
    // 2. TÜM SATILAN ÜRÜNLERİN KÂR ANALİZ RAPORU
    // ========================================================
    const req = pool.request();

    let extraFilterWhere = '';
    if (baslangic) {
      extraFilterWhere += ` AND i.I_DATE >= @baslangic`;
      req.input('baslangic', baslangic);
    }
    if (bitis) {
      extraFilterWhere += ` AND i.I_DATE < DATEADD(day, 1, CAST(@bitis AS DATETIME))`;
      req.input('bitis', bitis);
    }

    // Seçenek 1: Muhtelif / Resmi fatura kalemlerini hariç tut (Varsayılan)
    if (!muhtelifDahil) {
      extraFilterWhere += ` AND i.detay_kodu NOT IN ('0001') AND ISNULL(i.detay, '') NOT LIKE '%MUHTELİF%' AND ISNULL(i.detay, '') NOT LIKE '%MUHTELIF%'`;
    }

    const queryStr = `
      WITH AlisMaliyet AS (
        SELECT 
          detay_kodu,
          CASE 
            WHEN SUM(alısmiktar) > 0 THEN SUM(alıstutarı) / SUM(alısmiktar)
            ELSE AVG(birimfiyat)
          END AS ortalama_alis_fiyat
        FROM [dbo].[islem] WITH (NOLOCK)
        WHERE alısmiktar > 0 AND detay_kodu IS NOT NULL AND detay_kodu <> ''
        GROUP BY detay_kodu
      )
      SELECT 
        i.detay_kodu AS stokKodu,
        MAX(COALESCE(s.urun, i.detay)) AS urunAdi,
        MAX(COALESCE(s.grubu, '')) AS grubu,
        MAX(COALESCE(s.kateGOri, '')) AS kategori,
        MAX(COALESCE(i.birim, 'ADET')) AS birim,
        SUM(i.satısmiktar) AS satilanMiktar,
        SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat)) AS toplamSatisTutari,
        CASE 
          WHEN SUM(i.satısmiktar) > 0 
          THEN SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat)) / SUM(i.satısmiktar)
          ELSE 0 
        END AS ortalamaSatisFiyati,
        COALESCE(NULLIF(MAX(m.ortalama_alis_fiyat), 0), NULLIF(MAX(s.fiyatıA), 0), 0) AS birimMaliyet,
        SUM(i.satısmiktar) * COALESCE(NULLIF(MAX(m.ortalama_alis_fiyat), 0), NULLIF(MAX(s.fiyatıA), 0), 0) AS toplamMaliyet,
        SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat)) - 
          (SUM(i.satısmiktar) * COALESCE(NULLIF(MAX(m.ortalama_alis_fiyat), 0), NULLIF(MAX(s.fiyatıA), 0), 0)) AS netKar,
        CASE 
          WHEN SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat)) > 0 
          THEN ((SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat)) - 
                (SUM(i.satısmiktar) * COALESCE(NULLIF(MAX(m.ortalama_alis_fiyat), 0), NULLIF(MAX(s.fiyatıA), 0), 0))) / 
                SUM(COALESCE(NULLIF(i.satıstutarı, 0), i.satısmiktar * i.birimfiyat))) * 100
          ELSE 0 
        END AS karMarjiYuzde
      FROM [dbo].[islem] i WITH (NOLOCK)
      LEFT JOIN AlisMaliyet m ON i.detay_kodu = m.detay_kodu
      LEFT JOIN [dbo].[stok] s WITH (NOLOCK) ON i.detay_kodu = s.urunkodu
      WHERE i.satısmiktar > 0
        AND i.I_TYPE = 'S'
        ${extraFilterWhere}
      GROUP BY i.detay_kodu
      ORDER BY netKar DESC
    `;

    const result = await req.query(queryStr);
    const urunler = result.recordset || [];

    // Özet toplamları hesapla
    const toplamCiro = urunler.reduce((acc, u) => acc + (Number(u.toplamSatisTutari) || 0), 0);
    const toplamMaliyet = urunler.reduce((acc, u) => acc + (Number(u.toplamMaliyet) || 0), 0);
    const toplamNetKar = urunler.reduce((acc, u) => acc + (Number(u.netKar) || 0), 0);
    const toplamSatilanAdet = urunler.reduce((acc, u) => acc + (Number(u.satilanMiktar) || 0), 0);
    const ortalamaKarMarji = toplamCiro > 0 ? (toplamNetKar / toplamCiro) * 100 : 0;

    return NextResponse.json({
      success: true,
      muhtelifDahil,
      ozet: {
        toplamCiro,
        toplamMaliyet,
        toplamNetKar,
        toplamSatilanAdet,
        toplamUrunCesidi: urunler.length,
        ortalamaKarMarji
      },
      urunler
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Kâr Analizi API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Veritabanı kâr analizi sorgusu başarısız oldu.' },
      { status: 500 }
    );
  }
}
