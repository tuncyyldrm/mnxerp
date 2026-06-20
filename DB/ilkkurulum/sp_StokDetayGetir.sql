USE [ONEDB]
GO

/****** Object:  StoredProcedure [dbo].[sp_StokDetayGetir]    Script Date: 17.06.2026 09:14:59 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


/* =========================================================
   2. TEK ÜRÜN DETAY PROSEDÜRÜ (VIEW BYPASS - DAHA HIZLI)
========================================================= */

CREATE   PROCEDURE [dbo].[sp_StokDetayGetir]
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


