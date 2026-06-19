USE [ONEDB];
GO

/* =========================================================
   1. STOK GÖRÜNÜMÜ (LIGHTWEIGHT + PERFORMANT)
========================================================= */

USE [ONEDB];
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

