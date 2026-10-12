import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';

export async function GET() {
  try {
    const pool = await getDbConnection();

    const queryStr = `
      SELECT 
        v.id,
        v.kodu,
        v.firma,
        v.sehir,
        v.CariTipi,
        v.NetBakiyeTL AS bakiye,
        v.Kanali,
        CONVERT(VARCHAR(10), v.SonIslemTarihi, 120) AS sonIslemTarihi,
        v.GecikmeGunSayisi AS gecikmeGun,
        c.tel1,
        c.tel2,
        c.ilgili AS yetkili,
        CASE 
          WHEN v.GecikmeGunSayisi <= 30 THEN 'GUNCEL'
          WHEN v.GecikmeGunSayisi <= 60 THEN 'DIKKAT'
          WHEN v.GecikmeGunSayisi <= 90 THEN 'KRITIK'
          ELSE 'YUKSEK_RISK'
        END AS riskSeviyesi
      FROM [dbo].[V_CariAnalizRaporu] v WITH (NOLOCK)
      INNER JOIN [dbo].[cari] c WITH (NOLOCK) ON v.id = c.id
      WHERE v.NetBakiyeTL > 0
      ORDER BY v.GecikmeGunSayisi DESC, v.NetBakiyeTL DESC
    `;

    const result = await pool.request().query(queryStr);
    const cariler = result.recordset || [];

    let toplamAlacak = 0;
    let guncelTutar = 0;
    let dikkatTutar = 0;
    let kritikTutar = 0;
    let yuksekRiskTutar = 0;

    cariler.forEach((c: any) => {
      const bakiye = Number(c.bakiye) || 0;
      toplamAlacak += bakiye;

      if (c.riskSeviyesi === 'GUNCEL') guncelTutar += bakiye;
      else if (c.riskSeviyesi === 'DIKKAT') dikkatTutar += bakiye;
      else if (c.riskSeviyesi === 'KRITIK') kritikTutar += bakiye;
      else yuksekRiskTutar += bakiye;
    });

    return NextResponse.json({
      success: true,
      ozet: {
        toplamAlacak,
        borcluCariSayisi: cariler.length,
        guncelTutar,
        dikkatTutar,
        kritikTutar,
        yuksekRiskTutar
      },
      cariler
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Cari Yaşlandırma API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Cari yaşlandırma verileri alınamadı.' },
      { status: 500 }
    );
  }
}
