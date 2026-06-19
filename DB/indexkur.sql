USE [ONEDB];
GO

/* =========================================================
   1. ESKİ INDEX TEMİZLİĞİ (SADECE YARDIMCI INDEXLER)
========================================================= */

IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Stok_Urunkodu_Search' 
      AND object_id = OBJECT_ID('dbo.stok')
)
DROP INDEX IX_Stok_Urunkodu_Search ON dbo.stok;

IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Stok_OEM_Search' 
      AND object_id = OBJECT_ID('dbo.stok')
)
DROP INDEX IX_Stok_OEM_Search ON dbo.stok;

IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Stok_Filtre' 
      AND object_id = OBJECT_ID('dbo.stok')
)
DROP INDEX IX_Stok_Filtre ON dbo.stok;

IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Islem_DetayKodu' 
      AND object_id = OBJECT_ID('dbo.islem')
)
DROP INDEX IX_Islem_DetayKodu ON dbo.islem;

GO

/* =========================================================
   2. STOK - SEARCH INDEX (EN KRİTİK)
   Prefix + exact match hızlandırma
========================================================= */

CREATE NONCLUSTERED INDEX IX_Stok_Urunkodu_Search
ON dbo.stok (urunkodu)
INCLUDE (
    urun,
    urunalt,
    OEM,
    grubu,
    kateGOri,
    tipi
);
GO

/* =========================================================
   3. STOK - FILTER INDEX (API filtreleri için)
========================================================= */

CREATE NONCLUSTERED INDEX IX_Stok_Filtre
ON dbo.stok (grubu, kateGOri, tipi)
INCLUDE (
    urunkodu,
    urun
);
GO

/* =========================================================
   4. OEM SEARCH INDEX
========================================================= */

CREATE NONCLUSTERED INDEX IX_Stok_OEM_Search
ON dbo.stok (OEM)
INCLUDE (
    urunkodu,
    urun
);
GO

/* =========================================================
   5. İŞLEM TABLOSU INDEX (STOK HAREKETİ)
========================================================= */

CREATE NONCLUSTERED INDEX IX_Islem_DetayKodu
ON dbo.islem (detay_kodu)
INCLUDE (
    alısmiktar,
    satısmiktar
);
GO

/* =========================================================
   6. STATISTICS (GÜVENLİ GÜNCELLEME)
   FULLSCAN YOK → PROD SAFE
========================================================= */

UPDATE STATISTICS dbo.stok;
UPDATE STATISTICS dbo.islem;
GO