import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { getDbConnection } from '@/app/lib/db';

const execPromise = util.promisify(exec);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secretKey = searchParams.get('key');
    const GUVENLIK_ANAHTARI = "MNXERP_2026_Beta_X4897";

    if (secretKey !== GUVENLIK_ANAHTARI) {
        return NextResponse.json({ error: 'Yetkisiz erişim denemesi!' }, { status: 401 });
    }

    let gitLog = "";
    let sqlLog = "";

    try {
        // ==========================================
        // ADIM 1: GITHUB KOD GÜNCELLEME (GIT PULL)
        // ==========================================
        try {
            const { stdout } = await execPromise('git pull origin main', {
                cwd: process.cwd()
            });
            gitLog = stdout.includes('Already up to date.') 
                ? "Kodlar zaten en güncel sürümde." 
                : "Yeni kod değişiklikleri başarıyla çekildi.";
        } catch (gitError: any) {
            // Git hatası kritik olabilir (örn: internet yok veya çakışma var), işlemi durduruyoruz
            return NextResponse.json({ 
                success: false, 
                error: 'Yazılım Güncelleme (Git) Hatası!', 
                details: gitError?.message || gitError 
            }, { status: 500 });
        }

        // ==========================================
        // ADIM 2: VERİTABANI SENKRONİZASYONU (SQL)
        // ==========================================
        const sqlFilePath = path.join(process.cwd(), 'DB', 'guncelleme.sql');
        
        if (!fs.existsSync(sqlFilePath)) {
            // Eğer yeni kodlarda sql dosyası yoksa veya silindiyse sadece git sonucunu dönelim
            return NextResponse.json({ 
                success: true, 
                gitStatus: gitLog,
                sqlStatus: "guncelleme.sql dosyası bulunamadı, SQL güncellemesi atlandı.",
                message: `${gitLog} Ancak güncellenecek SQL dosyası tespit edilemedi.`
            });
        }

        const fullSqlScript: string = fs.readFileSync(sqlFilePath, 'utf8');
        const sqlQueries: string[] = fullSqlScript.split(/^\s*GO\s*$/im);

        const pool = await getDbConnection();
        let basariliSorguSayisi = 0;

        for (const queryText of sqlQueries) {
            const temizSorgu = queryText.trim();
            if (temizSorgu) {
                await pool.request().query(temizSorgu);
                basariliSorguSayisi++;
            }
        }

        sqlLog = `Veritabanı senkronize edildi. ${basariliSorguSayisi} SQL bloğu çalıştırıldı.`;

        // Hem Git hem SQL başarıyla bitti
        return NextResponse.json({ 
            success: true, 
            gitStatus: gitLog,
            sqlStatus: sqlLog,
            message: `Sistem tamamen güncellendi! ${gitLog} ve ${sqlLog}`
        });

    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: 'SQL Güncelleme Hatası!', 
            details: error?.message || error,
            gitStatus: gitLog // Hangi aşamada patladığını anlamak için git durumunu da yolluyoruz
        }, { status: 500 });
    }
}