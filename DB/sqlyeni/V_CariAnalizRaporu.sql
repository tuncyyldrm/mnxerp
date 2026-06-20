USE [ONEDB]
GO

/****** Object:  View [dbo].[V_CariAnalizRaporu]    Script Date: 17.06.2026 09:09:15 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE   VIEW [dbo].[V_CariAnalizRaporu] AS
SELECT 
    id,
    kodu,
    firma,
    COALESCE(NULLIF(LTRIM(RTRIM(sehir)), ''), 'BELİRTİLMEMİŞ') AS sehir,
    CASE 
        WHEN kodu LIKE '120%' THEN 'Müşteri (Alıcı)'
        WHEN kodu LIKE '320%' THEN 'Tedarikçi (Satıcı)'
        ELSE 'Diğer Cari'
    END AS CariTipi,
    -- 120'ler için Borç - Alacak gerçek net bakiyeyi verir (Artı bakiye = Alacağımız var)
    ISNULL(BB_TL, 0) - ISNULL(AB_TL, 0) AS NetBakiyeTL,
    CASE 
        WHEN email LIKE '%trendyol%' OR firma LIKE '%Trendyol%' THEN 'Trendyol'
        ELSE 'Doğal Piyasa'
    END AS Kanali,
    COALESCE(UP_DATE, ilkdate, GETDATE()) AS SonIslemTarihi
FROM [dbo].[cari]
WHERE C_STATU = 0;
GO


