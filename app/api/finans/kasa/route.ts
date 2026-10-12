import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';

export async function GET() {
  try {
    const pool = await getDbConnection();

    // 1. Kasa Listesi
    const kasalarResult = await pool.request().query(`
      SELECT 
        kasaid,
        kasa_kodu AS kodu,
        kasa_ack AS ad,
        ISNULL(BK_TL, 0) AS bakiye,
        CASE 
          WHEN kasa_ack LIKE '%TRENDYOL%' THEN 'TRENDYOL'
          WHEN kasa_ack LIKE '%POS%' THEN 'POS'
          WHEN kasa_ack LIKE '%MERKEZ%' OR kasa_ack LIKE '%NAKİT%' THEN 'NAKIT'
          WHEN kasa_ack LIKE '%K.K%' OR kasa_ack LIKE '%KART%' OR kasa_ack LIKE '%EK HESAP%' THEN 'KREDI_KARTI'
          ELSE 'DIGER'
        END AS tip
      FROM [dbo].[kasa] WITH (NOLOCK)
      WHERE kasa_statu = 0 OR ISNULL(BK_TL, 0) <> 0
      ORDER BY 
        CASE 
          WHEN kasa_ack LIKE '%MERKEZ%' THEN 1
          WHEN kasa_ack LIKE '%POS%' THEN 2
          WHEN kasa_ack LIKE '%TRENDYOL%' THEN 3
          ELSE 4
        END,
        kasa_ack ASC
    `);

    const kasalar = kasalarResult.recordset || [];

    // Özet toplamları hesapla
    let toplamNakit = 0;
    let toplamPos = 0;
    let toplamPazaryeri = 0;
    let toplamKrediKartiBorcu = 0;

    kasalar.forEach(k => {
      const bakiye = Number(k.bakiye) || 0;
      if (k.tip === 'NAKIT') {
        toplamNakit += bakiye;
      } else if (k.tip === 'POS') {
        toplamPos += bakiye;
      } else if (k.tip === 'TRENDYOL') {
        toplamPazaryeri += bakiye;
      } else if (k.tip === 'KREDI_KARTI') {
        if (bakiye < 0) {
          toplamKrediKartiBorcu += Math.abs(bakiye);
        } else {
          toplamNakit += bakiye;
        }
      } else {
        if (bakiye >= 0) toplamNakit += bakiye;
        else toplamKrediKartiBorcu += Math.abs(bakiye);
      }
    });

    const toplamVarliklar = toplamNakit + toplamPos + toplamPazaryeri;
    const netLikidite = toplamVarliklar - toplamKrediKartiBorcu;

    // 2. Son Kasa Hareketleri (Tahsilatlar ve Ödemeler)
    const hareketlerResult = await pool.request().query(`
      SELECT TOP 15
        i.islemid,
        ik.ikid AS islemNo,
        COALESCE(ik.id_name, N'Merkez Kasa / Cari') AS cariAdi,
        COALESCE(NULLIF(ik.faturanumarası, ''), ik.belgenumarası, '-') AS belgeNo,
        ik.islemtipi AS islemTipi,
        k.kasa_ack AS kasaAdi,
        CONVERT(VARCHAR(10), i.I_DATE, 120) AS tarih,
        COALESCE(NULLIF(i.net, 0), i.alıstutarı, i.satıstutarı, 0) AS tutar,
        CASE 
          WHEN ik.islemtipi LIKE '%TAHSİLAT%' OR ik.islemtipi = 'NT' OR ik.islemtipi = 'KKT' THEN 'GIRIS'
          ELSE 'CIKIS'
        END AS yon
      FROM [dbo].[islem] i WITH (NOLOCK)
      INNER JOIN [dbo].[islemkaydı] ik WITH (NOLOCK) ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
      LEFT JOIN [dbo].[kasa] k WITH (NOLOCK) ON i.kasaid = k.kasaid
      WHERE i.kasaid > 0
      ORDER BY i.I_DATE DESC, i.islemid DESC
    `);

    return NextResponse.json({
      success: true,
      ozet: {
        toplamVarliklar,
        toplamNakit,
        toplamPos,
        toplamPazaryeri,
        toplamKrediKartiBorcu,
        netLikidite,
        kasaAdedi: kasalar.length
      },
      kasalar,
      sonHareketler: hareketlerResult.recordset || []
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Kasa & Likidite API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Kasa bilgileri getirilemedi.' },
      { status: 500 }
    );
  }
}
