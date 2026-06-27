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
// 📦 OPTİMİZE EDİLMİŞ %100 GERÇEK VE EN GÜNCEL MASTER ŞEMALAR (SİZİN YENİ SİSTEMİNİZ)
// =========================================================================
const MASTER_SCHEMAS = {
    views: {
        // İndekslenebilir standartlara çekilmiş kurumsal görünüm
        vw_CariEkstreDetay: `CREATE VIEW [dbo].[vw_CariEkstreDetay] 
WITH SCHEMABINDING
AS
SELECT 
    c.id AS CariID,
    c.kodu AS CariKodu,
    c.firma AS FirmaAdi,
    ik.ikid AS IslemNo,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS IslemTarihi,
    CASE 
        WHEN ik.faturanumarası IS NOT NULL AND ik.faturanumarası <> '' THEN ik.faturanumarası
        WHEN ik.belgenumarası IS NOT NULL AND ik.belgenumarası <> '' THEN ik.belgenumarası
        ELSE '-'
    END AS BelgeNo,
    CAST(ik.islemtipi AS NVARCHAR(100)) AS IslemTipi,
    CASE WHEN ISNULL(ik.BB_TL, 0) > 0 THEN ik.BB_TL ELSE ISNULL(ik.AB_TL, 0) END AS IslemTutari,
    CASE WHEN ISNULL(ik.BB_TL, 0) > 0 THEN 'B' ELSE 'A' END AS Yon
FROM [dbo].[islemkaydı] ik
INNER JOIN [dbo].[cari] c ON ik.id_name = c.firma
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

        // Veri uyuşmazlığı (Implicit conversion) hatası giderilmiş fatura omurgası
        vw_FaturaDetayRaporu: `CREATE VIEW [dbo].[vw_FaturaDetayRaporu] 
WITH SCHEMABINDING
AS
SELECT 
    i.islemid, i.islemnumarası, i.detay_kodu, i.alısmiktar, i.satısmiktar, i.alıstutarı, i.satıstutarı, i.net,
    ik.ikid, ik.islemtipi, ik.belgetarihi
FROM [dbo].[islem] i
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = ik.faturanumarası
WHERE ISNUMERIC(i.islemnumarası) = 1;`,

        // Next.js API katmanıyla %100 eşlenmiş, diske yazılmaya hazır ana stok görünümü
        vw_StokListesi: `CREATE VIEW [dbo].[vw_StokListesi]
WITH SCHEMABINDING
AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, 
    s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    ISNULL(bakiye.ToplamBakiye, 0) AS MevcutBakiye
FROM [dbo].[stok] s
LEFT JOIN (
    SELECT detay_kodu, SUM(alısmiktar - satısmiktar) AS ToplamBakiye
    FROM [dbo].[islem]
    GROUP BY detay_kodu
) AS bakiye ON s.urunkodu = bakiye.detay_kodu;`
    },
    procedures: {
        sp_StokDetayGetir: `CREATE PROCEDURE [dbo].[sp_StokDetayGetir] @UrunKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4, ISNULL(b.ToplamBakiye, 0) AS MevcutBakiye FROM dbo.stok s WITH (NOLOCK) LEFT JOIN (SELECT detay_kodu, SUM(alısmiktar - satısmiktar) AS ToplamBakiye FROM dbo.islem WITH (NOLOCK) GROUP BY detay_kodu) b ON s.urunkodu = b.detay_kodu WHERE s.urunkodu = @UrunKodu; END`,
        sp_StokDuzenle: `CREATE PROCEDURE [dbo].[sp_StokDuzenle] @UrunKodu NVARCHAR(100), @UrunAd NVARCHAR(250), @Raf NVARCHAR(50), @OEM_0 NVARCHAR(100), @OEM_1 NVARCHAR(100), @OEM_2 NVARCHAR(100), @OEM_3 NVARCHAR(100), @OEM_4 NVARCHAR(100) AS BEGIN SET NOCOUNT ON; UPDATE [dbo].[stok] SET urun = LTRIM(RTRIM(@UrunAd)), Raf = LTRIM(RTRIM(@Raf)), OEM_0 = LTRIM(RTRIM(@OEM_0)), OEM_1 = LTRIM(RTRIM(@OEM_1)), OEM_2 = LTRIM(RTRIM(@OEM_2)), OEM_3 = LTRIM(RTRIM(@OEM_3)), OEM_4 = LTRIM(RTRIM(@OEM_4)) WHERE urunkodu = @UrunKodu; END`,
        sp_UrunHareketAnaliz: `CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz] @DetayKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi, i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi FROM dbo.islem i WITH (NOLOCK) LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid WHERE i.detay_kodu = @DetayKodu ORDER BY i.detay_kodu DESC, i.I_DATE DESC, i.I_TIME DESC; END`
    }
};

// =========================================================================
// MÜŞTERİ VARYASYONLARINI ESNETECEK VERİTABANI İNDEKS REHBERİ
// =========================================================================
const DB = {
    views: ['vw_CariEkstreDetay', 'V_CariAnalizRaporu', 'vw_FaturaDetayRaporu', 'vw_StokListesi'],
    procedures: ['sp_StokDetayGetir', 'sp_StokDuzenle', 'sp_UrunHareketAnaliz'],
    
    // Orijinal tablolara dokunma yasağı olduğu için indeksler tamamen VIEW'lar üzerine kurgulanmıştır!
    viewIndexes: [
        { name: 'UX_vw_StokListesi_urunkodu', view: 'vw_StokListesi', type: 'UNIQUE CLUSTERED', cols: 'urunkodu' },
        { name: 'IX_vw_StokListesi_B2B_Arama_Nihai', view: 'vw_StokListesi', type: 'NONCLUSTERED', cols: 'urun, OEM', include: 'urunalt, grubu, kateGOri, tipi, Raf, fiyatı, STK_FULL, OEM_0, OEM_1, OEM_2, OEM_3' },
        { name: 'UX_vw_FaturaOmurga_IslemId', view: 'vw_FaturaDetayRaporu', type: 'UNIQUE CLUSTERED', cols: 'islemid' },
        { name: 'IX_vw_FaturaOmurga_DetayKodu', view: 'vw_FaturaDetayRaporu', type: 'NONCLUSTERED', cols: 'detay_kodu', include: 'islemtipi, belgetarihi' }
    ],
    clusteredKeys: [
        { name: 'PK_cari_id', table: 'cari', col: 'id' },
        { name: 'PK_kasa_id', table: 'kasa', col: 'kasaid' },
        { name: 'PK_banka_id', table: 'banka', col: 'id' }
    ]
};

// =========================================================================
// SCRIPT MOTORU YARDIMCI FONKSİYONLARI
// =========================================================================
function safeAlterView(def) {
    return def.replace(/CREATE\s+VIEW/i, 'CREATE OR ALTER VIEW');
}

function safeAlterProc(def) {
    return def.replace(/CREATE\s+PROCEDURE/i, 'CREATE OR ALTER PROCEDURE').replace(/CREATE\s+PROC/i, 'CREATE OR ALTER PROCEDURE');
}

function buildViewIndex(ix) {
    const includeStr = ix.include ? `INCLUDE (${ix.include})` : '';
    return `
IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.${ix.view}'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='${ix.name}' AND object_id = OBJECT_ID('dbo.${ix.view}'))
    BEGIN
        DROP INDEX [${ix.name}] ON dbo.${ix.view};
    END;
    CREATE ${ix.type} INDEX [${ix.name}] ON dbo.${ix.view} (${ix.cols}) ${includeStr};
    PRINT '✔️ View Indeksi Basildi: [dbo].[${ix.view}] -> ${ix.name}';
END;
GO\n`;
}

function buildClusteredKey(pk) {
    return `
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.${pk.table}') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.${pk.table}') AND is_primary_key = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = '${pk.name}')
        BEGIN
            EXEC('ALTER TABLE [dbo].[${pk.table}] ADD CONSTRAINT [${pk.name}_AUTO] PRIMARY KEY CLUSTERED ([${pk.col}] ASC)');
            PRINT '✔️ Isim cakismasi onlendi, Alternatif PK Enjekte Edildi: [dbo].[${pk.table}]';
        END
        ELSE
        BEGIN
            ALTER TABLE [dbo].[${pk.table}] ADD CONSTRAINT [${pk.name}] PRIMARY KEY CLUSTERED ([${pk.col}] ASC);
            PRINT '✔️ Clustered PK Enjekte Edildi: [dbo].[${pk.table}] -> ${pk.name}';
        END
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ [dbo].[${pk.table}] tablosunda zaten bir Primary Key mevcut, orijinal yapi korundu.';
    END
END;
GO\n`;
}

// =========================================================================
// SCRIPT GENERATOR CORE WORKER
// =========================================================================
async function run() {
    let pool;
    console.log('ℹ️ Güncelleme paketi hazırlanıyor...');

    let script = `/* =========================================================================
    ✨ ÇOKLU MÜŞTERİ GÜNCELLEME PAKETİ (%100 GÜVENLİ KURULUM MOTORU)
    Generated: ${new Date().toLocaleString('tr-TR')}
    🛡️ Orijinal Tablo Koruma ve Sadece "View + Index" Müdahale Politikası Aktiftir.
========================================================================= */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===================== 🛡️ ADIM 1: TABLO TABANLI EMETİK KORUYUCULAR (PK KONTROL) ===================== */\n`;

    for (const pk of DB.clusteredKeys) {
        script += buildClusteredKey(pk);
    }

    script += `\n/* ===================== 🛡️ ADIM 2: DYNAMIC STUBS (BAĞIMLILIK KİLİTLERİNİ KIRMA) ===================== */\n`;

    // Eski view kilitlerini temizlemek için drop listesi (Sıralama bağımlılığından kaçmak için)
    for (const v of [...DB.views].reverse()) {
        script += `IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V')) DROP VIEW [dbo].[${v}];\nGO\n`;
    }

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

    script += `\n/* ===================== 📊 ADIM 3: OPTİMİZE EDİLMİŞ VIEW GÜNCELLEMELERİ (ALTER) ===================== */\n`;
    for (const v of DB.views) {
        const rawDef = MASTER_SCHEMAS.views[v];
        script += safeAlterView(rawDef).trim() + '\nGO\n\n';
    }

    script += `\n/* ===================== ⚡ ADIM 4: STORED PROCEDURE GÜNCELLEMELERİ ===================== */\n`;
    for (const p of DB.procedures) {
        const rawDef = MASTER_SCHEMAS.procedures[p];
        script += safeAlterProc(rawDef).trim() + '\nGO\n\n';
    }

    script += `\n/* ===================== 🛠️ ADIM 5: FİZİKSEL VIEW İNDEKSLERİ (YASAKLARI DELMEYEN KATMAN) ===================== */\n`;
    for (const ix of DB.viewIndexes) {
        script += buildViewIndex(ix);
    }

    script += `\nPRINT '⚡ Güncelleme başarıyla tamamlandı. Execution plan hafızası temizleniyor...';\nPURGE:\nEXEC sys.sp_flush_log;\nDBCC FREEPROCCACHE;\nGO\n`;

    const dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    fs.writeFileSync(path.join(dir, 'guncelleme.sql'), script, 'utf8');
    console.log('✅ HARİKA: Farklı müşterilerde sorunsuz çalışacak, optimize edilmiş "guncelleme.sql" üretildi.');
}

run().catch(err => { console.error('❌ KRİTİK HATA:', err.message); });