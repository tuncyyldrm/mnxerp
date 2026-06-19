USE [ONEDB]
GO

/****** Object:  View [dbo].[vw_StokListesi]    Script Date: 17.06.2026 09:16:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE   VIEW [dbo].[vw_StokListesi]
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


