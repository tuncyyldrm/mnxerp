import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCleanedCode } from '@/components/katalog/types';

export const dynamic = 'force-dynamic';

const URUNLER_DIR = path.join(process.cwd(), 'public', 'images', 'urunler');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kod = searchParams.get('kod');

    // Tekil ürün kontrolü
    if (kod) {
      const cleaned = getCleanedCode(kod);
      const filePath = path.join(URUNLER_DIR, `${cleaned}.jpg`);
      const exists = fs.existsSync(filePath);

      if (exists) {
        const stat = await fs.promises.stat(filePath);
        return NextResponse.json({
          exists: true,
          dosyaAdi: `${cleaned}.jpg`,
          url: `/images/urunler/${cleaned}.jpg?t=${stat.mtimeMs}`,
          boyut: stat.size,
          guncellenme: stat.mtime
        });
      } else {
        return NextResponse.json({
          exists: false,
          dosyaAdi: `${cleaned}.jpg`,
          url: null
        });
      }
    }

    // Genel disk istatistiği
    if (!fs.existsSync(URUNLER_DIR)) {
      return NextResponse.json({ totalGorselSayisi: 0 });
    }

    const files = await fs.promises.readdir(URUNLER_DIR);
    const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.webp'));

    return NextResponse.json({
      success: true,
      totalGorselSayisi: jpgFiles.length
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
