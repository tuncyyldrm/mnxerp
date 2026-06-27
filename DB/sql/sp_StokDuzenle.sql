USE [ONEDB]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- 🗑️ Eğer prosedür zaten varsa önce güvenli bir şekilde siliyoruz
IF OBJECT_ID('[dbo].[sp_StokDuzenle]', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[sp_StokDuzenle];
END
GO

-- ✨ Şimdi sıfırdan ve temiz bir şekilde oluşturuyoruz
CREATE PROCEDURE [dbo].[sp_StokDuzenle]
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