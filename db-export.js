const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
    user: 'sa',
    password: '2026',
    server: '127.0.0.1',
    database: 'ONEDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// =========================================================================
// 📦 %100 GERÇEK VE STATİK TAM GÖVDELER (LOKAL DB BOŞSA BİLE BUNLAR BASILIR)
// =========================================================================
const MASTER_SCHEMAS = {
    views: {
        vw_CariEkstreDetay: `CREATE VIEW [dbo].[vw_CariEkstreDetay] AS
SELECT 
    c.id AS CariID,
    c.kodu AS CariKodu,
    c.firma AS FirmaAdi,
    ik.ikid AS IslemNo,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS IslemTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CAST(ik.islemtipi AS NVARCHAR(100)) AS IslemTipi,
    CASE WHEN ISNULL(ik.BB_TL, 0) > 0 THEN ik.BB_TL ELSE ISNULL(ik.AB_TL, 0) END AS IslemTutari,
    CASE WHEN ISNULL(ik.BB_TL, 0) > 0 THEN 'B' ELSE 'A' END AS Yon
FROM [dbo].[islemkaydı] ik
INNER JOIN [dbo].[cari] c ON COALESCE(NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''), N'Bilinmeyen Cari') = c.firma
WHERE c.C_STATU = 0;`,

        V_CariAnalizRaporu: `CREATE VIEW [dbo].[V_CariAnalizRaporu] AS
SELECT 
    c.id,
    c.kodu,
    c.firma,
    COALESCE(NULLIF(LTRIM(RTRIM(c.sehir)), ''), 'BELİRTİLMEMİŞ') AS sehir,
    CASE 
        WHEN c.kodu LIKE '120%' THEN 'Müşteri (Alıcı)'
        WHEN c.kodu LIKE '320%' THEN 'Tedarikçi (Satıcı)'
        ELSE 'Diğer Cari'
    END AS CariTipi,
    ISNULL(c.BB_TL, 0) - ISNULL(c.AB_TL, 0) AS NetBakiyeTL,
    CASE WHEN c.email LIKE '%trendyol%' OR c.firma LIKE '%Trendyol%' THEN 'Trendyol' ELSE 'Doğal Piyasa' END AS Kanali,
    COALESCE((SELECT MAX(ekstre.IslemTarihi) FROM [dbo].[vw_CariEkstreDetay] ekstre WHERE ekstre.CariID = c.id), c.ilkdate, GETDATE()) AS SonIslemTarihi,
    CASE 
        WHEN (ISNULL(c.BB_TL, 0) - ISNULL(c.AB_TL, 0)) > 0 THEN
            DATEDIFF(DAY, COALESCE((SELECT MAX(ekstre.IslemTarihi) FROM [dbo].[vw_CariEkstreDetay] ekstre WHERE ekstre.CariID = c.id), c.ilkdate, GETDATE()), GETDATE())
        ELSE 0
    END AS GecikmeGunSayisi
FROM [dbo].[cari] c
WHERE c.C_STATU = 0;`,

        vw_FaturaDetayRaporu: `CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS
SELECT 
    ik.ikid AS IslemNo,
    CAST(COALESCE(NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''), CASE WHEN ISNULL(i.kasaid, 0) > 1 THEN k.kasa_ack END, CASE WHEN i.kasaid = 1 OR (ISNULL(i.kasaid, 0) = 0 AND ISNULL(i.bankaid, 0) = 0 AND i.Cariid = 1) THEN N'MERKEZ KASA / CARİ HAREKETİ' END, CASE WHEN ISNULL(i.bankaid, 0) > 0 THEN b.banka + ' - ' + b.sube END, CASE WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN N'İÇ TRANSFER HAREKETİ' WHEN ik.islemtipi IN ('NT', 'NÖ') THEN N'KASA HAREKETİ' ELSE N'Sistem Virman Satırı' END) AS NVARCHAR(255)) AS CariAdi,
    CAST(CASE WHEN ik.islemtipi IN ('SF', 'PS', 'WBS', 'SÖSA') THEN 'SF' WHEN ik.islemtipi IN ('AF', 'MG') THEN 'AF' WHEN ik.islemtipi IN ('NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT') THEN 'NT' WHEN ik.islemtipi IN ('NÖ', 'GIDHE', 'KKO', 'BTE', 'KKTED', 'KÖ') THEN 'NÖ' WHEN ik.islemtipi IN ('PSI', 'MTAİ') THEN 'PSI' WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN 'VRM' WHEN ik.islemtipi = 'S' THEN 'SF' WHEN ik.islemtipi = 'A' THEN 'AF' ELSE ISNULL(ik.islemtipi, 'DIĞER') END AS NVARCHAR(100)) AS IslemTipi,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS FaturaTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CASE WHEN ISNULL(ik.AB_TL, 0) > 0 THEN ik.AB_TL ELSE ISNULL(ik.BB_TL, 0) END AS FaturaToplamTutar,
    COALESCE(NULLIF(CAST(ack.I_NOTE AS NVARCHAR(MAX)), ''), N'İçerik detayları için tıklayın') AS FaturaNotu,
    i.islemid AS SatirId,
    COALESCE(NULLIF(CAST(i.detay AS NVARCHAR(255)), ''), N'Tanımsız Satır/Hizmet/Virman') AS UrunAdi,
    COALESCE(NULLIF(CAST(i.detay_kodu AS NVARCHAR(100)), '-') AS StokKodu,
    COALESCE(NULLIF(CAST(i.birim AS NVARCHAR(50)), ''), N'ADET') AS Birim,
    ISNULL(i.birimfiyat, 0) AS BirimFiyat, ISNULL(i.kdvoranı, 0) AS KdvOrani, ISNULL(i.kdv, 0) AS KdvTutari,        
    CASE WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN ISNULL(i.alıstutarı, 0) / i.alısmiktar WHEN ISNULL(i.satısmiktar, 0) <> 0 THEN ISNULL(i.satıstutarı, 0) / i.satısmiktar ELSE ISNULL(i.birimfiyat, 0) END AS KdvDahilBirimFiyat,
    CASE WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN i.alısmiktar ELSE ISNULL(i.satısmiktar, 0) END AS Miktar,
    CAST(CASE WHEN ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN', 'BÇ', 'BY', 'MSF', 'DG', 'DC') THEN ISNULL(i.satıstutarı, 0) ELSE COALESCE(NULLIF(i.satıstutarı, 0), i.alıstutarı, 0) END AS DECIMAL(18,4)) AS SatirTutarı
FROM [dbo].[islem] i
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
LEFT JOIN [dbo].[kasa] k ON i.kasaid = k.kasaid 
LEFT JOIN [dbo].[banka] b ON i.bankaid = b.id 
LEFT JOIN [dbo].[islemkaydı_ack] ack ON ik.ikid = ack.IK_ID AND (ack.SR = 0 OR ack.SR IS NULL)
WHERE i.islemid IS NOT NULL AND (ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN') OR ISNULL(i.alısmiktar, 0) <> 0 OR ISNULL(i.satısmiktar, 0) <> 0 OR ISNULL(i.alıstutarı, 0) <> 0 OR ISNULL(i.satıstutarı, 0) <> 0 OR ISNULL(i.net, 0) <> 0);`,

        vw_StokListesi: `CREATE VIEW [dbo].[vw_StokListesi] AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kategori, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    NULL AS OEM_5, NULL AS OEM_6, NULL AS OEM_7, NULL AS OEM_8, NULL AS OEM_9,
    ISNULL(bakiye.ToplamBakiye, 0) AS MevcutBakiye
FROM [dbo].[stok] s WITH (NOLOCK)
OUTER APPLY (
    SELECT SUM(ISNULL(i.alısmiktar, 0) - ISNULL(i.satısmiktar, 0)) AS ToplamBakiye
    FROM [dbo].[islem] i WITH (NOLOCK)
    WHERE i.detay_kodu = s.urunkodu
) AS bakiye;`
    },
    procedures: {
        sp_StokDetayGetir: `CREATE PROCEDURE dbo.sp_StokDetayGetir @UrunKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kategori, s.tipi, s.Raf, s.fiyatı, s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4, ISNULL(b.ToplamBakiye, 0) AS MevcutBakiye FROM dbo.stok s WITH (NOLOCK) OUTER APPLY (SELECT SUM(i.alısmiktar - i.satısmiktar) AS ToplamBakiye FROM dbo.islem i WITH (NOLOCK) WHERE i.detay_kodu = s.urunkodu) b WHERE s.urunkodu = @UrunKodu; END`,
        sp_StokDuzenle: `CREATE PROCEDURE [dbo].[sp_StokDuzenle] @UrunKodu NVARCHAR(100), @UrunAd NVARCHAR(250), @Raf NVARCHAR(50), @OEM_0 NVARCHAR(100), @OEM_1 NVARCHAR(100), @OEM_2 NVARCHAR(100), @OEM_3 NVARCHAR(100), @OEM_4 NVARCHAR(100) AS BEGIN SET NOCOUNT ON; UPDATE [dbo].[stok] SET urun = LTRIM(RTRIM(@UrunAd)), Raf = LTRIM(RTRIM(@Raf)), OEM_0 = LTRIM(RTRIM(@OEM_0)), OEM_1 = LTRIM(RTRIM(@OEM_1)), OEM_2 = LTRIM(RTRIM(@OEM_2)), OEM_3 = LTRIM(RTRIM(@OEM_3)), OEM_4 = LTRIM(RTRIM(@OEM_4)) WHERE urunkodu = @UrunKodu; END`,
        sp_UrunHareketAnaliz: `CREATE PROCEDURE dbo.sp_UrunHareketAnaliz @DetayKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi, i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi FROM dbo.islem i WITH (NOLOCK) LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid WHERE i.detay_kodu = @DetayKodu ORDER BY i.I_DATE DESC, i.I_TIME DESC; END`
    }
};

const DB = {
    views: ['vw_CariEkstreDetay', 'V_CariAnalizRaporu', 'vw_FaturaDetayRaporu', 'vw_StokListesi'],
    procedures: ['sp_StokDetayGetir', 'sp_StokDuzenle', 'sp_UrunHareketAnaliz'],
    // 🛠️ HEAP TARAMALARI (NULL SCAN) VE ARTIŞ GÖSTEREN INDEXLER BURADA %100 COVERING DURUMA GETİRİLDİ
    indexes: [
        { name: 'IX_IslemKaydi_Covering_Amor', table: 'islemkaydı', cols: 'ikid', include: 'id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL' },
        { name: 'IX_Islem_IslemNumarasi_Covering', table: 'islem', cols: 'islemnumarası', include: 'islemid,detay,detay_kodu,birim,birimfiyat,kdvoranı,kdv,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net' },
        { name: 'IX_Islem_DetayKodu_Bakiye_Optimize', table: 'islem', cols: 'detay_kodu, I_DATE, I_TIME', include: 'alısmiktar,satısmiktar,I_TYPE,birimfiyat,depo,ikid_bag' },
        { name: 'IX_Stok_B2B_Search_Optimize', table: 'stok', cols: 'urunkodu', include: 'urun,urunalt,ureticifirma,grubu,kategori,tipi,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4' },
        { name: 'IX_Stok_Urun_Arama', table: 'stok', cols: 'urun', include: 'urunkodu,fiyatı,STK_FULL,Raf,grubu' },
        { name: 'IX_Stok_Filtreleme_Master', table: 'stok', cols: 'grubu, kategori, tipi', include: 'urunkodu,urun,fiyatı,STK_FULL,Raf' },
        { name: 'IX_Stok_OEM_Search', table: 'stok', cols: 'OEM', include: 'urunkodu,urun' },
        
        // 🎯 ERP Canlı Test Sonuçlarına Göre Eklenen / Optimize Edilen Kritik Yapılar:
        { name: 'IX_CARI_STATU_ID', table: 'cari', cols: 'C_STATU', include: 'id, kodu, firma, email, sehir, BB_TL, AB_TL, ilkdate' }, // 61->73 Tırmanan Scan'i Bitiren Yapı
        { name: 'IX_STOK_ARAMA_MASTER', table: 'stok', cols: 'urun', include: 'urunkodu, urunalt, ureticifirma, grubu, kategori, tipi, Raf, fiyatı, STK_FULL, OEM' } // 18->25 Tırmanan Scan'i Bitiren Yapı
    ],
    // 🛡️ Dükkanlardaki Düzensiz NULL (Heap Scan) Yapısını Kökten Yıkacak Clustered Index Yapılandırmaları
    clusteredKeys: [
        { name: 'PK_cari_id', table: 'cari', col: 'id' },
        { name: 'PK_kasa_id', table: 'kasa', col: 'kasaid' },
        { name: 'PK_banka_id', table: 'banka', col: 'id' }
    ]
};

// =========================================================================
// SCRIPT YAPICI YARDIMCILARI
// =========================================================================
function safeAlterView(def) {
    return def.replace(/CREATE\s+VIEW/i, 'ALTER VIEW').replace(/WITH\s+SCHEMABINDING/i, '');
}

function safeAlterProc(def) {
    return def.replace(/CREATE\s+PROCEDURE/i, 'ALTER PROCEDURE').replace(/CREATE\s+PROC/i, 'ALTER PROCEDURE');
}

function buildIndex(ix) {
    const includeStr = ix.include ? `INCLUDE (${ix.include})` : '';
    return `
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.${ix.table}') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='${ix.name}' AND object_id = OBJECT_ID('dbo.${ix.table}'))
    BEGIN
        DROP INDEX [${ix.name}] ON dbo.${ix.table};
    END;
    CREATE NONCLUSTERED INDEX [${ix.name}] ON dbo.${ix.table} (${ix.cols}) ${includeStr};
END;
GO\n`;
}

function buildClusteredKey(pk) {
    return `
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.${pk.table}') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE type = 'PK' AND object_id = OBJECT_ID('dbo.${pk.table}'))
    BEGIN
        -- Tablo yığın (Heap) durumundaysa Primary Key atılarak fiziksel olarak sıralanır ve Table Scan engellenir.
        ALTER TABLE [dbo].[${pk.table}] ADD CONSTRAINT [${pk.name}] PRIMARY KEY CLUSTERED ([${pk.col}] ASC);
        PRINT '✔️ Clustered PK Enjekte Edildi: [dbo].[${pk.table}] -> ${pk.name}';
    END;
END;
GO\n`;
}

// =========================================================================
// ANA ÇALIŞTIRICI
// =========================================================================
async function run() {
    let pool;
    let viewMap = {};
    let spMap = {};

    // Dinamik Mod denemesi (Lokal DB varsa oradaki canlı kodları çekmeye çalışır)
    try {
        pool = await sql.connect(config);
        const viewRes = await pool.request().query("SELECT o.name, sm.definition FROM sys.objects o LEFT JOIN sys.sql_modules sm ON sm.object_id = o.object_id WHERE o.type='V'");
        const spRes = await pool.request().query("SELECT o.name, sm.definition FROM sys.objects o LEFT JOIN sys.sql_modules sm ON sm.object_id = o.object_id WHERE o.type='P'");
        
        viewRes.recordset.forEach(v => { if(v.definition) viewMap[v.name] = v.definition; });
        spRes.recordset.forEach(p => { if(p.definition) spMap[p.name] = p.definition; });
        console.log('ℹ️ Yerel veritabanı aktif, şemalar dinamik olarak karşılaştırılıyor...');
    } catch (err) {
        console.log('⚠️ Yerel DB bağlantısı başarısız veya boş. %100 Statik Master şemalar kullanılacak.');
    }

    let script = `/* =========================================================================
    ✨ %100 SIFIR KURULUM VE GÜNCELLEME UYUMLU OTOMATİK ÜRETİLEN SCRIPT
    Generated: ${new Date().toLocaleString('tr-TR')}
    🛡️ Akıllı Dinamik Taslak (Dyna-Stub) Mimarisi & Index Koruması Aktiftir.
========================================================================= */

SET NOCOUNT ON;
GO

/* ===================== 🛡️ ADIM 1: STRUCTURAL CLUSTERED KEYS (HEAP CANAVARI ÖNLEYİCİ) ===================== */
-- Tablolarda Primary Key olmamasından kaynaklanan tüm NULL Table Scan yükünü tamamen yok eder.
\n`;

    // 0. ADIM: TABLOLARDAKİ HEAP DURUMUNU YIKACAK CLUSTERED ANAHTARLARI BAS
    for (const pk of DB.clusteredKeys) {
        script += buildClusteredKey(pk);
    }

    script += `\n/* ===================== 🛡️ ADIM 2: DYNAMIC STUBS (İLK KURULUM DESTEĞİ) ===================== */
-- Hedef DB sıfırsa (İlk Kurulum) ALTER komutlarının patlamaması için hafif taslaklar oluşturulur.
-- Nesneler dükkanda zaten varsa bu adım pas geçilir, mevcut kodlar asla silinmez!
\n`;

    // 1. ADIM: EĞER HEDEFTE NESNE YOKSA (İLK KURULUM) KÖR TASLAK ATILIR (BÖYCE ALTER GÖVDESİ PATLAMAZ)
    for (const v of DB.views) {
        script += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[${v}] AS SELECT CAST(1 AS int) AS [GeciciKolon]');
END;
GO\n`;
    }

    for (const p of DB.procedures) {
        script += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${p}]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[${p}] AS BEGIN SET NOCOUNT ON; END');
END;
GO\n`;
    }

    // 2. ADIM: TAM GÖVDELERİ BASTIĞIMIZ ALAN (HEM İLK KURULUMDA HEM GÜNCELLEMEDE ÇALIŞIR)
    script += `\n/* ===================== 📊 ADIM 3: VIEW GÜNCELLEMELERİ (ALTER) ===================== */\n`;
    for (const v of DB.views) {
        // Öncelik yerel veritabanındaki kodda, eğer lokal boşsa MASTER_SCHEMAS içerisindeki tam dolu kod basılır!
        const rawDef = viewMap[v] || MASTER_SCHEMAS.views[v];
        script += safeAlterView(rawDef).trim() + '\nGO\n\n';
    }

    script += `\n/* ===================== ⚡ ADIM 4: STORED PROCEDURE GÜNCELLEMELERİ ===================== */\n`;
    for (const p of DB.procedures) {
        const rawDef = spMap[p] || MASTER_SCHEMAS.procedures[p];
        script += safeAlterProc(rawDef).trim() + '\nGO\n\n';
    }

    // 3. ADIM: HIGH PERFORMANCE INDEXES
    script += `\n/* ===================== 🛠️ ADIM 5: HIGH-PERFORMANCE INDEXES ===================== */\n`;
    for (const ix of DB.indexes) {
        script += buildIndex(ix);
    }

    script += `\nPRINT '⚡ Kurulum/Güncelleme başarıyla tamamlandı. Plan hafızası sıfırlanıyor...';\nDBCC FREEPROCCACHE;\nGO\n`;

    // Dosyaya Yazma Aşaması
    const dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    fs.writeFileSync(path.join(dir, 'guncelleme.sql'), script, 'utf8');
    console.log('✅ HEM İLK KURULUM HEM GÜNCELLEME UYUMLU %100 ENTEGRE VE DOLU SQL SCRIPT ÜRETİLDİ.');
    
    if (pool) await sql.close();
}

run().catch(err => { console.error('❌ HATA:', err.message); });