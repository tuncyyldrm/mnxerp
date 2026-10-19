import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import * as sql from 'mssql';
import { isSameOrigin } from '@/app/lib/request-security';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Geçmiş sayımları listele
export async function GET() {
  try {
    const pool = await getDbConnection();
    const result = await pool.request().query(`
      SELECT TOP 20
        s.SY_ID AS syId,
        s.S_NAME AS sayimAdi,
        CONVERT(VARCHAR(10), s.S_DATE, 120) AS tarih,
        s.S_STATU AS statu,
        COUNT(sk.SS_ID) AS toplamKalem,
        SUM(CASE WHEN sk.S_ADET <> sk.S_STOK THEN 1 ELSE 0 END) AS farkliKalem
      FROM [dbo].[INDX_SAYIM] s WITH (NOLOCK)
      LEFT JOIN [dbo].[INDX_SAYIM_STOK] sk WITH (NOLOCK) ON s.SY_ID = sk.SY_ID
      GROUP BY s.SY_ID, s.S_NAME, s.S_DATE, s.S_STATU
      ORDER BY s.SY_ID DESC
    `);

    return NextResponse.json({
      success: true,
      sayimlar: result.recordset || []
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Sayım Listesi Alma Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Geçmiş sayımlar alınamadı.' },
      { status: 500 }
    );
  }
}

// Sayımı sisteme işle / Onelee stoklarını güncelle
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { sayimAdi, kalemler, stoklariGuncelle } = body;

    if (!Array.isArray(kalemler) || kalemler.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sayıma dahil edilecek en az bir ürün bulunmalıdır.' },
        { status: 400 }
      );
    }

    // XML formatına dönüştür
    const xmlItems = kalemler.map((k: { urunkodu: string; sayilanStok: number; raf?: string }) => `
      <item>
        <kod>${escapeXml(k.urunkodu)}</kod>
        <adet>${Number(k.sayilanStok) || 0}</adet>
        <raf>${escapeXml(k.raf || '')}</raf>
      </item>
    `).join('');

    const xml = `<items>${xmlItems}</items>`;

    const pool = await getDbConnection();
    const req = pool.request();

    req.input('SayimAdi', sql.NVarChar(200), (sayimAdi || 'Web Depo Sayımı').slice(0, 200));
    req.input('SayimXml', sql.NVarChar(sql.MAX), xml);
    req.input('KullaniciId', sql.Int, 1);
    req.input('StoklariGuncelle', sql.Bit, stoklariGuncelle !== false ? 1 : 0);

    const result = await req.execute('sp_SayimSistemeIsle');
    const record = result.recordset?.[0];

    if (!record || record.Success !== 1) {
      return NextResponse.json(
        { success: false, error: record?.Message || 'Sayım sisteme işlenemedi.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: record.Message,
      syId: record.SyId,
      toplamKalem: kalemler.length,
      stoklarGuncellendi: stoklariGuncelle !== false
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Sayım İşleme API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Sayım işlemi sırasında bir hata oluştu: ' + errorMsg },
      { status: 500 }
    );
  }
}
