import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import * as sql from 'mssql';
import { isSameOrigin } from '@/app/lib/request-security';

export async function GET() {
  try {
    const pool = await getDbConnection();

    // Sadece tahsilat yapılabilecek aktif kasalar
    const kasalarResult = await pool.request().query(`
      SELECT kasaid, kasa_kodu, kasa_ack, ISNULL(BK_TL, 0) AS bakiye
      FROM [dbo].[kasa] WITH (NOLOCK)
      WHERE kasa_statu = 0
      ORDER BY 
        CASE 
          WHEN kasa_ack LIKE '%MERKEZ%' THEN 1
          WHEN kasa_ack LIKE '%POS%' THEN 2
          ELSE 3
        END,
        kasa_ack ASC
    `);

    return NextResponse.json({
      success: true,
      kasalar: kasalarResult.recordset || []
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: 'Geçersiz istek kaynağı.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      cariId,
      cariAdi,
      kasaId,
      tutar,
      aciklama = 'HIZLI TAHSİLAT',
      islemTipi = 'NAKİT TAHSİLAT'
    } = body;

    const parsedCariId = parseInt(cariId, 10);
    const parsedKasaId = parseInt(kasaId, 10);
    const parsedTutar = typeof tutar === 'string' ? parseFloat(tutar.replace(',', '.')) : parseFloat(tutar);

    if (!cariId || isNaN(parsedCariId) || !cariAdi || isNaN(parsedTutar) || parsedTutar <= 0) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz müşteri, kasa veya tutar bilgisi.' },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    const req = pool.request();

    req.input('CariId', sql.Int, parsedCariId);
    req.input('CariAdi', sql.NVarChar(255), cariAdi);
    req.input('KasaId', sql.Int, isNaN(parsedKasaId) ? 1 : parsedKasaId);
    req.input('Tutar', sql.Float, parsedTutar);
    req.input('Aciklama', sql.NVarChar(255), aciklama);
    req.input('IslemTipi', sql.NVarChar(50), islemTipi);

    const result = await req.execute('dbo.sp_HizliTahsilatEkle');
    const output = result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;

    if (output && output.Success === 1) {
      return NextResponse.json({
        success: true,
        message: output.Message,
        islemNo: output.IslemNo,
        belgeNo: output.BelgeNo
      });
    } else {
      return NextResponse.json(
        { success: false, error: output?.Message || 'Tahsilat kaydı sırasında hata oluştu.' },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Tahsilat API Hatası:', errorMsg);
    return NextResponse.json(
      { success: false, error: `Sunucu Hatası: ${errorMsg}` },
      { status: 500 }
    );
  }
}
