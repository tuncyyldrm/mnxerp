-- ✨ Otomatik Üretilen Güvenli Güncelleme Scripti (20.06.2026 20:31:07)
-- ⚠️ Manuel düzenleme yapmayın, 'npm run db-pack' ile güncelleyin.
-- 🛡️ Dükkan veritabanları için "Akıllı Dinamik Taslak (Dyna-Stub)" mimarisi aktiftir.

-- ----------------------------------------------------
-- 🛡️ ÖN HAZIRLIK: EKSİK NESNELERİ AKILLI TASLAKLARLA ILK DEFA OLUŞTURMA
-- ----------------------------------------------------

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_CariEkstreDetay] AS SELECT CAST(NULL AS int) AS [CariID], CAST(NULL AS varchar(50)) AS [CariKodu], CAST(NULL AS varchar(500)) AS [FirmaAdi], CAST(NULL AS int) AS [IslemNo], CAST(NULL AS datetime) AS [IslemTarihi], CAST(NULL AS nvarchar(100)) AS [BelgeNo], CAST(NULL AS nvarchar(100)) AS [IslemTipi], CAST(NULL AS float) AS [IslemTutari], CAST(NULL AS varchar(1)) AS [Yon]');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[V_CariAnalizRaporu] AS SELECT CAST(NULL AS int) AS [id], CAST(NULL AS varchar(50)) AS [kodu], CAST(NULL AS varchar(500)) AS [firma], CAST(NULL AS varchar(50)) AS [sehir], CAST(NULL AS varchar(18)) AS [CariTipi], CAST(NULL AS float) AS [NetBakiyeTL], CAST(NULL AS varchar(12)) AS [Kanali], CAST(NULL AS datetime) AS [SonIslemTarihi], CAST(NULL AS int) AS [GecikmeGunSayisi]');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS SELECT CAST(NULL AS int) AS [IslemNo], CAST(NULL AS nvarchar(255)) AS [CariAdi], CAST(NULL AS nvarchar(100)) AS [IslemTipi], CAST(NULL AS datetime) AS [FaturaTarihi], CAST(NULL AS nvarchar(100)) AS [BelgeNo], CAST(NULL AS float) AS [FaturaToplamTutar], CAST(NULL AS nvarchar(max)) AS [FaturaNotu], CAST(NULL AS int) AS [SatirId], CAST(NULL AS nvarchar(255)) AS [UrunAdi], CAST(NULL AS nvarchar(100)) AS [StokKodu], CAST(NULL AS nvarchar(50)) AS [Birim], CAST(NULL AS float) AS [BirimFiyat], CAST(NULL AS int) AS [KdvOrani], CAST(NULL AS float) AS [KdvTutari], CAST(NULL AS float) AS [KdvDahilBirimFiyat], CAST(NULL AS float) AS [Miktar], CAST(NULL AS decimal) AS [SatirTutarı]');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V'))
BEGIN
    EXEC('CREATE VIEW [dbo].[vw_StokListesi] AS SELECT CAST(NULL AS varchar(300)) AS [urunkodu], CAST(NULL AS varchar(300)) AS [urun], CAST(NULL AS varchar(300)) AS [urunalt], CAST(NULL AS varchar(300)) AS [ureticifirma], CAST(NULL AS varchar(300)) AS [grubu], CAST(NULL AS varchar(300)) AS [kateGOri], CAST(NULL AS varchar(300)) AS [tipi], CAST(NULL AS varchar(50)) AS [Raf], CAST(NULL AS float) AS [fiyatı], CAST(NULL AS varchar(350)) AS [OEM], CAST(NULL AS float) AS [STK_FULL], CAST(NULL AS varchar(350)) AS [OEM_0], CAST(NULL AS varchar(350)) AS [OEM_1], CAST(NULL AS varchar(350)) AS [OEM_2], CAST(NULL AS varchar(350)) AS [OEM_3], CAST(NULL AS varchar(350)) AS [OEM_4], CAST(NULL AS int) AS [OEM_5], CAST(NULL AS int) AS [OEM_6], CAST(NULL AS int) AS [OEM_7], CAST(NULL AS int) AS [OEM_8], CAST(NULL AS int) AS [OEM_9], CAST(NULL AS float) AS [MevcutBakiye]');
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

-- ----------------------------------------------------
-- 📊 AŞAMA 1: VIEW GÜNCELLEMELERİ (ASIL GÖVDELER)
-- ----------------------------------------------------

-- ----------------------------------------------------
-- 📊 AŞAMA 1: VIEW GÜNCELLEMELERİ (ASIL GÖVDELER)
-- ----------------------------------------------------

-- 🔄 ÖNCE BU VIEW DERLENMELİ: Çünkü V_CariAnalizRaporu buradaki CariID ve IslemTarihi kolonlarına bağımlı!
ALTER VIEW [dbo].[vw_CariEkstreDetay] AS
SELECT 
    c.id AS CariID,
    c.kodu AS CariKodu,
    c.firma AS FirmaAdi,
    ik.ikid AS IslemNo,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS IslemTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CAST(ik.islemtipi AS NVARCHAR(100)) AS IslemTipi,
    CASE 
        WHEN ISNULL(ik.BB_TL, 0) > 0 THEN ik.BB_TL 
        ELSE ISNULL(ik.AB_TL, 0) 
    END AS IslemTutari,
    CASE 
        WHEN ISNULL(ik.BB_TL, 0) > 0 THEN 'B' 
        ELSE 'A' 
    END AS Yon
FROM [dbo].[islemkaydı] ik
INNER JOIN [dbo].[cari] c ON COALESCE(NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''), N'Bilinmeyen Cari') = c.firma
WHERE c.C_STATU = 0;
GO

-- 🔄 SONRA BU VIEW DERLENMELİ: Artık vw_CariEkstreDetay kolonları hazır olduğu için patlamaz.
ALTER VIEW [dbo].[V_CariAnalizRaporu] AS
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
    CASE 
        WHEN c.email LIKE '%trendyol%' OR c.firma LIKE '%Trendyol%' THEN 'Trendyol'
        ELSE 'Doğal Piyasa'
    END AS Kanali,
    
    COALESCE(
        (SELECT MAX(ekstre.IslemTarihi) 
         FROM [dbo].[vw_CariEkstreDetay] ekstre 
         WHERE ekstre.CariID = c.id), 
        c.ilkdate, 
        GETDATE()
    ) AS SonIslemTarihi,

    CASE 
        WHEN (ISNULL(c.BB_TL, 0) - ISNULL(c.AB_TL, 0)) > 0 THEN
            DATEDIFF(DAY, 
                COALESCE(
                    (SELECT MAX(ekstre.IslemTarihi) FROM [dbo].[vw_CariEkstreDetay] ekstre WHERE ekstre.CariID = c.id), 
                    c.ilkdate, 
                    GETDATE()
                ), 
                GETDATE()
            )
        ELSE 0
    END AS GecikmeGunSayisi
FROM [dbo].[cari] c
WHERE c.C_STATU = 0;
GO

ALTER VIEW [dbo].[vw_FaturaDetayRaporu] AS
SELECT 
    ik.ikid AS IslemNo,
    CAST(
        COALESCE(
            NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''),
            CASE WHEN ISNULL(i.kasaid, 0) > 1 THEN k.kasa_ack END,
            CASE WHEN i.kasaid = 1 OR (ISNULL(i.kasaid, 0) = 0 AND ISNULL(i.bankaid, 0) = 0 AND i.Cariid = 1) THEN N'MERKEZ KASA / CARİ HAREKETİ' END,
            CASE WHEN ISNULL(i.bankaid, 0) > 0 THEN b.banka + ' - ' + b.sube END,
            CASE 
                WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN N'İÇ TRANSFER HAREKETİ'
                WHEN ik.islemtipi IN ('NT', 'NÖ') THEN N'KASA HAREKETİ'
                ELSE N'Sistem Virman Satırı'
            END
        ) AS NVARCHAR(255)
    ) AS CariAdi,
    CAST(
        CASE 
            WHEN ik.islemtipi IN ('SF', 'PS', 'WBS', 'SÖSA') THEN 'SF'
            WHEN ik.islemtipi IN ('AF', 'MG') THEN 'AF'
            WHEN ik.islemtipi IN ('NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT') THEN 'NT'
            WHEN ik.islemtipi IN ('NÖ', 'GIDHE', 'KKO', 'BTE', 'KKTED', 'KÖ') THEN 'NÖ'
            WHEN ik.islemtipi IN ('PSI', 'MTAİ') THEN 'PSI'
            WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN 'VRM'
            WHEN ik.islemtipi = 'S' THEN 'SF'
            WHEN ik.islemtipi = 'A' THEN 'AF'
            ELSE ISNULL(ik.islemtipi, 'DIĞER')
        END AS NVARCHAR(100)
    ) AS IslemTipi,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS FaturaTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CASE 
        WHEN ISNULL(ik.AB_TL, 0) > 0 THEN ik.AB_TL 
        ELSE ISNULL(ik.BB_TL, 0) 
    END AS FaturaToplamTutar,
    COALESCE(NULLIF(CAST(ack.I_NOTE AS NVARCHAR(MAX)), ''), N'İçerik detayları için tıklayın') AS FaturaNotu,
    i.islemid AS SatirId,
    COALESCE(NULLIF(CAST(i.detay AS NVARCHAR(255)), ''), N'Tanımsız Satır/Hizmet/Virman') AS UrunAdi,
    COALESCE(NULLIF(CAST(i.detay_kodu AS NVARCHAR(100)), ''), '-') AS StokKodu,
    COALESCE(NULLIF(CAST(i.birim AS NVARCHAR(50)), ''), N'ADET') AS Birim,
    ISNULL(i.birimfiyat, 0) AS BirimFiyat, 
    ISNULL(i.kdvoranı, 0) AS KdvOrani,    
    ISNULL(i.kdv, 0) AS KdvTutari,        
    CASE 
        WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN ISNULL(i.alıstutarı, 0) / i.alısmiktar
        WHEN ISNULL(i.satısmiktar, 0) <> 0 THEN ISNULL(i.satıstutarı, 0) / i.satısmiktar
        ELSE ISNULL(i.birimfiyat, 0)
    END AS KdvDahilBirimFiyat,
    CASE 
        WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN i.alısmiktar 
        ELSE ISNULL(i.satısmiktar, 0) 
    END AS Miktar,
    CAST(
        CASE 
            WHEN ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN', 'BÇ', 'BY', 'MSF', 'DG', 'DC') THEN 
                ISNULL(i.satıstutarı, 0)
            ELSE
                COALESCE(NULLIF(i.satıstutarı, 0), i.alıstutarı, 0)
        END AS DECIMAL(18,4)
    ) AS SatirTutarı
FROM [dbo].[islem] i
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
LEFT JOIN [dbo].[kasa] k ON i.kasaid = k.kasaid 
LEFT JOIN [dbo].[banka] b ON i.bankaid = b.id 
LEFT JOIN [dbo].[islemkaydı_ack] ack ON ik.ikid = ack.IK_ID AND (ack.SR = 0 OR ack.SR IS NULL)
WHERE i.islemid IS NOT NULL 
  AND (
       ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN') 
       OR ISNULL(i.alısmiktar, 0) <> 0 OR ISNULL(i.satısmiktar, 0) <> 0 
       OR ISNULL(i.alıstutarı, 0) <> 0 OR ISNULL(i.satıstutarı, 0) <> 0 
       OR ISNULL(i.net, 0) <> 0
  );
GO

ALTER VIEW [dbo].[vw_StokListesi]
AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, 
    s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    NULL AS OEM_5, 
    NULL AS OEM_6, 
    NULL AS OEM_7, 
    NULL AS OEM_8, 
    NULL AS OEM_9,
    ISNULL(bakiye.ToplamBakiye, 0) AS MevcutBakiye
FROM [dbo].[stok] s WITH (NOLOCK)
OUTER APPLY (
    SELECT SUM(ISNULL(i.alısmiktar, 0) - ISNULL(i.satısmiktar, 0)) AS ToplamBakiye
    FROM [dbo].[islem] i WITH (NOLOCK)
    WHERE i.detay_kodu = s.urunkodu
) AS bakiye;
GO

-- ----------------------------------------------------
-- ⚡ AŞAMA 2: STORED PROCEDURE GÜNCELLEMELERİ (ASIL GÖVDELER)
-- ----------------------------------------------------

-- ----------------------------------------------------
-- ⚡ AŞAMA 2: STORED PROCEDURE GÜNCELLEMELERİ
-- ----------------------------------------------------

ALTER PROCEDURE dbo.sp_StokDetayGetir
    @UrunKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
        s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
        ISNULL(b.ToplamBakiye, 0) AS MevcutBakiye
    FROM dbo.stok s WITH (NOLOCK)
    OUTER APPLY (
        SELECT SUM(i.alısmiktar - i.satısmiktar) AS ToplamBakiye
        FROM dbo.islem i WITH (NOLOCK)
        WHERE i.detay_kodu = s.urunkodu
    ) b
    WHERE s.urunkodu = @UrunKodu;
END
GO

ALTER PROCEDURE [dbo].[sp_StokDuzenle]
    @UrunKodu NVARCHAR(100),
    @UrunAd NVARCHAR(250),
    @Raf NVARCHAR(50),
    @OEM_0 NVARCHAR(100),
    @OEM_1 NVARCHAR(100),
    @OEM_2 NVARCHAR(100),
    @OEM_3 NVARCHAR(100),
    @OEM_4 NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[stok]
    SET 
        urun  = LTRIM(RTRIM(@UrunAd)),
        Raf   = LTRIM(RTRIM(@Raf)),
        OEM_0 = LTRIM(RTRIM(@OEM_0)),
        OEM_1 = LTRIM(RTRIM(@OEM_1)),
        OEM_2 = LTRIM(RTRIM(@OEM_2)),
        OEM_3 = LTRIM(RTRIM(@OEM_3)),
        OEM_4 = LTRIM(RTRIM(@OEM_4))
    WHERE urunkodu = @UrunKodu;
END
GO

ALTER PROCEDURE dbo.sp_UrunHareketAnaliz
    @DetayKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        i.I_DATE AS Tarih, i.I_TIME AS Saat, i.I_TYPE AS IslemTipi, ik.id_name AS MusteriAdi,
        i.alısmiktar AS Giris, i.satısmiktar AS Cikis, i.birimfiyat AS BirimFiyat, i.depo AS DepoBilgisi
    FROM dbo.islem i WITH (NOLOCK)
    LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid
    WHERE i.detay_kodu = @DetayKodu
    ORDER BY i.I_DATE DESC, i.I_TIME DESC;
END
GO

-- ----------------------------------------------------
-- 🛠️ AŞAMA 3: INDEX OPTİMİZASYONLARI
-- ----------------------------------------------------

-- ⚡ Index: IX_IslemKaydi_Covering_Amor (Tablo: [dbo].[islemkaydı])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[islemkaydı]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_IslemKaydi_Covering_Amor' AND object_id = OBJECT_ID('[dbo].[islemkaydı]'))
    BEGIN
         DROP INDEX [IX_IslemKaydi_Covering_Amor] ON [dbo].[islemkaydı];
    END;
    CREATE NONCLUSTERED INDEX [IX_IslemKaydi_Covering_Amor] ON [dbo].[islemkaydı] (ikid ASC) INCLUDE (id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL);
END;
GO

-- ⚡ Index: IX_Islem_DetayKodu_Bakiye_Optimize (Tablo: [dbo].[islem])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[islem]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_DetayKodu_Bakiye_Optimize' AND object_id = OBJECT_ID('[dbo].[islem]'))
    BEGIN
         DROP INDEX [IX_Islem_DetayKodu_Bakiye_Optimize] ON [dbo].[islem];
    END;
    CREATE NONCLUSTERED INDEX [IX_Islem_DetayKodu_Bakiye_Optimize] ON [dbo].[islem] (detay_kodu ASC,I_DATE ASC,I_TIME ASC) INCLUDE (islemid,detay,detay_kodu,alısmiktar,satısmiktar,birim,birimfiyat,I_TYPE,birimfiyat,kdvoranı,kdv,depo,ikid_bag,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net);
END;
GO

-- ⚡ Index: IX_Islem_IslemNumarasi_Covering (Tablo: [dbo].[islem])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[islem]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_IslemNumarasi_Covering' AND object_id = OBJECT_ID('[dbo].[islem]'))
    BEGIN
         DROP INDEX [IX_Islem_IslemNumarasi_Covering] ON [dbo].[islem];
    END;
    CREATE NONCLUSTERED INDEX [IX_Islem_IslemNumarasi_Covering] ON [dbo].[islem] (islemnumarası ASC) INCLUDE (islemid,detay,detay_kodu,alısmiktar,satısmiktar,birim,birimfiyat,I_TYPE,birimfiyat,kdvoranı,kdv,depo,ikid_bag,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net);
END;
GO

-- ⚡ Index: IX_Stok_Filtreleme_Master (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[stok]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_Filtreleme_Master' AND object_id = OBJECT_ID('[dbo].[stok]'))
    BEGIN
         DROP INDEX [IX_Stok_Filtreleme_Master] ON [dbo].[stok];
    END;
    CREATE NONCLUSTERED INDEX [IX_Stok_Filtreleme_Master] ON [dbo].[stok] (grubu ASC,kateGOri ASC,tipi ASC) INCLUDE (urunkodu,urun,urunkodu,urun,urunalt,fiyatı,STK_FULL,urunkodu,ureticifirma,grubu,urun,Raf,grubu,fiyatı,kateGOri,tipi,STK_FULL,Raf,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
END;
GO

-- ⚡ Index: IX_Stok_Urun_Arama (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[stok]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_Urun_Arama' AND object_id = OBJECT_ID('[dbo].[stok]'))
    BEGIN
         DROP INDEX [IX_Stok_Urun_Arama] ON [dbo].[stok];
    END;
    CREATE NONCLUSTERED INDEX [IX_Stok_Urun_Arama] ON [dbo].[stok] (urun ASC) INCLUDE (urunkodu,urun,urunkodu,urun,urunalt,fiyatı,STK_FULL,urunkodu,ureticifirma,grubu,urun,Raf,grubu,fiyatı,kateGOri,tipi,STK_FULL,Raf,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
END;
GO

-- ⚡ Index: IX_Stok_B2B_Search_Optimize (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[stok]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_B2B_Search_Optimize' AND object_id = OBJECT_ID('[dbo].[stok]'))
    BEGIN
         DROP INDEX [IX_Stok_B2B_Search_Optimize] ON [dbo].[stok];
    END;
    CREATE NONCLUSTERED INDEX [IX_Stok_B2B_Search_Optimize] ON [dbo].[stok] (urunkodu ASC) INCLUDE (urunkodu,urun,urunkodu,urun,urunalt,fiyatı,STK_FULL,urunkodu,ureticifirma,grubu,urun,Raf,grubu,fiyatı,kateGOri,tipi,STK_FULL,Raf,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
END;
GO

-- ⚡ Index: IX_Stok_OEM_Search (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('[dbo].[stok]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_OEM_Search' AND object_id = OBJECT_ID('[dbo].[stok]'))
    BEGIN
         DROP INDEX [IX_Stok_OEM_Search] ON [dbo].[stok];
    END;
    CREATE NONCLUSTERED INDEX [IX_Stok_OEM_Search] ON [dbo].[stok] (OEM ASC) INCLUDE (urunkodu,urun,urunkodu,urun,urunalt,fiyatı,STK_FULL,urunkodu,ureticifirma,grubu,urun,Raf,grubu,fiyatı,kateGOri,tipi,STK_FULL,Raf,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
END;
GO

