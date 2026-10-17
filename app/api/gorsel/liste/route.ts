import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDbConnection } from '@/app/lib/db';
import { getCleanedCode } from '@/components/katalog/types';

export const dynamic = 'force-dynamic';

const URUNLER_DIR = path.join(process.cwd(), 'public', 'images', 'urunler');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const durum = searchParams.get('durum') || 'all'; // 'all' | 'gorselli' | 'gorselsiz'
    const grubu = searchParams.get('grubu')?.trim() || '';
    const sayfa = Math.max(1, parseInt(searchParams.get('sayfa') || '1', 10));
    const limit = Math.min(100, Math.max(12, parseInt(searchParams.get('limit') || '24', 10)));

    // 1. Mevcut görsellerin Set'ini oluştur (3ms)
    let existingImages = new Set<string>();
    if (fs.existsSync(URUNLER_DIR)) {
      const files = await fs.promises.readdir(URUNLER_DIR);
      existingImages = new Set(files.map(f => f.toLowerCase()));
    }

    // 2. Veritabanından ürünleri çek
    const pool = await getDbConnection();
    const req = pool.request();

    let whereClause = ' WHERE 1=1 ';

    if (search) {
      req.input('search', `%${search}%`);
      whereClause += ` AND (
        s.urunkodu LIKE @search OR 
        s.urun LIKE @search OR 
        s.OEM LIKE @search OR 
        s.Raf LIKE @search
      )`;
    }

    if (grubu) {
      req.input('grubu', grubu);
      whereClause += ` AND s.grubu = @grubu`;
    }

    // Sorguyu çalıştır
    const query = `
      SELECT 
        s.oto,
        s.urunkodu,
        s.urun,
        s.grubu,
        s.kateGOri AS kategori,
        s.tipi,
        s.Raf,
        s.fiyatı,
        s.OEM,
        ISNULL(s.STK_FULL, 0) AS MevcutBakiye
      FROM [dbo].[stok] s WITH (NOLOCK)
      ${whereClause}
      ORDER BY s.urunkodu ASC
    `;

    const result = await req.query(query);
    const allRows = result.recordset || [];

    // 3. Her ürünün görsel varlık durumunu belirle
    const enriched = allRows.map((r: any) => {
      const cleaned = getCleanedCode(r.urunkodu);
      const fileName = `${cleaned}.jpg`;
      const gorselVar = existingImages.has(fileName.toLowerCase());
      return {
        ...r,
        cleanedKod: cleaned,
        gorselVar,
        gorselUrl: gorselVar ? `/images/urunler/${fileName}` : null
      };
    });

    // 4. Genel İstatistikler
    const toplamUrun = enriched.length;
    const gorselliSayisi = enriched.filter(e => e.gorselVar).length;
    const gorselsizSayisi = toplamUrun - gorselliSayisi;
    const dolulukOrani = toplamUrun > 0 ? Math.round((gorselliSayisi / toplamUrun) * 100) : 0;

    // 5. Durum filtresi uygula (gorselli / gorselsiz)
    let filtered = enriched;
    if (durum === 'gorselli') {
      filtered = enriched.filter(e => e.gorselVar);
    } else if (durum === 'gorselsiz') {
      filtered = enriched.filter(e => !e.gorselVar);
    }

    // 6. Sayfalama (Pagination)
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const offset = (sayfa - 1) * limit;
    const pagedItems = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      stats: {
        toplamUrun,
        gorselliSayisi,
        gorselsizSayisi,
        dolulukOrani,
        toplamGorselDosyasi: existingImages.size
      },
      pagination: {
        sayfa,
        limit,
        totalPages,
        totalFiltered
      },
      urunler: pagedItems
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Görsel Liste API Hatası:', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
