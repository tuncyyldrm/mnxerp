USE [ONEDB]
GO

/****** Object:  View [dbo].[V_CariAnalizRaporu]    Script Date: 27.06.2026 22:56:44 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO



CREATE OR ALTER   VIEW [dbo].[V_CariAnalizRaporu] AS
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


