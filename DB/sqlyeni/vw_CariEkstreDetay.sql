USE [ONEDB]
GO

/****** Object:  View [dbo].[vw_CariEkstreDetay]    Script Date: 17.06.2026 09:10:27 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE   VIEW [dbo].[vw_CariEkstreDetay] AS
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
