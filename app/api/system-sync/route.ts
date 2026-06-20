import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { getDbConnection } from '@/app/lib/db';

const execPromise = util.promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secretKey = searchParams.get('key');
    const GUVENLIK_ANAHTARI = "MNXERP_2026_Beta_X4897";

    // SSE için Response Stream hazırlığı
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Tarayıcıya anlık mesaj gönderme fonksiyonu
    const sendProgress = async (status: 'loading' | 'success' | 'error', message: string, progress: number) => {
        const data = JSON.stringify({ status, message, progress });
        await writer.write(encoder.encode(`data: ${data}\n\n`));
    };

    // İşlemi arka planda asenkron başlatıyoruz
    (async () => {
        try {
            if (secretKey !== GUVENLIK_ANAHTARI) {
                await sendProgress('error', 'Yetkisiz erişim denemesi! Güvenlik anahtarı geçersiz.', 0);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 1: GIT PULL (Yazılım Güncelleme)
            // ----------------------------------------------------
            await sendProgress('loading', '⚙️ Aşama 1/3: GitHub sunucusundan yeni kodlar çekiliyor...', 15);
            
            try {
                const { stdout } = await execPromise('git pull origin main', { cwd: process.cwd() });
                let gitResult = stdout.includes('Already up to date.') 
                    ? "Kodlar zaten en güncel sürümde." 
                    : "Yeni kod değişiklikleri başarıyla yerel sunucuya indirildi.";
                
                await sendProgress('loading', `✅ Git Tamamlandı: ${gitResult}`, 40);
            } catch (gitError: any) {
                await sendProgress('error', `❌ Git Güncelleme Hatası! Yerel değişiklikleriniz çakışıyor olabilir veya Git şifre bekliyor. Detay: ${gitError?.message || gitError}`, 40);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 2: SQL DOSYASI KONTROLÜ
            // ----------------------------------------------------
            await sendProgress('loading', '⚙️ Aşama 2/3: Veritabanı güncelleme dosyası (guncelleme.sql) okunuyor...', 50);
            const sqlFilePath = path.join(process.cwd(), 'DB', 'guncelleme.sql');
            
            if (!fs.existsSync(sqlFilePath)) {
                await sendProgress('success', '🎉 Sistem Güncel! Güncellenecek yeni bir SQL scripti bulunmadı, kod güncellemesiyle işlem bitti.', 100);
                await writer.close();
                return;
            }

            const fullSqlScript = fs.readFileSync(sqlFilePath, 'utf8');
            const sqlQueries = fullSqlScript.split(/^\s*GO\s*$/im).map(q => q.trim()).filter(Boolean);

            if (sqlQueries.length === 0) {
                await sendProgress('success', '🎉 Sistem Güncel! SQL dosyası boş, kod güncellemesi başarıyla tamamlandı.', 100);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 3: SQL SORGULARININ SIRAYLA ÇALIŞTIRILMASI
            // ----------------------------------------------------
            await sendProgress('loading', `⚙️ Aşama 3/3: Veritabanı bağlantısı kuruluyor... Toplam ${sqlQueries.length} SQL bloğu işlenecek.`, 60);
            const pool = await getDbConnection();
            let basariliSorguSayisi = 0;

            for (let i = 0; i < sqlQueries.length; i++) {
                const temizSorgu = sqlQueries[i];
                // Yüzde hesaplama: %60 ile %95 arasını SQL sorgularına bölüyoruz
                const currentPercent = Math.round(60 + ((i + 1) / sqlQueries.length) * 35);
                
                await sendProgress('loading', `⚡ [${i + 1}/${sqlQueries.length}] SQL Bloğu çalıştırılıyor...`, currentPercent);
                
                try {
                    await pool.request().query(temizSorgu);
                    basariliSorguSayisi++;
                } catch (sqlStepError: any) {
                    await sendProgress('error', `❌ SQL Çalıştırma Hatası! [Sorgu Sırası: ${i + 1}] Detay: ${sqlStepError?.message}`, currentPercent);
                    await writer.close();
                    return;
                }
            }

            // Her şey bitti
            await sendProgress('success', `🎉 Sistem Tamamen Güncel! Kodlar yenilendi ve toplam ${basariliSorguSayisi} SQL bloğu veritabanına sorunsuz işlendi.`, 100);
            
        } catch (globalError: any) {
            await sendProgress('error', `❌ Kritik Sistem Hatası! Detay: ${globalError?.message || globalError}`, 0);
        } finally {
            await writer.close();
        }
    })();

    // SSE protokolü başlıkları ile response dönüyoruz
    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}