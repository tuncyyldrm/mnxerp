USE [ONEDB];
GO

PRINT '--- 2. sp_StokDetayGetir Prosedürü Optimize Ediliyor ---';
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- 🗑️ Eğer prosedür zaten varsa önce güvenli bir şekilde siliyoruz
IF OBJECT_ID('[dbo].[sp_StokDetayGetir]', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[sp_StokDetayGetir];
END
GO

-- ✨ Şimdi sıfırdan ve temiz bir şekilde oluşturuyoruz
CREATE PROCEDURE [dbo].[sp_StokDetayGetir]
    @UrunKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- OUTER APPLY yerine doğrudan islem tablosunun en güçlü indeksi olan
    -- IX_Islem_DetayKodu_Bakiye_Optimize'ı tetikleyecek LEFT JOIN Subquery yapısına geçildi.
    SELECT 
        s.urunkodu, s.urun, s.urunalt, s.ureticifirma, s.grubu, s.kateGOri, s.tipi, s.Raf, s.fiyatı, 
        s.OEM, s.STK_FULL, s.OEM_0, s.OEM_1, s.OEM_2, s.OEM_3, s.OEM_4,
        ISNULL(b.ToplamBakiye, 0) AS MevcutBakiye
    FROM dbo.stok s WITH (NOLOCK)
    LEFT JOIN (
        SELECT detay_kodu, SUM(alısmiktar - satısmiktar) AS ToplamBakiye
        FROM dbo.islem WITH (NOLOCK)
        WHERE detay_kodu = @UrunKodu
        GROUP BY detay_kodu
    ) b ON s.urunkodu = b.detay_kodu
    WHERE s.urunkodu = @UrunKodu;
END
GO