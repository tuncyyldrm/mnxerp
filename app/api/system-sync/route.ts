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

    // Arka plandaki asenkron süreci yöneten ana gövde
    (async () => {
        let isDevMode = process.env.NODE_ENV === 'development';
        let basariliSorguSayisi = 0;

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
            if (isDevMode) {
                await sendProgress('loading', 'ℹ️ Yerel test ortamı (Dev Modu) algılandı. Build (Derleme) aşaması es geçiliyor...', 75);
            } else {
                await sendProgress('loading', '🛠️ Aşama 2/4: Yeni kodlar dükkan için optimize ediliyor (Build alınıyor). Bu işlem 30-40 sn sürebilir...', 50);
                try {
                    await execPromise('npm run build', { cwd: process.cwd() });
                    await sendProgress('loading', '✅ Proje başarıyla yeniden derlendi (Build tamam).', 75);
                } catch (buildError: any) {
                    await sendProgress('error', `❌ Build (Derleme) Hatası! Kodda syntax hatası veya eksik paket olabilir. Detay: ${buildError?.message || buildError}`, 75);
                    await writer.close();
                    return;
                }
            }

            // ----------------------------------------------------
            // AŞAMA 3: ÇOKLU SQL DOSYASI SENKRONİZASYONU 🛡️
            // ----------------------------------------------------
            await sendProgress('loading', '🗄️ Aşama 3/4: SQL scriptleri sıralı senkronizasyon için hazırlanıyor...', 80);
            
            // Veritabanı bağımlılık hatası (Dependency) oluşmaması için kesin derleme sırası:
            const sqlFiles = [
                'index.sql',               // Önce indexler temizlenip kurulur
                'vw_CariEkstreDetay.sql',  // Rapor görünümünün bağımlı olduğu kök view
                'V_CariAnalizRaporu.sql',  // vw_CariEkstreDetay'a bağımlı analiz view'ı
                'vw_FaturaDetayRaporu.sql',// Fatura rapor view'ı
                'vw_StokListesi.sql',      // Stok listesi view'ı
                'sp_StokDetayGetir.sql',   // Prosedürler
                'sp_StokDuzenle.sql',
                'sp_UrunHareketAnaliz.sql'
            ];

            const pool = await getDbConnection();

            for (const file of sqlFiles) {
                const sqlFilePath = path.join(process.cwd(), 'DB', file);

                if (fs.existsSync(sqlFilePath)) {
                    await sendProgress('loading', `⏳ [SQL] ${file} dosyası işleniyor...`, 82);
                    const fullSqlScript = fs.readFileSync(sqlFilePath, 'utf8');
                    
                    // Görünmez satır sonu (\r) karakterlerini temizle ve standartlaştır
                    const standardizedSql = fullSqlScript.replace(/\r\n/g, '\n');

                    // Satır başında ve sonunda tek başına izole duran GO komutlarını yakala
                    const sqlQueries = standardizedSql
                        .split(/(?:^|\n)\s*GO\s*(?:\n|$)/i)
                        .map(q => q.trim())
                        .filter(Boolean);

                    for (let i = 0; i < sqlQueries.length; i++) {
                        let singleQuery = sqlQueries[i];
                        
                        if (singleQuery.toUpperCase() === 'GO') continue;

                        try {
                            await pool.request().query(singleQuery);
                            basariliSorguSayisi++;
                        } catch (sqlStepError: any) {
                            const previewText = singleQuery.substring(0, 40).replace(/\n/g, ' ');
                            await sendProgress('error', `❌ SQL Hatası! [Dosya: ${file}] [Blok: ${i + 1}] (${previewText}...) Detay: ${sqlStepError?.message}`, 85);
                            await writer.close();
                            return;
                        }
                    }
                } else {
                    // Eğer kritik bir dosya klasörde fiziksel olarak yoksa süreci durdurup hata veriyoruz
                    await sendProgress('error', `❌ Kritik Dosya Eksik! DB/${file} bulunamadı.`, 80);
                    await writer.close();
                    return;
                }
            }
            
            await sendProgress('loading', `✅ Tüm SQL dosyaları başarıyla işlendi. Toplam ${basariliSorguSayisi} SQL bloğu çalıştırıldı.`, 90);

            // ----------------------------------------------------
            // AŞAMA 4: GÜVENLİ KAPATMA VE HOT RESTART HAZIRLIĞI
            // ----------------------------------------------------
            await sendProgress('loading', '🚀 Aşama 4/4: Sistem servisleri güncelleniyor, yeni sürüm devreye alınıyor...', 95);
            
            await sendProgress('success', `🎉 MNX ERP Başarıyla Güncellendi! Mod: ${isDevMode ? 'Geliştirme' : 'Üretim'}, ${basariliSorguSayisi} SQL bloğu işlendi.`, 100);
            await writer.close();

        } catch (globalError: any) {
            try {
                await sendProgress('error', `❌ Kritik Hata! Detay: ${globalError?.message || globalError}`, 0);
                await writer.close();
            } catch (e) {}
            return;
        }

        // İstemcinin veriyi tam alabilmesi için 3 saniye pay bırakıyoruz.
        setTimeout(async () => {
            try {
                if (isDevMode) {
                    console.log("⚡ [MNX DEV]: Yerel dev ortamı çalışıyor. Süreç sonlandırılmadı, teste devam edebilirsiniz.");
                    return;
                }

                const dynamicPm2Name = process.env.name || process.env.PM2_HOME;

                if (dynamicPm2Name && dynamicPm2Name !== 'false') {
                    console.log(`🔄 PM2 Ortamı Tespit Edildi (${process.env.name}). Servis yeniden başlatılıyor...`);
                    await execPromise(`pm2 reload "${process.env.name}"`);
                } else {
                    console.log("⚠️ PM2 süreç adı bulunamadı. Değişikliklerin devreye girmesi için süreç güvenli şekilde kapatılıyor (Exit 0)...");
                    process.exit(0);
                }
            } catch (restartError) {
                console.error("❌ Yeniden başlatma esnasında hata çıktı. Sert kapatma uygulanıyor (Exit 0).", restartError);
                process.exit(0);
            }
        }, 3000);

    })();

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}