import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
// Merkezi bağlantı havuzunu çağırıyoruz
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: NextRequest) {
    // 1. URL parametrelerinden güvenlik anahtarını alıyoruz
    const { searchParams } = new URL(request.url);
    const secretKey = searchParams.get('key');
    
    // Güçlü güvenlik anahtarı
    const GUVENLIK_ANAHTARI = "MemonexERP_2026_Beta_Token!X";

    if (secretKey !== GUVENLIK_ANAHTARI) {
        return NextResponse.json({ error: 'Yetkisiz erişim denemesi!' }, { status: 401 });
    }

    try {
        // 2. Kök dizindeki "DB/guncelleme.sql" yolunu buluyoruz
        const sqlFilePath = path.join(process.cwd(), 'DB', 'guncelleme.sql');
        
        if (!fs.existsSync(sqlFilePath)) {
            return NextResponse.json({ error: 'guncelleme.sql dosyası DB klasörü altında bulunamadı.' }, { status: 404 });
        }

        // SQL dosyasını UTF-8 formatında oku
        const fullSqlScript: string = fs.readFileSync(sqlFilePath, 'utf8');

        // 3. Scripti satır başı/sonu GO ifadelerinden blok blok dizilere bölüyoruz
        const sqlQueries: string[] = fullSqlScript.split(/^\s*GO\s*$/im);

        // 4. Global requestTimeout (5 dk) ayarlı kararlı havuzu çağırıyoruz
        const pool = await getDbConnection();
        let basariliSorguSayisi = 0;

        // 5. Her bir SQL bloğunu sırayla veritabanında execute et
        for (const queryText of sqlQueries) {
            const temizSorgu = queryText.trim();
            
            if (temizSorgu) {
                // Config'den 5 dakikalık requestTimeout otomatik miras alındığı için 
                // doğrudan temiz ve hatasız sorgu atabiliyoruz.
                await pool.request().query(temizSorgu);
                basariliSorguSayisi++;
            }
        }

        // pool.close() bilerek çağrılmadı, havuzun sürekliliği ve hızı korundu.

        return NextResponse.json({ 
            success: true, 
            message: `Veritabanı başarıyla senkronize edildi. Toplam ${basariliSorguSayisi} SQL bloğu çalıştırıldı.` 
        });

    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: 'SQL Güncelleme Hatası!', 
            details: error?.message || error 
        }, { status: 500 });
    }
}