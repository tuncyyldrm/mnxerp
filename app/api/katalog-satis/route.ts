import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db'; 
import * as sql from 'mssql';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const { 
            cariId,     // Seçilen müşterinin ID'si
            cariAdi,    // Seçilen müşterinin adı
            urunAdi,    // Katalogtaki ürünün adı
            stokKodu,   // Katalogtaki ürünün kodu
            miktar,     // Satılacak adet
            birimFiyat, // KDV Hariç fiyat
            kdvOrani = 20, 
            birim = 'ADET' 
        } = body;

        // Sayısal değerleri güvenli hale getirmek için JavaScript tarafında temizliyoruz
        const parsedCariId = parseInt(cariId, 10);
        
        // Gelen değerlerin Türkçe tarayıcı formatında (virgüllü) olma ihtimaline karşı noktaya çevirip parse ediyoruz
        const cleanedMiktar = typeof miktar === 'string' ? parseFloat(miktar.replace(',', '.')) : parseFloat(miktar);
        const cleanedBirimFiyat = typeof birimFiyat === 'string' ? parseFloat(birimFiyat.replace(',', '.')) : parseFloat(birimFiyat);
        const parsedKdvOrani = parseInt(kdvOrani, 10);

        if (!cariId || isNaN(parsedCariId) || !cariAdi || !urunAdi || isNaN(cleanedMiktar) || isNaN(cleanedBirimFiyat)) {
            return NextResponse.json(
                { success: false, error: "Müşteri seçimi geçersiz veya zorunlu alanlar boş geçilemez." }, 
                { status: 400 }
            );
        }

        const pool = await getDbConnection();
        const req = new sql.Request(pool);

        // 🚀 PARAMETRELERİ PROSEDÜR TİPLERİYLE (FLOAT) EŞLİYORUZ
        req.input('CariId', sql.Int, parsedCariId);
        req.input('CariAdi', sql.NVarChar(255), cariAdi);
        req.input('UrunAdi', sql.NVarChar(255), urunAdi);
        req.input('StokKodu', sql.NVarChar(100), stokKodu || '-');
        req.input('Miktar', sql.Float, cleanedMiktar);             // 🚀 sql.Decimal yerine sql.Float yaptık
        req.input('BirimFiyat', sql.Float, cleanedBirimFiyat);     // 🚀 sql.Decimal yerine sql.Float yaptık
        req.input('KdvOrani', sql.Int, parsedKdvOrani);
        req.input('Birim', sql.NVarChar(50), birim);

        const result = await req.execute('dbo.sp_KatalogtanSatisEkle');
        
        const output = result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;

        if (output && (output.Success === 1 || output.success === 1)) {
            return NextResponse.json({
                success: true,
                message: output.Message || output.message,
                islemNo: output.IslemNo || output.islemNo
            });
        } else {
            return NextResponse.json(
                { success: false, error: output?.Message || output?.message || "SQL işlemi sırasında bir hata oluştu." }, 
                { status: 500 }
            );
        }

    } catch (err: any) {
        console.error("API Hatası (Katalog Satış):", err.message);
        return NextResponse.json(
            { success: false, error: `Sunucu Hatası: ${err.message}` }, 
            { status: 500 }
        );
    }
}