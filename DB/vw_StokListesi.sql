USE [ONEDB]
GO

/****** Object:  View [dbo].[vw_StokListesi]    Script Date: 27.06.2026 23:31:08 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER   VIEW [dbo].[vw_StokListesi]
WITH SCHEMABINDING -- İndeksleme için bu kilit zorunludur
AS
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
    s.OEM_5, 
    s.OEM_6, 
    s.OEM_7, 
    s.OEM_8, 
    s.OEM_9, -- Gerçek kolonlar view'a eklendi
    ISNULL(s.STK_FULL, 0) AS MevcutBakiye
FROM [dbo].[stok] s;
GO


