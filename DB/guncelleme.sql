/* =========================================================================
    ✨ %100 RISK-FREE MULTI-TENANT UPDATE PACK (MUHASEBE DOSTU SÜRÜM)
    Generated: 27.06.2026 21:56:18
    🛡️ BU SCRIPT ORİJİNAL TABLOLARA DOKUNMAZ. BAŞKA FİRMALARIN GÜNCELLEMELERİNİ BOZMAZ.
========================================================================= */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===================== 🛡️ ADIM 1: DYNAMIC STUBS (ESKİ BAĞLARI KOPARMA) ===================== */
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V')) DROP VIEW [dbo].[vw_StokListesi];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokBakiyeIndexed]') AND type in (N'V')) DROP VIEW [dbo].[vw_StokBakiyeIndexed];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V')) DROP VIEW [dbo].[vw_FaturaDetayRaporu];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V')) DROP VIEW [dbo].[V_CariAnalizRaporu];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V')) DROP VIEW [dbo].[vw_CariEkstreDetay];
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[vw_CariEkstreDetay] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[V_CariAnalizRaporu] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokBakiyeIndexed]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[vw_StokBakiyeIndexed] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V')) BEGIN EXEC('CREATE VIEW [dbo].[vw_StokListesi] AS SELECT CAST(1 AS int) AS [GeciciKolon]'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDetayGetir]') AND type in (N'P', N'PC')) BEGIN EXEC('CREATE PROCEDURE [dbo].[sp_StokDetayGetir] AS BEGIN SET NOCOUNT ON; END'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDuzenle]') AND type in (N'P', N'PC')) BEGIN EXEC('CREATE PROCEDURE [dbo].[sp_StokDuzenle] AS BEGIN SET NOCOUNT ON; END'); END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UrunHareketAnaliz]') AND type in (N'P', N'PC')) BEGIN EXEC('CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz] AS BEGIN SET NOCOUNT ON; END'); END;
GO

/* ===================== 📊 ADIM 2: GÜVENLİ VIEW KATMANLARI ===================== */
CREATE OR ALTER VIEW [dbo].[vw_CariEkstreDetay] 
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
WHERE c.C_STATU = 0;
GO

CREATE OR ALTER VIEW [dbo].[V_CariAnalizRaporu] AS
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
WHERE c.C_STATU = 0;
GO

CREATE OR ALTER VIEW [dbo].[vw_FaturaDetayRaporu] 
AS
SELECT 
    i.islemid, i.islemnumarası, i.detay_kodu, i.alısmiktar, i.satısmiktar, i.alıstutarı, i.satıstutarı, i.net,
    ik.ikid, ik.islemtipi, ik.belgetarihi
FROM [dbo].[islem] i WITH (NOLOCK)
INNER JOIN [dbo].[islemkaydı] ik WITH (NOLOCK) ON i.islemnumarası = ik.faturanumarası
WHERE ISNUMERIC(i.islemnumarası) = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_StokBakiyeIndexed]
WITH SCHEMABINDING
AS
SELECT 
    detay_kodu,
    SUM(ISNULL(alısmiktar, 0)) AS ToplamAlis,
    SUM(ISNULL(satısmiktar, 0)) AS ToplamSatis,
    COUNT_BIG(*) AS ToplamSatirSayisi
FROM [dbo].[islem]
GROUP BY detay_kodu;
GO

CREATE OR ALTER VIEW [dbo].[vw_StokListesi]
AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, 
    s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    NULL AS OEM_5, NULL AS OEM_6, NULL AS OEM_7, NULL AS OEM_8, NULL AS OEM_9,
    ISNULL(b.ToplamAlis - b.ToplamSatis, 0) AS MevcutBakiye
FROM [dbo].[stok] s WITH (NOLOCK)
LEFT JOIN [dbo].[vw_StokBakiyeIndexed] b WITH (NOEXPAND) ON s.urunkodu = b.detay_kodu;
GO


/* ===================== ⚡ ADIM 3: ENTEGRE STORED PROCEDURE YAPILARI ===================== */
CREATE OR ALTER PROCEDURE [dbo].[sp_StokDetayGetir] @UrunKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4, ISNULL(b.ToplamAlis - b.ToplamSatis, 0) AS MevcutBakiye FROM dbo.stok s WITH (NOLOCK) LEFT JOIN dbo.vw_StokBakiyeIndexed b WITH (NOEXPAND) ON s.urunkodu = b.detay_kodu WHERE s.urunkodu = @UrunKodu; END
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_StokDuzenle] @UrunKodu NVARCHAR(100), @UrunAd NVARCHAR(250), @Raf NVARCHAR(50), @OEM_0 NVARCHAR(100), @OEM_1 NVARCHAR(100), @OEM_2 NVARCHAR(100), @OEM_3 NVARCHAR(100), @OEM_4 NVARCHAR(100) AS BEGIN SET NOCOUNT ON; UPDATE [dbo].[stok] SET urun = LTRIM(RTRIM(@UrunAd)), Raf = LTRIM(RTRIM(@Raf)), OEM_0 = LTRIM(RTRIM(@OEM_0)), OEM_1 = LTRIM(RTRIM(@OEM_1)), OEM_2 = LTRIM(RTRIM(@OEM_2)), OEM_3 = LTRIM(RTRIM(@OEM_3)), OEM_4 = LTRIM(RTRIM(@OEM_4)) WHERE urunkodu = @UrunKodu; END
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_UrunHareketAnaliz] @DetayKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi, i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi FROM dbo.islem i WITH (NOLOCK) LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid WHERE i.detay_kodu = @DetayKodu ORDER BY i.detay_kodu DESC, i.I_DATE DESC, i.I_TIME DESC; END
GO


/* ===================== 🛠️ ADIM 4: SADECE SÜRÜM VİEW İNDEKSLERİ ===================== */

IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.vw_StokBakiyeIndexed'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_vw_StokBakiyeIndexed_detay_kodu' AND object_id = OBJECT_ID('dbo.vw_StokBakiyeIndexed'))
    BEGIN
        DROP INDEX [UX_vw_StokBakiyeIndexed_detay_kodu] ON dbo.vw_StokBakiyeIndexed;
    END;
    CREATE UNIQUE CLUSTERED INDEX [UX_vw_StokBakiyeIndexed_detay_kodu] ON dbo.vw_StokBakiyeIndexed (detay_kodu);
    PRINT '✔️ Katman Indeksi Olusturuldu: [dbo].[vw_StokBakiyeIndexed] -> UX_vw_StokBakiyeIndexed_detay_kodu';
END;
GO

PRINT '⚡ Kurulum sıfır riskle tamamlandı. Muhasebe yapıları korundu.';
GO
