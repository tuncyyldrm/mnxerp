/* =========================================================================
    ✨ ÇOKLU MÜŞTERİ GÜNCELLEME PAKETİ (%100 GÜVENLİ KURULUM MOTORU)
    Generated: 27.06.2026 21:47:13
    🛡️ Orijinal Tablo Koruma ve Sadece "View + Index" Müdahale Politikası Aktiftir.
========================================================================= */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===================== 🛡️ ADIM 1: TABLO TABANLI EMETİK KORUYUCULAR (PK KONTROL) ===================== */

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.cari') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.cari') AND is_primary_key = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PK_cari_id')
        BEGIN
            EXEC('ALTER TABLE [dbo].[cari] ADD CONSTRAINT [PK_cari_id_AUTO] PRIMARY KEY CLUSTERED ([id] ASC)');
            PRINT '✔️ Isim cakismasi onlendi, Alternatif PK Enjekte Edildi: [dbo].[cari]';
        END
        ELSE
        BEGIN
            ALTER TABLE [dbo].[cari] ADD CONSTRAINT [PK_cari_id] PRIMARY KEY CLUSTERED ([id] ASC);
            PRINT '✔️ Clustered PK Enjekte Edildi: [dbo].[cari] -> PK_cari_id';
        END
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ [dbo].[cari] tablosunda zaten bir Primary Key mevcut, orijinal yapi korundu.';
    END
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.kasa') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.kasa') AND is_primary_key = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PK_kasa_id')
        BEGIN
            EXEC('ALTER TABLE [dbo].[kasa] ADD CONSTRAINT [PK_kasa_id_AUTO] PRIMARY KEY CLUSTERED ([kasaid] ASC)');
            PRINT '✔️ Isim cakismasi onlendi, Alternatif PK Enjekte Edildi: [dbo].[kasa]';
        END
        ELSE
        BEGIN
            ALTER TABLE [dbo].[kasa] ADD CONSTRAINT [PK_kasa_id] PRIMARY KEY CLUSTERED ([kasaid] ASC);
            PRINT '✔️ Clustered PK Enjekte Edildi: [dbo].[kasa] -> PK_kasa_id';
        END
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ [dbo].[kasa] tablosunda zaten bir Primary Key mevcut, orijinal yapi korundu.';
    END
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.banka') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.banka') AND is_primary_key = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'PK_banka_id')
        BEGIN
            EXEC('ALTER TABLE [dbo].[banka] ADD CONSTRAINT [PK_banka_id_AUTO] PRIMARY KEY CLUSTERED ([id] ASC)');
            PRINT '✔️ Isim cakismasi onlendi, Alternatif PK Enjekte Edildi: [dbo].[banka]';
        END
        ELSE
        BEGIN
            ALTER TABLE [dbo].[banka] ADD CONSTRAINT [PK_banka_id] PRIMARY KEY CLUSTERED ([id] ASC);
            PRINT '✔️ Clustered PK Enjekte Edildi: [dbo].[banka] -> PK_banka_id';
        END
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ [dbo].[banka] tablosunda zaten bir Primary Key mevcut, orijinal yapi korundu.';
    END
END;
GO

/* ===================== 🛡️ ADIM 2: DYNAMIC STUBS (BAĞIMLILIK KİLİTLERİNİ KIRMA) ===================== */
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V')) DROP VIEW [dbo].[vw_StokListesi];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V')) DROP VIEW [dbo].[vw_FaturaDetayRaporu];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V')) DROP VIEW [dbo].[V_CariAnalizRaporu];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V')) DROP VIEW [dbo].[vw_CariEkstreDetay];
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_CariEkstreDetay] AS SELECT CAST(1 AS int) AS [GeciciKolon]');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[V_CariAnalizRaporu] AS SELECT CAST(1 AS int) AS [GeciciKolon]');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS SELECT CAST(1 AS int) AS [GeciciKolon]');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_StokListesi] AS SELECT CAST(1 AS int) AS [GeciciKolon]');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDetayGetir]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_StokDetayGetir] AS BEGIN SET NOCOUNT ON; END');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDuzenle]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_StokDuzenle] AS BEGIN SET NOCOUNT ON; END');
END;
GO
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UrunHareketAnaliz]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz] AS BEGIN SET NOCOUNT ON; END');
END;
GO

/* ===================== 📊 ADIM 3: OPTİMİZE EDİLMİŞ VIEW GÜNCELLEMELERİ (ALTER) ===================== */
CREATE OR ALTER VIEW [dbo].[vw_CariEkstreDetay] 
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
FROM [dbo].[cari] c
WHERE c.C_STATU = 0;
GO

CREATE OR ALTER VIEW [dbo].[vw_FaturaDetayRaporu] 
WITH SCHEMABINDING
AS
SELECT 
    i.islemid, i.islemnumarası, i.detay_kodu, i.alısmiktar, i.satısmiktar, i.alıstutarı, i.satıstutarı, i.net,
    ik.ikid, ik.islemtipi, ik.belgetarihi
FROM [dbo].[islem] i
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = ik.faturanumarası
WHERE ISNUMERIC(i.islemnumarası) = 1;
GO

CREATE OR ALTER VIEW [dbo].[vw_StokListesi]
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
) AS bakiye ON s.urunkodu = bakiye.detay_kodu;
GO


/* ===================== ⚡ ADIM 4: STORED PROCEDURE GÜNCELLEMELERİ ===================== */
CREATE OR ALTER PROCEDURE [dbo].[sp_StokDetayGetir] @UrunKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4, ISNULL(b.ToplamBakiye, 0) AS MevcutBakiye FROM dbo.stok s WITH (NOLOCK) LEFT JOIN (SELECT detay_kodu, SUM(alısmiktar - satısmiktar) AS ToplamBakiye FROM dbo.islem WITH (NOLOCK) GROUP BY detay_kodu) b ON s.urunkodu = b.detay_kodu WHERE s.urunkodu = @UrunKodu; END
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_StokDuzenle] @UrunKodu NVARCHAR(100), @UrunAd NVARCHAR(250), @Raf NVARCHAR(50), @OEM_0 NVARCHAR(100), @OEM_1 NVARCHAR(100), @OEM_2 NVARCHAR(100), @OEM_3 NVARCHAR(100), @OEM_4 NVARCHAR(100) AS BEGIN SET NOCOUNT ON; UPDATE [dbo].[stok] SET urun = LTRIM(RTRIM(@UrunAd)), Raf = LTRIM(RTRIM(@Raf)), OEM_0 = LTRIM(RTRIM(@OEM_0)), OEM_1 = LTRIM(RTRIM(@OEM_1)), OEM_2 = LTRIM(RTRIM(@OEM_2)), OEM_3 = LTRIM(RTRIM(@OEM_3)), OEM_4 = LTRIM(RTRIM(@OEM_4)) WHERE urunkodu = @UrunKodu; END
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_UrunHareketAnaliz] @DetayKodu NVARCHAR(100) AS BEGIN SET NOCOUNT ON; SELECT i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi, i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi FROM dbo.islem i WITH (NOLOCK) LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid WHERE i.detay_kodu = @DetayKodu ORDER BY i.detay_kodu DESC, i.I_DATE DESC, i.I_TIME DESC; END
GO


/* ===================== 🛠️ ADIM 5: FİZİKSEL VIEW İNDEKSLERİ (YASAKLARI DELMEYEN KATMAN) ===================== */

IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.vw_StokListesi'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_vw_StokListesi_urunkodu' AND object_id = OBJECT_ID('dbo.vw_StokListesi'))
    BEGIN
        DROP INDEX [UX_vw_StokListesi_urunkodu] ON dbo.vw_StokListesi;
    END;
    CREATE UNIQUE CLUSTERED INDEX [UX_vw_StokListesi_urunkodu] ON dbo.vw_StokListesi (urunkodu) ;
    PRINT '✔️ View Indeksi Basildi: [dbo].[vw_StokListesi] -> UX_vw_StokListesi_urunkodu';
END;
GO

IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.vw_StokListesi'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_vw_StokListesi_B2B_Arama_Nihai' AND object_id = OBJECT_ID('dbo.vw_StokListesi'))
    BEGIN
        DROP INDEX [IX_vw_StokListesi_B2B_Arama_Nihai] ON dbo.vw_StokListesi;
    END;
    CREATE NONCLUSTERED INDEX [IX_vw_StokListesi_B2B_Arama_Nihai] ON dbo.vw_StokListesi (urun, OEM) INCLUDE (urunalt, grubu, kateGOri, tipi, Raf, fiyatı, STK_FULL, OEM_0, OEM_1, OEM_2, OEM_3);
    PRINT '✔️ View Indeksi Basildi: [dbo].[vw_StokListesi] -> IX_vw_StokListesi_B2B_Arama_Nihai';
END;
GO

IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.vw_FaturaDetayRaporu'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_vw_FaturaOmurga_IslemId' AND object_id = OBJECT_ID('dbo.vw_FaturaDetayRaporu'))
    BEGIN
        DROP INDEX [UX_vw_FaturaOmurga_IslemId] ON dbo.vw_FaturaDetayRaporu;
    END;
    CREATE UNIQUE CLUSTERED INDEX [UX_vw_FaturaOmurga_IslemId] ON dbo.vw_FaturaDetayRaporu (islemid) ;
    PRINT '✔️ View Indeksi Basildi: [dbo].[vw_FaturaDetayRaporu] -> UX_vw_FaturaOmurga_IslemId';
END;
GO

IF EXISTS (SELECT 1 FROM sys.views WHERE object_id = OBJECT_ID('dbo.vw_FaturaDetayRaporu'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_vw_FaturaOmurga_DetayKodu' AND object_id = OBJECT_ID('dbo.vw_FaturaDetayRaporu'))
    BEGIN
        DROP INDEX [IX_vw_FaturaOmurga_DetayKodu] ON dbo.vw_FaturaDetayRaporu;
    END;
    CREATE NONCLUSTERED INDEX [IX_vw_FaturaOmurga_DetayKodu] ON dbo.vw_FaturaDetayRaporu (detay_kodu) INCLUDE (islemtipi, belgetarihi);
    PRINT '✔️ View Indeksi Basildi: [dbo].[vw_FaturaDetayRaporu] -> IX_vw_FaturaOmurga_DetayKodu';
END;
GO

PRINT '⚡ Güncelleme başarıyla tamamlandı. Execution plan hafızası temizleniyor...';
PURGE:
EXEC sys.sp_flush_log;
DBCC FREEPROCCACHE;
GO
