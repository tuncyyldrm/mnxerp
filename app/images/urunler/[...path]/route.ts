import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCleanedCode } from '@/components/katalog/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const URUNLER_DIR = path.join(process.cwd(), 'public', 'images', 'urunler');

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const rawSegments = resolvedParams?.path;

    if (!rawSegments || rawSegments.length === 0) {
      return new Response('Geçersiz görsel yolu', {
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // Segmentleri temizle ve normalize et
    const normalizedSegments = rawSegments.map(seg => decodeURIComponent(seg).replace(/[\\/]/g, ''));
    const relativePath = path.join(...normalizedSegments);
    const targetPath = path.resolve(URUNLER_DIR, relativePath);

    // Güvenlik: Dizin dışına çıkmayı engelle (Directory Traversal koruması)
    if (!targetPath.startsWith(URUNLER_DIR)) {
      return new Response('Erişim engellendi', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    let finalPath = targetPath;
    let exists = fs.existsSync(finalPath);

    // Doğrudan bulunamadıysa temizlenmiş ürün kodunu dene (örn: '0001 OEM.jpg' -> '0001.jpg')
    if (!exists) {
      const parsed = path.parse(targetPath);
      const cleanedBase = getCleanedCode(parsed.name);
      if (cleanedBase) {
        const ext = parsed.ext || '.jpg';
        const fallbackPath = path.resolve(URUNLER_DIR, `${cleanedBase}${ext}`);
        if (fallbackPath.startsWith(URUNLER_DIR) && fs.existsSync(fallbackPath)) {
          finalPath = fallbackPath;
          exists = true;
        }
      }
    }

    // Dosya diskte yoksa 404 dön (tarayıcı önbelleklemesini kesinlikle kapat)
    if (!exists) {
      return new Response('Görsel bulunamadı', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    const stat = await fs.promises.stat(finalPath);
    if (!stat.isFile()) {
      return new Response('Geçersiz dosya', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // ETag ve 304 Not Modified kontrolü
    const etag = `W/"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
    const ifNoneMatch = request.headers.get('if-none-match');

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Last-Modified': stat.mtime.toUTCString(),
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
        }
      });
    }

    const fileBuffer = await fs.promises.readFile(finalPath);
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'image/jpeg';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'ETag': etag,
        'Last-Modified': stat.mtime.toUTCString(),
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      }
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Görsel Sunucu Hatası:', errorMsg);
    return new Response('Sunucu hatası: ' + errorMsg, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
