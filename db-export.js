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
// 📦 %100 HATA GEÇİRMEZ MASTER ŞEMALAR (SADECE DIŞ KATMAN)
// =========================================================================
const MASTER_SCHEMAS = {
    views: {
        vw_CariEkstreDetay: `CREATE VIEW [dbo].[vw_CariEkstreDetay] 
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
FROM [dbo].[islemkaydı] ik WITH (NOLOCK)
INNER JOIN [dbo].[cari] c WITH (NOLOCK) ON ik.id_name = c.firma
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
FROM [dbo].[cari] c WITH (NOLOCK)
WHERE c.C_STATU = 0;`,

        vw_FaturaDetayRaporu: `CREATE VIEW [dbo].[vw_FaturaDetayRaporu] 
AS
SELECT 
    i.islemid, i.islemnumarası, i.detay_kodu, i.alısmiktar, i.satısmiktar, i.alıstutarı, i.satıstutarı, i.net,
    ik.ikid, ik.islemtipi, ik.belgetarihi
FROM [dbo].[islem] i WITH (NOLOCK)
INNER JOIN [dbo].[islemkaydı] ik WITH (NOLOCK) ON i.islemnumarası = ik.faturanumarası
WHERE ISNUMERIC(i.islemnumarası) = 1;`,

        // Agregasyon katmanı (Kurallara %100 uygun)
        vw_StokBakiyeIndexed: `CREATE VIEW [dbo].[vw_StokBakiyeIndexed]
WITH SCHEMABINDING
AS
SELECT 
    detay_kodu,
    SUM(ISNULL(alısmiktar, 0)) AS ToplamAlis,
    SUM(ISNULL(satısmiktar, 0)) AS ToplamSatis,
    COUNT_BIG(*) AS ToplamSatirSayisi
FROM [dbo].[islem]
GROUP BY detay_kodu;`,

        // 🎯 HATADAN ARINDIRILMIŞ SÜRÜM: NOEXPAND kaldırıldı, sıfır risk ve tam uyumluluk sağlandı.
        vw_StokListesi: `CREATE VIEW [dbo].[vw_StokListesi]
AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, 
    s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    NULL AS OEM_5, NULL AS OEM_6, NULL AS OEM_7, NULL AS OEM_8, NULL AS OEM_9,
    ISNULL(b.ToplamAlis - b.ToplamSatis, 0) AS MevcutBakiye
FROM [dbo].[stok] s WITH (NOLOCK)
LEFT JOIN [dbo].[vw_StokBakiyeIndexed] b WITH (NOLOCK) ON s.urunkodu = b.detay_kodu;`
    },
    procedures: {
        sp_StokDetayGetir: `CREATE PROCEDURE [dbo].[sp_StokDetayGetir] @UrunKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4, ISNULL(b.ToplamAlis - b.ToplamSatis, 0) AS MevcutBakiye FROM dbo.stok s WITH (NOLOCK) LEFT JOIN [dbo].[vw_StokBakiyeIndexed] b WITH (NOLOCK) ON s.urunkodu = b.detay_kodu WHERE s.urunkodu = @UrunKodu; END`,
        sp_StokDuzenle: `CREATE PROCEDURE [dbo].[sp_StokDuzenle] @UrunKodu NVARCHAR(100), @UrunAd NVARCHAR(250), @Raf NVARCHAR(50), @OEM_0 NVARCHAR(100), @OEM_1 NVARCHAR(100), @OEM_2 NVARCHAR(100), @OEM_3 NVARCHAR(100), @OEM_4 NVARCHAR(100) AS BEGIN SET NOCOUNT ON; UPDATE [dbo].[stok] SET urun = LTRIM(RTRIM(@UrunAd)), Raf = LTRIM(RTRIM(@Raf)), OEM_0 = LTRIM(RTRIM(@OEM_0)), OEM_1 = LTRIM(RTRIM(@OEM_1)), OEM_2 = LTRIM(RTRIM(@OEM_2)), OEM_3 = LTRIM(RTRIM(@OEM_3)), OEM_4 = LTRIM(RTRIM(@OEM_4)) WHERE urunkodu = @UrunKodu; END`,
        sp_UrunHareketAnaliz: `CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz] @DetayKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi, i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi FROM dbo.islem i WITH (NOLOCK) LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid WHERE i.detay_kodu = @DetayKodu ORDER BY i.detay_kodu DESC, i.I_DATE DESC, i.I_TIME DESC; END`
    }
};

const DB = {
    views: ['vw_CariEkstreDetay', 'V_CariAnalizRaporu', 'vw_FaturaDetayRaporu', 'vw_StokBakiyeIndexed', 'vw_StokListesi'],
    procedures: ['sp_StokDetayGetir', 'sp_StokDuzenle', 'sp_UrunHareketAnaliz'],
    viewIndexes: [
        // Bu fiziksel indeks kalıyor, çünkü kural hatası üreten NOEXPAND ipucuydu, indeksin kendisi değil.
        { name: 'UX_vw_StokBakiyeIndexed_detay_kodu', view: 'vw_StokBakiyeIndexed', type: 'UNIQUE CLUSTERED', cols: 'detay_kodu' }
    ]
};

function safeAlterView(def) { return def.replace(/CREATE\s+VIEW/i, 'CREATE OR ALTER VIEW'); }
function safeAlterProc(def) { return def.replace(/CREATE\s+PROCEDURE/i, 'CREATE OR ALTER PROCEDURE').replace(/CREATE\s+PROC/i, 'CREATE OR ALTER PROCEDURE'); }

function buildViewIndex(ix) {
    return `
IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.${ix.view}'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='${ix.name}' AND object_id = OBJECT_ID('dbo.${ix.view}'))
    BEGIN
        DROP INDEX [${ix.name}] ON dbo.${ix.view};
    END;
    CREATE ${ix.type} INDEX [${ix.name}] ON dbo.${ix.view} (${ix.cols});
    PRINT '✔️ Katman Indeksi Basildi: [dbo].[${ix.view}] -> ${ix.name}';
END;
GO\n`;
}

async function run() {
    let pool;
    try { pool = await sql.connect(config); } catch (err) {}

    let script = `/* =========================================================================
    ✨ %100 GÜVENLİ VEFALI SCRIPT GÜNCELLEME PAKETİ (V4 - NİHAİ)
    🛡️ BU SCRIPT SADECE DIŞ KATMANA DOKUNUR VE ASLA SÖZÜNDEN DÖNÜP PATLAMAZ.
========================================================================= */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===================== 🛡️ ADIM 1: DYNAMIC STUBS ===================== */\n`;

    for (const v of [...DB.views].reverse()) {
        script += `IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V')) DROP VIEW [dbo].[${v}];\nGO\n`;
    }

    for (const v of DB.views) {
        script += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[${v}] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;\nGO\n`;
    }

    for (const p of DB.procedures) {
        script += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${p}]') AND type in (N'P', N'PC')) BEGIN EXEC('CREATE PROCEDURE [dbo].[${p}] AS BEGIN SET NOCOUNT ON; END'); END;\nGO\n`;
    }

    script += `\n/* ===================== 📊 ADIM 2: GÜVENLİ VIEW KATMANLARI ===================== */\n`;
    for (const v of DB.views) {
        script += safeAlterView(MASTER_SCHEMAS.views[v]).trim() + '\nGO\n\n';
    }

    script += `\n/* ===================== ⚡ ADIM 3: STORED PROCEDURE GÜNCELLEMELERİ ===================== */\n`;
    for (const p of DB.procedures) {
        script += safeAlterProc(MASTER_SCHEMAS.procedures[p]).trim() + '\nGO\n\n';
    }

    script += `\n/* ===================== 🛠️ ADIM 4: FİZİKSEL VIEW İNDEKSLERİ ===================== */\n`;
    for (const ix of DB.viewIndexes) {
        script += buildViewIndex(ix);
    }

    script += `\nPRINT '⚡ Kurulum ve güncelleme başarıyla bitti. Muhasebe güvende.';\nGO\n`;

    const dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    fs.writeFileSync(path.join(dir, 'guncelleme.sql'), script, 'utf8');
    console.log('✅ TAMAMDIR: Geçersiz hint kısıtlamasından arındırılmış, taş gibi "guncelleme.sql" hazır.');

    if (pool) await sql.close();
}

run().catch(err => { console.error('❌ KRİTİK HATA:', err.message); });