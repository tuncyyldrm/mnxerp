import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import * as sql from 'mssql';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (!q) {
    return NextResponse.json({ success: true, urunler: [] });
  }

  try {
    const pool = await getDbConnection();
    const req = pool.request();

    req.input('q', sql.NVarChar(100), q);
    req.input('likeQ', sql.NVarChar(100), `%${q}%`);

    const result = await req.query(`
      SELECT TOP 20
        s.urunkodu,
        s.urun,
        s.urunalt,
        s.grubu,
        s.kateGOri,
        s.Raf,
        s.fiyatı,
        ISNULL(s.STK_FULL, 0) AS sistemStok,
        s.OEM,
        s.OEM_0,
        s.OEM_1
      FROM [dbo].[stok] s WITH (NOLOCK)
      WHERE s.urunkodu = @q
         OR s.OEM = @q
         OR s.urunkodu LIKE @likeQ
         OR s.OEM LIKE @likeQ
         OR s.urun LIKE @likeQ
         OR s.barkod = @q
         OR s.barkod1 = @q
      ORDER BY 
        CASE 
          WHEN s.urunkodu = @q THEN 1
          WHEN s.OEM = @q THEN 2
          WHEN s.urunkodu LIKE @q + '%' THEN 3
          ELSE 4
        END,
        s.urunkodu ASC
    `);

    return NextResponse.json({
      success: true,
      urunler: result.recordset || []
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Depo Sayım API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Ürün arama başarısız oldu.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urunKodu, raf } = body;

    if (!urunKodu) {
      return NextResponse.json(
        { success: false, error: 'Ürün kodu gereklidir.' },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();

    // Mevcut ürün bilgilerini al
    const stokRes = await pool.request()
      .input('urunKodu', sql.NVarChar(100), urunKodu)
      .query(`SELECT TOP 1 urun, OEM_0, OEM_1, OEM_2, OEM_3, OEM_4 FROM [dbo].[stok] WHERE urunkodu = @urunKodu`);

    if (stokRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Ürün bulunamadı.' }, { status: 404 });
    }

    const urun = stokRes.recordset[0];

    // sp_StokDuzenle ile Rafı güncelle
    await pool.request()
      .input('UrunKodu', sql.NVarChar(100), urunKodu)
      .input('UrunAd', sql.NVarChar(250), urun.urun)
      .input('Raf', sql.NVarChar(50), raf || '')
      .input('OEM_0', sql.NVarChar(100), urun.OEM_0 || '')
      .input('OEM_1', sql.NVarChar(100), urun.OEM_1 || '')
      .input('OEM_2', sql.NVarChar(100), urun.OEM_2 || '')
      .input('OEM_3', sql.NVarChar(100), urun.OEM_3 || '')
      .input('OEM_4', sql.NVarChar(100), urun.OEM_4 || '')
      .execute('sp_StokDuzenle');

    return NextResponse.json({
      success: true,
      message: 'Raf konumu başarıyla güncellendi.',
      urunKodu,
      yeniRaf: raf
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Raf Güncelleme Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: 'Raf güncelleme başarısız oldu.' },
      { status: 500 }
    );
  }
}
