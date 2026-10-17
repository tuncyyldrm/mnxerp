// app/api/urun-duzenle/route.ts
import { NextResponse, NextRequest } from 'next/server';
import * as sql from 'mssql';
import { getDbConnection } from '@/app/lib/db'; // db.ts dosyanızın yolu
import { isSameOrigin } from '@/app/lib/request-security';

interface UrunDuzenleBody {
  urunKodu: string;
  urunAd: string;
  raf: string;
  oems: string[]; // [oem0, oem1, oem2, oem3, oem4]
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
    const { urunKodu, urunAd, raf, oems } = body;

    // Temel doğrulama (Validation)
    if (!urunKodu || !urunAd) {
      return NextResponse.json(
        { error: 'Ürün kodu ve ürün adı boş bırakılamaz.' },
        { status: 400 }
      );
    }

    // Ortak havuzdan (Singleton Promise) bağlantıyı çekiyoruz
    const pool = await getDbConnection();
    
    // Prosedürü güvenli parametrelerle çalıştırıyoruz
    await pool.request()
      .input('UrunKodu', urunKodu)
      .input('UrunAd', urunAd)
      .input('Raf', raf || '')
      .input('OEM_0', oems?.[0] || '')
      .input('OEM_1', oems?.[1] || '')
      .input('OEM_2', oems?.[2] || '')
      .input('OEM_3', oems?.[3] || '')
      .input('OEM_4', oems?.[4] || '')
      .execute('sp_StokDuzenle');

    return NextResponse.json({ success: true, message: 'Ürün başarıyla güncellendi.' });
  } catch (error: any) {
    console.error('Ürün Düzenleme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Veritabanı işlemi sırasında bir hata oluştu.' },
      { status: 500 }
    );
  }
}