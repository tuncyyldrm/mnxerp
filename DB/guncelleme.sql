-- ✨ Otomatik Üretilen Güncelleme Scripti (19.06.2026 23:48:40)
-- ⚠️ Manuel düzenleme yapmayın, 'npm run db-pack' ile güncelleyin.

-- ✨ Otomatik Üretilen Güncelleme Scripti (19.06.2026 22:19:41)
-- ⚠️ Manuel düzenleme yapmayın, 'npm run db-pack' ile güncelleyin.

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
    -- 120'ler için Borç - Alacak gerçek net bakiyeyi verir (Artı bakiye = Alacağımız var)
    ISNULL(c.BB_TL, 0) - ISNULL(c.AB_TL, 0) AS NetBakiyeTL,
    CASE 
        WHEN c.email LIKE '%trendyol%' OR c.firma LIKE '%Trendyol%' THEN 'Trendyol'
        ELSE 'Doğal Piyasa'
    END AS Kanali,
    
    -- GERÇEK HAREKET TABLOSUNDAN EN SON TARİHİ ÇEKİYORUZ
    COALESCE(
        (SELECT MAX(ekstre.IslemTarihi) 
         FROM [dbo].[vw_CariEkstreDetay] ekstre 
         WHERE ekstre.CariID = c.id), 
        c.ilkdate, 
        GETDATE()
    ) AS SonIslemTarihi,

    -- YAŞLANDIRMA İÇİN GÜN FARKINI DOĞRUDAN SQL'DE HESAPLIYORUZ (HATA DÜZELTİLDİ)
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

CREATE OR ALTER VIEW [dbo].[vw_CariEkstreDetay] AS
SELECT 
    c.id AS CariID,
    c.kodu AS CariKodu,
    c.firma AS FirmaAdi,
    ik.ikid AS IslemNo,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS IslemTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CAST(ik.islemtipi AS NVARCHAR(100)) AS IslemTipi,
    -- Hangi bakiye kolonu doluysa o tutarı çekiyoruz
    CASE 
        WHEN ISNULL(ik.BB_TL, 0) > 0 THEN ik.BB_TL 
        ELSE ISNULL(ik.AB_TL, 0) 
    END AS IslemTutari,
    -- Yön tayini: Müşteri borçlandı mı (B), alacaklandı mı (A)?
    CASE 
        WHEN ISNULL(ik.BB_TL, 0) > 0 THEN 'B' 
        ELSE 'A' 
    END AS Yon
FROM [dbo].[islemkaydı] ik
INNER JOIN [dbo].[cari] c ON COALESCE(NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''), N'Bilinmeyen Cari') = c.firma
WHERE c.C_STATU = 0;
GO

CREATE OR ALTER VIEW [dbo].[vw_FaturaDetayRaporu] AS
SELECT 
    -- Fatura Üst Bilgileri
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

    -- Stok / Finans Hareket Bilgileri
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
    
    -- 🛡️ GÜVENLİ VE YÖNLÜ MUHASEBE TUTAR KURGUSU
    CAST(
        CASE 
            WHEN ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN', 'BÇ', 'BY', 'MSF', 'DG', 'DC') THEN 
                ISNULL(i.satıstutarı, 0)
            ELSE
                COALESCE(NULLIF(i.satıstutarı, 0), i.alıstutarı, 0)
        END AS DECIMAL(18,4)
    ) AS SatirTutarı
FROM [dbo].[islem] i
-- 🚀 Implicit conversion yükünü hafifletmek için güvenli JOIN kurgusu
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
LEFT JOIN [dbo].[kasa] k ON i.kasaid = k.kasaid                        -- Alt sorgudan JOIN'e çekildi
LEFT JOIN [dbo].[banka] b ON i.bankaid = b.id                          -- Alt sorgudan JOIN'e çekildi
LEFT JOIN [dbo].[islemkaydı_ack] ack ON ik.ikid = ack.IK_ID AND (ack.SR = 0 OR ack.SR IS NULL)
WHERE i.islemid IS NOT NULL 
  AND (
       ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN') 
       OR ISNULL(i.alısmiktar, 0) <> 0 OR ISNULL(i.satısmiktar, 0) <> 0 
       OR ISNULL(i.alıstutarı, 0) <> 0 OR ISNULL(i.satıstutarı, 0) <> 0 
       OR ISNULL(i.net, 0) <> 0
  );
GO

CREATE OR ALTER VIEW [dbo].[vw_StokListesi]
AS
SELECT 
    s.urunkodu, s.urun, s.urunalt, s.ureticifirma, 
    s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
    s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
    -- Tabloda yoksa NULL olarak ata, varsa sütun adını yaz:
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

/* =========================================================
   2. TEK ÜRÜN DETAY PROSEDÜRÜ (VIEW BYPASS - DAHA HIZLI)
========================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_StokDetayGetir
    @UrunKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        s.urunkodu,
        s.urun,
        s.urunalt,
        s.ureticifirma,
        s.grubu,
        s.kateGOri,
        s.tipi,
        s.Raf,
        s.fiyatı,
        s.OEM,
        s.STK_FULL,
        s.OEM_0,
        s.OEM_1,
        s.OEM_2,
        s.OEM_3,
        s.OEM_4,

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

CREATE OR ALTER PROCEDURE [dbo].[sp_StokDuzenle]
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

/* =========================================================
   3. HAREKET ANALİZİ (CLEAN + CPU OPTIMIZED)
========================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_UrunHareketAnaliz
    @DetayKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.I_DATE AS Tarih,
        i.I_TIME AS Saat,
        i.I_TYPE AS IslemTipi,
        ik.id_name AS MusteriAdi,

        i.alısmiktar AS Giris,
        i.satısmiktar AS Cikis,
        i.birimfiyat AS BirimFiyat,

        i.depo AS DepoBilgisi

    FROM dbo.islem i WITH (NOLOCK)

    LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK)
        ON i.ikid_bag = ik.ikid

    WHERE i.detay_kodu = @DetayKodu

    ORDER BY 
        i.I_DATE DESC,
        i.I_TIME DESC;
END
GO

-- ⚡ Index: IX_IslemKaydi_Covering_Amor (Tablo: [dbo].[islemkaydı])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_IslemKaydi_Covering_Amor' AND object_id = OBJECT_ID('[dbo].[islemkaydı]'))
BEGIN
    DROP INDEX [IX_IslemKaydi_Covering_Amor] ON [dbo].[islemkaydı];
END;
GO
CREATE NONCLUSTERED INDEX [IX_IslemKaydi_Covering_Amor] ON [dbo].[islemkaydı] (ikid ASC) INCLUDE (id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL);
GO

-- ⚡ Index: IX_Islem_DetayKodu_Bakiye_Optimize (Tablo: [dbo].[islem])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_DetayKodu_Bakiye_Optimize' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    DROP INDEX [IX_Islem_DetayKodu_Bakiye_Optimize] ON [dbo].[islem];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Islem_DetayKodu_Bakiye_Optimize] ON [dbo].[islem] (detay_kodu ASC,I_DATE ASC,I_TIME ASC) INCLUDE (alısmiktar,satısmiktar,I_TYPE,birimfiyat,depo,ikid_bag);
GO

-- ⚡ Index: IX_Islem_IslemNumarasi_Covering (Tablo: [dbo].[islem])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_IslemNumarasi_Covering' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    DROP INDEX [IX_Islem_IslemNumarasi_Covering] ON [dbo].[islem];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Islem_IslemNumarasi_Covering] ON [dbo].[islem] (islemnumarası ASC) INCLUDE (islemid,detay,detay_kodu,birim,birimfiyat,kdvoranı,kdv,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net);
GO

-- ⚡ Index: IX_Stok_Filtreleme_Master (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_Filtreleme_Master' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    DROP INDEX [IX_Stok_Filtreleme_Master] ON [dbo].[stok];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Stok_Filtreleme_Master] ON [dbo].[stok] (grubu ASC,kateGOri ASC,tipi ASC) INCLUDE (urunkodu,urun,fiyatı,STK_FULL,Raf);
GO

-- ⚡ Index: IX_Stok_Urun_Arama (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_Urun_Arama' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    DROP INDEX [IX_Stok_Urun_Arama] ON [dbo].[stok];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Stok_Urun_Arama] ON [dbo].[stok] (urun ASC) INCLUDE (urunkodu,fiyatı,STK_FULL,Raf,grubu);
GO

-- ⚡ Index: IX_Stok_B2B_Search_Optimize (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_B2B_Search_Optimize' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    DROP INDEX [IX_Stok_B2B_Search_Optimize] ON [dbo].[stok];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Stok_B2B_Search_Optimize] ON [dbo].[stok] (urunkodu ASC) INCLUDE (urun,urunalt,ureticifirma,grubu,kateGOri,tipi,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
GO

-- ⚡ Index: IX_Stok_OEM_Search (Tablo: [dbo].[stok])
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stok_OEM_Search' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    DROP INDEX [IX_Stok_OEM_Search] ON [dbo].[stok];
END;
GO
CREATE NONCLUSTERED INDEX [IX_Stok_OEM_Search] ON [dbo].[stok] (OEM ASC) INCLUDE (urunkodu,urun);
GO

