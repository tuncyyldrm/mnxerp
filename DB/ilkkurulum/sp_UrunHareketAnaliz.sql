USE [ONEDB]
GO

/****** Object:  StoredProcedure [dbo].[sp_UrunHareketAnaliz]    Script Date: 17.06.2026 09:15:26 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


/* =========================================================
   3. HAREKET ANALİZİ (CLEAN + CPU OPTIMIZED)
========================================================= */

CREATE   PROCEDURE [dbo].[sp_UrunHareketAnaliz]
    @DetayKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.I_DATE AS Tarih,
        i.I_TIME AS Saat,
        i.I_TYPE AS IslemTipi,
        ik.id_name AS MusteriAdi,

        i.alısmiktar AS Giris,
        i.satısmiktar AS Cikis,
        i.birimfiyat AS BirimFiyat,

        i.depo AS DepoBilgisi

    FROM dbo.islem i WITH (NOLOCK)

    LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK)
        ON i.ikid_bag = ik.ikid

    WHERE i.detay_kodu = @DetayKodu

    ORDER BY 
        i.I_DATE DESC,
        i.I_TIME DESC;
END
GO


