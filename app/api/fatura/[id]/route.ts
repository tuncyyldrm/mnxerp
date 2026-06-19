import { NextResponse } from 'next/server';
import { getDbConnection } from '@/app/lib/db';
import * as sql from 'mssql';

interface RouteParams {
    params: Promise<{ id?: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const resolvedParams = await params;
        const { searchParams } = new URL(request.url);

        // 1. Parametreleri Yakala
        const idFromQuery = searchParams.get('id');
        const islemNoParam = (idFromQuery || resolvedParams.id || '').trim();
        const islemTipi = searchParams.get('tip') || '';
        
        // Sağ panel akordeonunun ayırt edici parametresi mi yoksa yeni tam sayfa döküm mü?
        const isPanelRequest = searchParams.get('panel') === 'true' || request.url.includes('islemId=');

        // 2. Sayısal Kontrol
        const islemNo = parseInt(islemNoParam, 10);

        if (!islemNoParam || isNaN(islemNo)) {
            return NextResponse.json(
                { success: false, error: "Geçersiz veya eksik İşlem Numarası." }, 
                { status: 400 }
            );
        }

        const pool = await getDbConnection();
        const req = new sql.Request(pool);

        // 3. MSSQL Sorgusu
        req.input('islemNo', sql.Int, islemNo);
        let queryStr = `
            SELECT * FROM [dbo].[vw_FaturaDetayRaporu] 
            WHERE IslemNo = @islemNo
        `;

        if (islemTipi) {
            req.input('islemTipi', sql.NVarChar, islemTipi);
            queryStr += ` AND IslemTipi = @islemTipi`;
        }

        const result = await req.query(queryStr);

        // 4. Veri yoksa güvenli çıkış yap
        if (!result.recordset || result.recordset.length === 0) {
            // Sağ panel doğrudan [] bekler, yeni sayfa nesne yapısı bekler
            if (isPanelRequest) return NextResponse.json([]);
            return NextResponse.json({ success: false, error: "Belge bulunamadı." }, { status: 404 });
        }

        // İlk satırdan faturanın üst (Header) bilgilerini alıyoruz (Çünkü her satırda CariAdi, BelgeNo ortaktır)
        const ilkSatir = result.recordset[0];

        // 5. Satır verilerini frontend modeline (camelCase uyumlu) map'le
        const gecerliSatirlar = result.recordset
            .filter((row: any) => row.SatirId !== null && (row.UrunAdi || row.Urunadi))
            .map((row: any) => ({
                satirId: Number(row.SatirId || row.satirId || 0),
                urunAdi: row.UrunAdi || row.Urunadi || 'Tanımsız Ürün',
                stokKodu: row.StokKodu || row.Stokkodu || '-',
                birim: row.Birim || row.birim || 'ADET',
                miktar: Number(row.Miktar || row.miktar || 0),
                birimFiyat: Number(row.BirimFiyat || row.Birimfiyat || 0),
                kdvOrani: row.KdvOrani !== undefined ? Number(row.KdvOrani) : Number(row.Kdvorani || 0),
                kdvTutari: row.KdvTutari !== undefined ? Number(row.KdvTutari) : Number(row.Kdvtutari || 0),
                kdvDahilBirimFiyat: row.KdvDahilBirimFiyat !== undefined ? Number(row.KdvDahilBirimFiyat) : Number(row.Kdvdahilbirimfiyat || 0),
                satirTutari: row.SatirTutarı !== undefined ? Number(row.SatirTutarı) : Number(row.Satirtutari || row.Tutar || 0)
            }));

        // Faturanın toplam genel tutarını hesapla (Matbu kayıt yoksa satırlardan derive etsin)
        const toplamHesaplananTutar = gecerliSatirlar.reduce((acc, curr) => acc + curr.satirTutari, 0);

        // 6. ÇİFT YÖNLÜ ÇIKIŞ STRATEJİSİ
        // Eğer istek eski sağ panel akordeonundan geldiyse saf dizi (array) fırlatıyoruz:
        if (isPanelRequest) {
            // Sağ panel PascalCase bekliyorsa uyumluluk için:
            const pascalSatirlar = gecerliSatirlar.map(s => ({
                UrunAdi: s.urunAdi,
                StokKodu: s.stokKodu,
                Birim: s.birim,
                Miktar: s.miktar,
                BirimFiyat: s.birimFiyat,
                KdvOrani: s.kdvOrani,
                KdvTutari: s.kdvTutari,
                KdvDahilBirimFiyat: s.kdvDahilBirimFiyat,
                SatirTutarı: s.satirTutari
            }));
            return NextResponse.json(pascalSatirlar);
        }

        // Yeni tam ekran FaturaIzlemePage sayfası için beklenen anatomik nesne (Object):
        return NextResponse.json({
            success: true,
            data: {
                islemNo: islemNo,
                cariAdi: ilkSatir.CariAdi || ilkSatir.Cariadi || ilkSatir.Unvan || "Bilinmeyen Cari",
                islemTipi: ilkSatir.IslemTipi || ilkSatir.Islemtipi || "BELGE",
                faturaTarihi: ilkSatir.IslemTarihi || ilkSatir.FaturaTarihi || ilkSatir.Tarih || new Date().toISOString(),
                belgeNo: ilkSatir.BelgeNo || ilkSatir.Belgeno || "-",
                faturaToplamTutar: Number(ilkSatir.FaturaToplamTutar || ilkSatir.GenelToplam || toplamHesaplananTutar),
                faturaNotu: ilkSatir.FaturaNotu || ilkSatir.Acıklama || ilkSatir.Aciklama || "",
                satirlar: gecerliSatirlar
            }
        });

    } catch (err: any) {
        console.error("API SORGULAMA HATASI:", err.message);
        
        // Hata durumunda da akıllı davranıyoruz
        return NextResponse.json(
            { 
                success: false, 
                error: `Sunucu Hatası: ${err.message}`,
                // Geriye dönük sağ panel akordeon patlamasın diye ek:
                data: { satirlar: [] } 
            },
            { status: 500 }
        );
    }
}