USE [ONEDB]
GO

/****** Object:  View [dbo].[vw_FaturaDetayRaporu]    Script Date: 27.06.2026 22:59:55 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER VIEW [dbo].[vw_FaturaDetayRaporu] AS
SELECT
    ik.ikid AS IslemNo,
    CAST(
        COALESCE(
            NULLIF(CAST(ik.id_name AS NVARCHAR(255)), ''),
            CASE WHEN ISNULL(i.kasaid, 0) > 1 THEN k.kasa_ack END,
            CASE WHEN i.kasaid = 1 OR (ISNULL(i.kasaid, 0) = 0 AND ISNULL(i.bankaid, 0) = 0 AND i.Cariid = 1) THEN N'MERKEZ KASA / CARİ HAREKETİ' END,
            CASE WHEN ISNULL(i.bankaid, 0) > 0 THEN b.banka + ' - ' + b.sube END,
            CASE
                WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN N'İÇ TRANSFER HAREKETİ'
                WHEN ik.islemtipi IN ('NT', 'NÖ') THEN N'KASA HAREKETİ'
                ELSE N'Sistem Virman Satırı'
            END
        ) AS NVARCHAR(255)
    ) AS CariAdi,
    CAST(
        CASE
            WHEN ik.islemtipi IN ('SF', 'PS', 'WBS', 'SÖSA') THEN 'SF'
            WHEN ik.islemtipi IN ('AF', 'MG') THEN 'AF'
            WHEN ik.islemtipi IN ('NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT') THEN 'NT'
            WHEN ik.islemtipi IN ('NÖ', 'GIDHE', 'KKO', 'BTE', 'KKTED', 'KÖ') THEN 'NÖ'
            WHEN ik.islemtipi IN ('PSI', 'MTAİ') THEN 'PSI'
            WHEN ik.islemtipi IN ('VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC', 'VİRMAN') THEN 'VRM'
            WHEN ik.islemtipi = 'S' THEN 'SF'
            WHEN ik.islemtipi = 'A' THEN 'AF'
            ELSE ISNULL(ik.islemtipi, 'DIĞER')
        END AS NVARCHAR(100)
    ) AS IslemTipi,
    CAST(ik.belgetarihi AS DATETIME) + CAST(ISNULL(ik.belgesaati, '00:00:00') AS DATETIME) AS FaturaTarihi,
    COALESCE(NULLIF(CAST(ik.faturanumarası AS NVARCHAR(100)), ''), CAST(ik.belgenumarası AS NVARCHAR(100)), '-') AS BelgeNo,
    CASE
        WHEN ISNULL(ik.AB_TL, 0) > 0 THEN ik.AB_TL
        ELSE ISNULL(ik.BB_TL, 0)
    END AS FaturaToplamTutar,
    COALESCE(NULLIF(CAST(ack.I_NOTE AS NVARCHAR(MAX)), ''), N'İçerik detayları için tıklayın') AS FaturaNotu,
    i.islemid AS SatirId,
    COALESCE(NULLIF(CAST(i.detay AS NVARCHAR(255)), ''), N'Tanımsız Satır/Hizmet/Virman') AS UrunAdi,
    COALESCE(NULLIF(CAST(i.detay_kodu AS NVARCHAR(100)), ''), '-') AS StokKodu,
    COALESCE(NULLIF(CAST(i.birim AS NVARCHAR(50)), ''), N'ADET') AS Birim,
    ISNULL(i.birimfiyat, 0) AS BirimFiyat,
    ISNULL(i.kdvoranı, 0) AS KdvOrani,
    ISNULL(i.kdv, 0) AS KdvTutari,
    CASE
        WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN ISNULL(i.alıstutarı, 0) / i.alısmiktar
        WHEN ISNULL(i.satısmiktar, 0) <> 0 THEN ISNULL(i.satıstutarı, 0) / i.satısmiktar
        ELSE ISNULL(i.birimfiyat, 0)
    END AS KdvDahilBirimFiyat,
    CASE
        WHEN ISNULL(i.alısmiktar, 0) <> 0 THEN i.alısmiktar
        ELSE ISNULL(i.satısmiktar, 0)
    END AS Miktar,
    CAST(
        CASE
            WHEN ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN', 'BÇ', 'BY', 'MSF', 'DG', 'DC') THEN
                ISNULL(i.satıstutarı, 0)
            ELSE
                COALESCE(NULLIF(i.satıstutarı, 0), i.alıstutarı, 0)
        END AS DECIMAL(18,4)
    ) AS SatirTutarı
FROM [dbo].[islem] i
INNER JOIN [dbo].[islemkaydı] ik ON i.islemnumarası = CAST(ik.ikid AS NVARCHAR(100))
LEFT JOIN [dbo].[kasa] k ON i.kasaid = k.kasaid 
LEFT JOIN [dbo].[banka] b ON i.bankaid = b.id 
LEFT JOIN [dbo].[islemkaydı_ack] ack ON ik.ikid = ack.IK_ID AND (ack.SR = 0 OR ack.SR IS NULL)
WHERE i.islemid IS NOT NULL
AND (
    ik.islemtipi IN ('VRM', 'VRMC', 'VİRMAN')
    OR ISNULL(i.alısmiktar, 0) <> 0 OR ISNULL(i.satısmiktar, 0) <> 0
    OR ISNULL(i.alıstutarı, 0) <> 0 OR ISNULL(i.satıstutarı, 0) <> 0
    OR ISNULL(i.net, 0) <> 0
);
GO


