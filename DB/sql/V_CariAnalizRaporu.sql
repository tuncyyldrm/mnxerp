USE [ONEDB]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER VIEW [dbo].[V_CariAnalizRaporu] AS
WITH SonHareketler AS (
    SELECT 
        ik.id AS CariID,
        MAX(CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME)) AS SonTarih
    FROM [dbo].[islemkaydı] ik WITH (NOLOCK)
    GROUP BY ik.id
)
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
    COALESCE(sh.SonTarih, c.ilkdate, GETDATE()) AS SonIslemTarihi,
    CASE 
        WHEN (ISNULL(c.BB_TL, 0) - ISNULL(c.AB_TL, 0)) > 0 THEN
            DATEDIFF(DAY, COALESCE(sh.SonTarih, c.ilkdate, GETDATE()), GETDATE())
        ELSE 0
    END AS GecikmeGunSayisi
FROM [dbo].[cari] c WITH (NOLOCK)
LEFT JOIN SonHareketler sh ON c.id = sh.CariID
WHERE c.C_STATU = 0;
GO
