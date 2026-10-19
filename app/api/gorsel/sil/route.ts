import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCleanedCode } from '@/components/katalog/types';

export const dynamic = 'force-dynamic';

const URUNLER_DIR = path.join(process.cwd(), 'public', 'images', 'urunler');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urunkodu } = body;

    if (!urunkodu) {
      return NextResponse.json({ success: false, error: 'Ürün kodu gereklidir.' }, { status: 400 });
    }

    const cleaned = getCleanedCode(urunkodu);
    const fileName = cleaned + '.jpg';
    const targetFile = path.resolve(URUNLER_DIR, fileName);

    if (!fs.existsSync(targetFile)) {
      return NextResponse.json({
        success: false,
        error: `Bu ürüne ait görsel bulunamadı (${cleaned}.jpg).`
      }, { status: 404 });
    }

    await fs.promises.unlink(targetFile);

    return NextResponse.json({
      success: true,
      message: `${cleaned}.jpg görseli başarıyla silindi.`
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Görsel Silme Hatası:', errorMsg);
    return NextResponse.json({ success: false, error: 'Görsel silinemedi: ' + errorMsg }, { status: 500 });
  }
}
