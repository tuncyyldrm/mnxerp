USE [ONEDB]
GO

-- ===================================================================
-- 📌 1. [dbo].[islem] TABLOSU İNDEKSLERİ
-- ===================================================================

-- CLUSTERED INDEX (Fiziksel Sıralama)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'CX_Islem_IslemId_Fiziksel' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    CREATE CLUSTERED INDEX [CX_Islem_IslemId_Fiziksel] ON [dbo].[islem] ([islemid]);
END
GO

-- NONCLUSTERED INDEX: IX_Islem_DetayKodu_Bakiye_Optimize
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_DetayKodu_Bakiye_Optimize' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Islem_DetayKodu_Bakiye_Optimize]
    ON [dbo].[islem] ([detay_kodu], [I_DATE], [I_TIME])
    INCLUDE ([alısmiktar], [satısmiktar], [I_TYPE], [birimfiyat], [depo], [ikid_bag]);
END
GO

-- NONCLUSTERED INDEX: IX_Islem_IslemNumarasi_Covering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_IslemNumarasi_Covering' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Islem_IslemNumarasi_Covering]
    ON [dbo].[islem] ([islemnumarası])
    INCLUDE (
        [islemid], [detay], [detay_kodu], [birim], [birimfiyat], 
        [kdvoranı], [kdv], [alısmiktar], [satısmiktar], [alıstutarı], 
        [satıstutarı], [kasaid], [bankaid], [Cariid], [net]);
END
GO

-- NONCLUSTERED INDEX: IX_Islem_Islemnumarasi_B2B_Covering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Islem_Islemnumarasi_B2B_Covering' AND object_id = OBJECT_ID('[dbo].[islem]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Islem_Islemnumarasi_B2B_Covering]
    ON [dbo].[islem] ([islemnumarası])
    INCLUDE ([detay_kodu], [kasaid], [bankaid], [alısmiktar], [satısmiktar], [alıstutarı], [satıstutarı], [net]);
END
GO


-- ===================================================================
-- 📌 2. [dbo].[stok] TABLOSU İNDEKSLERİ
-- ===================================================================

-- CLUSTERED INDEX (Fiziksel Sıralama)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'CX_Stok_UrunKodu_Fiziksel' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    CREATE CLUSTERED INDEX [CX_Stok_UrunKodu_Fiziksel] ON [dbo].[stok] ([urunkodu]);
END
GO

-- NONCLUSTERED INDEX: IX_stok_B2B_Arama_Ultra_Hizli
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_stok_B2B_Arama_Ultra_Hizli' AND object_id = OBJECT_ID('[dbo].[stok]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_stok_B2B_Arama_Ultra_Hizli]
    ON [dbo].[stok] ([urun], [urunkodu], [OEM])
    INCLUDE (
        [urunalt], [grubu], [kateGOri], [tipi], [Raf], [fiyatı], [STK_FULL], 
        [OEM_0], [OEM_1], [OEM_2], [OEM_3], [OEM_4]);
END
GO


-- ===================================================================
-- 📌 3. [dbo].[vw_StokListesi] INDEXED VIEW İNDEKSLERİ
-- ===================================================================

-- Eski denemeler varsa temizleyelim (Burada IF EXISTS zaten güvenliği sağlıyor)
DROP INDEX IF EXISTS UX_vw_StokListesi_urunkodu ON [dbo].[vw_StokListesi];
DROP INDEX IF EXISTS IX_vw_StokListesi_B2B_Arama_Nihai ON [dbo].[vw_StokListesi];
GO

-- 1. View'u fiziksel bir tablo iskeletine dönüştüren benzersiz clustered index
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_vw_StokListesi_urunkodu' AND object_id = OBJECT_ID('[dbo].[vw_StokListesi]'))
BEGIN
    CREATE UNIQUE CLUSTERED INDEX UX_vw_StokListesi_urunkodu ON [dbo].[vw_StokListesi] (urunkodu);
END
GO

-- 2. Next.js arama motorundaki "MÜŞÜR / FAN / 306" kelimelerini RAM'den süzecek nihai arama indeksi
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_vw_StokListesi_B2B_Arama_Nihai' AND object_id = OBJECT_ID('[dbo].[vw_StokListesi]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_vw_StokListesi_B2B_Arama_Nihai
    ON [dbo].[vw_StokListesi] (urun, OEM)
    INCLUDE (urunalt, grubu, kateGOri, tipi, Raf, fiyatı, STK_FULL, OEM_0, OEM_1, OEM_2, OEM_3);
END
GO