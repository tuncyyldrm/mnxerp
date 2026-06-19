import { NextResponse } from 'next/server';
import * as sql from 'mssql';
import { getDbConnection } from '@/app/lib/db';

export async function GET(request: Request) {
    // URL'den detayKodu parametresini al
    const { searchParams } = new URL(request.url);
    const detayKodu = searchParams.get('detayKodu');

    // Parametre kontrolü
    if (!detayKodu) {
        return NextResponse.json({ error: 'Detay kodu gerekli' }, { status: 400 });
    }

    try {
        // Veritabanı havuzuna bağlan
        const pool = await getDbConnection();

        // Prosedürü çalıştır
        const result = await pool.request()
            .input('DetayKodu', sql.NVarChar, detayKodu)
            .execute('sp_UrunHareketAnaliz');

        // Sonuçları döndür
        return NextResponse.json(result.recordset, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store' // Stok hareketleri anlık olduğu için cache'lemeyelim
            }
        });
    } catch (err: any) {
        console.error("Stok Hareket API Hatası:", err.message);
        return NextResponse.json({ 
            error: "Hareket analizi alınamadı", 
            details: err.message 
        }, { status: 500 });
    }
}