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
            // AŞAMA 1: GIT DOĞRULAMA & KOD ÇEKME
            // ----------------------------------------------------
            await sendProgress('loading', '💾 Aşama 1/4: GitHub üzerinden en son kodlar çekiliyor ve doğrulanıyor...', 15);
            try {
                await execPromise('git fetch origin main', { cwd: process.cwd() });
                await execPromise('git reset --hard origin/main', { cwd: process.cwd() });
                await sendProgress('loading', '✅ Kod çekme işlemi başarılı. Dosya bütünlüğü sağlandı.', 30);
            } catch (gitError: any) {
                await sendProgress('error', `❌ Git Hatası! Detay: ${gitError?.message || gitError}`, 30);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 2: NEXT.JS YENİDEN BUILD (DERLEME)
            // ----------------------------------------------------
            await sendProgress('loading', '🛠️ Aşama 2/4: Yeni kodlar dükkan için optimize ediliyor (Build alınıyor). Bu işlem 30-40 sn sürebilir...', 50);
            try {
                // Projeyi üretim moduna göre yerelde derliyoruz
                await execPromise('npm run build', { cwd: process.cwd() });
                await sendProgress('loading', '✅ Proje başarıyla yeniden derlendi (Build tamam).', 75);
            } catch (buildError: any) {
                await sendProgress('error', `❌ Build (Derleme) Hatası! Kodda syntax hatası veya eksik paket olabilir. Detay: ${buildError?.message || buildError}`, 75);
                await writer.close();
                return;
            }

            // ----------------------------------------------------
            // AŞAMA 3: SQL VERİTABANI GÜNCELLEMESİ
            // ----------------------------------------------------
            await sendProgress('loading', '🗄️ Aşama 3/4: Veritabanı (guncelleme.sql) senkronize ediliyor...', 80);
            const sqlFilePath = path.join(process.cwd(), 'DB', 'guncelleme.sql');
            let basariliSorguSayisi = 0;

            if (fs.existsSync(sqlFilePath)) {
                const fullSqlScript = fs.readFileSync(sqlFilePath, 'utf8');
                const sqlQueries = fullSqlScript.split(/^\s*GO\s*$/im).map(q => q.trim()).filter(Boolean);

                if (sqlQueries.length > 0) {
                    const pool = await getDbConnection();
                    for (let i = 0; i < sqlQueries.length; i++) {
                        try {
                            await pool.request().query(sqlQueries[i]);
                            basariliSorguSayisi++;
                        } catch (sqlStepError: any) {
                            await sendProgress('error', `❌ SQL Hatası! [Sorgu: ${i + 1}] Detay: ${sqlStepError?.message}`, 85);
                            await writer.close();
                            return;
                        }
                    }
                }
            }
            await sendProgress('loading', `✅ SQL Senkronizasyonu tamamlandı. ${basariliSorguSayisi} SQL bloğu işlendi.`, 90);

            // ----------------------------------------------------
            // AŞAMA 4: PM2 RESTART VEYA GÜVENLİ ÇIŞIK (EXIT 0)
            // ----------------------------------------------------
            await sendProgress('loading', '🚀 Aşama 4/4: PM2/Sistem servisi güncelleniyor, yeni sürüm havada devreye alınıyor...', 95);
            
            // Son başarılı mesajını gönderip bağlantıyı kapatıyoruz ki tarayıcı askıda kalmasın
            await sendProgress('success', `🎉 MNX ERP Başarıyla Güncellendi! Kod bütünlüğü sağlandı, build alındı ve ${basariliSorguSayisi} SQL bloğu işlendi. Sistem aktif ediliyor...`, 100);
            await writer.close();

            // Tarayıcıya mesaj ulaştıktan 2 saniye sonra sistemi güvenli şekilde kapatıyoruz / yeniliyoruz
            setTimeout(async () => {
                try {
                    // PM2 ortam değişkenlerinden sürecin kendi adını dinamik olarak yakalıyoruz
                    const dynamicPm2Name = process.env.name;

                    if (dynamicPm2Name) {
                        console.log(`Dinamik PM2 ismi tespit edildi: ${dynamicPm2Name}. Yeniden başlatılıyor...`);
                        await execPromise(`pm2 restart "${dynamicPm2Name}"`);
                    } else {
                        // Eğer PM2 yoksa, sistem build'ı zaten başarıyla aldı ve SQL'i işledi.
                        // Süreci sonlandırıyoruz. Dükkandaki bir servis yöneticisi veya el ile tetiklemelerde
                        // projenin kilitlenmemesi için en güvenli fallback süreci sonlandırmaktır.
                        console.log("PM2 süreç adı bulunamadı. Değişikliklerin devreye girmesi için süreç güvenli şekilde sonlandırılıyor (Exit 0)...");
                        process.exit(0);
                    }
                } catch (restartError) {
                    console.log("Yeniden başlatma işlemi esnasında hata oluştu, process.exit(0) uygulanıyor.");
                    process.exit(0);
                }
            }, 2000);

        } catch (globalError: any) {
            await sendProgress('error', `❌ Kritik Hata! Detay: ${globalError?.message || globalError}`, 0);
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