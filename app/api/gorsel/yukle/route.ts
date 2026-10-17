import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getCleanedCode } from '@/components/katalog/types';

export const dynamic = 'force-dynamic';

const URUNLER_DIR = path.join(process.cwd(), 'public', 'images', 'urunler');

// Dizin yoksa oluştur
if (!fs.existsSync(URUNLER_DIR)) {
  fs.mkdirSync(URUNLER_DIR, { recursive: true });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // 1. Durum: Belirli bir ürün kodu için tek dosya yükleme/değiştirme
    const tekliKod = formData.get('urunkodu') as string | null;
    const tekliDosya = formData.get('file') as File | null;

    // 2. Durum: Toplu yükleme (Birden fazla dosya, dosya isimleri ürün kodudur)
    const topluDosyalar = formData.getAll('files') as File[];

    const sonuclar: Array<{ dosyaAdi: string; urunkodu: string; durum: 'basarili' | 'hatali'; mesaj?: string; boyut?: number }> = [];

    // Tekli Yükleme
    if (tekliDosya && tekliKod) {
      const cleaned = getCleanedCode(tekliKod);
      if (!cleaned) {
        return NextResponse.json({ success: false, error: 'Geçersiz ürün kodu.' }, { status: 400 });
      }

      const targetPath = path.join(URUNLER_DIR, `${cleaned}.jpg`);
      const arrayBuffer = await tekliDosya.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Sharp ile optimize et, EXIF yönünü düzelt, beyaz arkaplanla JPG'e çevir, max 1000x1000 yap
      await sharp(buffer)
        .rotate()
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 85, progressive: true })
        .toFile(targetPath);

      const stat = await fs.promises.stat(targetPath);

      return NextResponse.json({
        success: true,
        message: `${cleaned}.jpg başarıyla yüklendi ve optimize edildi.`,
        dosyaAdi: `${cleaned}.jpg`,
        url: `/images/urunler/${cleaned}.jpg?t=${Date.now()}`,
        boyut: stat.size
      });
    }

    // Toplu Yükleme (veya tekli ama kodsuz dosya)
    const islenecekDosyalar = topluDosyalar.length > 0 ? topluDosyalar : (tekliDosya ? [tekliDosya] : []);

    if (islenecekDosyalar.length === 0) {
      return NextResponse.json({ success: false, error: 'Yüklenecek dosya seçilmedi.' }, { status: 400 });
    }

    for (const file of islenecekDosyalar) {
      try {
        const rawName = path.parse(file.name).name;
        const cleaned = getCleanedCode(rawName);

        if (!cleaned) {
          sonuclar.push({
            dosyaAdi: file.name,
            urunkodu: rawName,
            durum: 'hatali',
            mesaj: 'Dosya adından geçerli ürün kodu üretilemedi.'
          });
          continue;
        }

        const targetPath = path.join(URUNLER_DIR, `${cleaned}.jpg`);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await sharp(buffer)
          .rotate()
          .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: 85, progressive: true })
          .toFile(targetPath);

        const stat = await fs.promises.stat(targetPath);

        sonuclar.push({
          dosyaAdi: `${cleaned}.jpg`,
          urunkodu: cleaned,
          durum: 'basarili',
          boyut: stat.size
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'İşleme hatası';
        sonuclar.push({
          dosyaAdi: file.name,
          urunkodu: file.name,
          durum: 'hatali',
          mesaj: errorMsg
        });
      }
    }

    const basariliSayisi = sonuclar.filter(s => s.durum === 'basarili').length;
    const hataliSayisi = sonuclar.filter(s => s.durum === 'hatali').length;

    return NextResponse.json({
      success: true,
      message: `${basariliSayisi} görsel başarıyla yüklendi.${hataliSayisi > 0 ? ` (${hataliSayisi} hata)` : ''}`,
      toplam: islenecekDosyalar.length,
      basarili: basariliSayisi,
      hatali: hataliSayisi,
      sonuclar
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Görsel Yükleme Hatası:', errorMsg);
    return NextResponse.json({ success: false, error: 'Görsel yüklenemedi: ' + errorMsg }, { status: 500 });
  }
}
