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

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendProgress = async (status: 'loading' | 'success' | 'error', message: string, progress: number) => {
        const data = JSON.stringify({ status, message, progress });
        await writer.write(encoder.encode(`data: ${data}\n\n`));
    };

    (async () => {
        try {
            if (secretKey !== GUVENLIK_ANAHTARI) {
                await sendProgress('error', 'Yetkisiz erişim denemesi! Güvenlik anahtarı geçersiz.', 0);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 1: DOĞRULAMA VE GÜNCELLEME (FORCE RESET & PULL)
            // ----------------------------------------------------
            await sendProgress('loading', '⚙️ Aşama 1/3: Dosya bütünlüğü doğrulanıyor ve GitHub ile senkronize ediliyor...', 15);
            
            try {
                // Önce GitHub'daki güncel ağacı çekiyoruz
                await execPromise('git fetch origin main', { cwd: process.cwd() });
                
                // Silinen veya değişen tüm dosyaları GitHub'daki orijinal haline zorla geri getiriyoruz!
                const { stdout } = await execPromise('git reset --hard origin/main', { cwd: process.cwd() });
                
                await sendProgress('loading', `✅ Dosya Doğrulama Tamamlandı: Silinen/değişen dosyalar onarıldı. Orijinal sürüme eşitlendi.`, 40);
            } catch (gitError: any) {
                await sendProgress('error', `❌ Git Doğrulama Hatası! İnternet bağlantısını veya kimlik bilgilerini kontrol edin. Detay: ${gitError?.message || gitError}`, 40);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 2: SQL DOSYASI KONTROLÜ (Artık silindiyse bile yukarıda geri geldi!)
            // ----------------------------------------------------
            await sendProgress('loading', '⚙️ Aşama 2/3: Veritabanı güncelleme dosyası (guncelleme.sql) okunuyor...', 50);
            const sqlFilePath = path.join(process.cwd(), 'DB', 'guncelleme.sql');
            
            if (!fs.existsSync(sqlFilePath)) {
                await sendProgress('success', '🎉 Sistem Güncel! Onarılan dosyalarda `guncelleme.sql` bulunamadı. Kodlar başarıyla orijinal haline getirildi.', 100);
                await writer.close();
                return;
            }

            const fullSqlScript = fs.readFileSync(sqlFilePath, 'utf8');
            const sqlQueries = fullSqlScript.split(/^\s*GO\s*$/im).map(q => q.trim()).filter(Boolean);

            if (sqlQueries.length === 0) {
                await sendProgress('success', '🎉 Sistem Güncel! SQL dosyası içeriği boş, kodlar başarıyla doğrulandı.', 100);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 3: SQL SORGULARININ ÇALIŞTIRILMASI
            // ----------------------------------------------------
            await sendProgress('loading', `⚙️ Aşama 3/3: Veritabanı bağlantısı kuruluyor... Toplam ${sqlQueries.length} SQL bloğu işlenecek.`, 60);
            const pool = await getDbConnection();
            let basariliSorguSayisi = 0;

            for (let i = 0; i < sqlQueries.length; i++) {
                const temizSorgu = sqlQueries[i];
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

            await sendProgress('success', `🎉 Sistem Tamamen Onarıldı ve Güncellendi! Kod bütünlüğü sağlandı, silinen dosyalar getirildi ve ${basariliSorguSayisi} SQL bloğu işlendi.`, 100);
            
        } catch (globalError: any) {
            await sendProgress('error', `❌ Kritik Sistem Hatası! Detay: ${globalError?.message || globalError}`, 0);
        } finally {
            await writer.close();
        }
    })();

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}