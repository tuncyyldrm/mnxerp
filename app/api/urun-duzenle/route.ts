import { NextResponse, NextRequest } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import { isSameOrigin } from '@/app/lib/request-security';

interface UrunDuzenleBody {
  urunKodu: string;
  urunAd: string;
  urunAlt?: string;
  raf?: string;
  oems?: string[]; // [oem0, oem1, oem2, oem3, oem4]
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: 'Geçersiz istek kaynağı.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as UrunDuzenleBody;
    const { urunKodu, urunAd, urunAlt, raf, oems } = body;

    // Temel doğrulama (Validation)
    if (!urunKodu || !urunAd) {
      return NextResponse.json(
        { error: 'Ürün kodu ve ürün adı boş bırakılamaz.' },
        { status: 400 }
      );
    }

    // Ortak havuzdan bağlantıyı çekiyoruz
    const pool = await getDbConnection();
    
    // Prosedürü güvenli parametrelerle çalıştırıyoruz
    await pool.request()
      .input('UrunKodu', urunKodu)
      .input('UrunAd', urunAd)
      .input('UrunAlt', urunAlt || '')
      .input('Raf', raf || '')
      .input('OEM_0', oems?.[0] || '')
      .input('OEM_1', oems?.[1] || '')
      .input('OEM_2', oems?.[2] || '')
      .input('OEM_3', oems?.[3] || '')
      .input('OEM_4', oems?.[4] || '')
      .execute('sp_StokDuzenle');

    return NextResponse.json({ success: true, message: 'Ürün başarıyla güncellendi.' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Veritabanı işlemi sırasında bir hata oluştu.';
    console.error('Ürün Düzenleme API Hatası:', error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}