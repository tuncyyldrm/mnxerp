USE [ONEDB]
GO

/****** Object:  View [dbo].[vw_CariEkstreDetay]    Script Date: 27.06.2026 22:56:53 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE OR ALTER VIEW [dbo].[vw_CariEkstreDetay] 
WITH SCHEMABINDING -- Gelecekte indeks çakabilmek veya optimizer'ı hızlandırmak için kilitledik
AS
SELECT 
    c.id AS CariID,
    c.kodu AS CariKodu,
    c.firma AS FirmaAdi,
    ik.ikid AS IslemNo,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS IslemTarihi,
    CASE 
        WHEN ik.faturanumarası IS NOT NULL AND ik.faturanumarası <> '' THEN ik.faturanumarası
        WHEN ik.belgenumarası IS NOT NULL AND ik.belgenumarası <> '' THEN ik.belgenumarası
        ELSE '-'
    END AS BelgeNo,
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
-- Güvenli ve kurumsal string eşlemesi
INNER JOIN [dbo].[cari] c ON ik.id_name = c.firma
WHERE c.C_STATU = 0;
GO


