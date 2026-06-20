USE [ONEDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '================================================================================';
PRINT '🚀 TABLO YAPISINI DEĞİŞTİRMEYEN (HEAP KORUMALI) INDEX REVİZYON SCRIPT''I';
PRINT '================================================================================';
GO

-- ====================================================================================
-- 1. ADIM: ESKİ INDEXLERİN TEMİZLENMESİ (Esnek Nesne Kontrolü)
-- ====================================================================================
PRINT '1. Eski verimsiz indexler temizleniyor...';

-- Stok Tablosu Temizliği (Case-Insensitive uyumlu kontrol)
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[stok]') AND name = 'IX_Stok_B2B_Search_Optimize')
    DROP INDEX [IX_Stok_B2B_Search_Optimize] ON [dbo].[stok];

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[stok]') AND name = 'IX_Stok_Urunkodu_Search')
    DROP INDEX [IX_Stok_Urunkodu_Search] ON [dbo].[stok];

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[stok]') AND name = 'IX_Stok_Filtre')
    DROP INDEX [IX_Stok_Filtre] ON [dbo].[stok];

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[stok]') AND name = 'IX_Stok_Kod')
    DROP INDEX [IX_Stok_Kod] ON [dbo].[stok];

-- Islem Tablosu Temizliği
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[islem]') AND name = 'IX_Islem_DetayKodu')
    DROP INDEX [IX_Islem_DetayKodu] ON [dbo].[islem];

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[islem]') AND name = 'IX_Islem_DetayKodu_Bakiye_Optimize')
    DROP INDEX [IX_Islem_DetayKodu_Bakiye_Optimize] ON [dbo].[islem];

-- Islemkaydi Tablosu Temizliği (Türkçe Karakter / Büyük Harf Toleranslı)
IF EXISTS (SELECT * FROM sys.indexes WHERE (object_id = OBJECT_ID('[dbo].[islemkaydı]') OR object_id = OBJECT_ID('[dbo].[islemkaydi]')) AND name = 'IX_IslemKaydi_Covering_Amor')
    BEGIN
        -- Hangi isim geçerliyse ona göre uçuruyoruz
        DECLARE @TableName NVARCHAR(255) = (SELECT OBJECT_NAME(object_id) FROM sys.indexes WHERE name = 'IX_IslemKaydi_Covering_Amor');
        EXEC('DROP INDEX [IX_IslemKaydi_Covering_Amor] ON [dbo].[' + @TableName + ']');
    END
GO


-- ====================================================================================
-- 2. ADIM: STOK TABLOSU İÇİN TAM KAPSAYICI (COVERING) INDEX
-- ====================================================================================
PRINT '2. stok tablosu için tam kapsayıcı arama indexi kuruluyor...';

CREATE NONCLUSTERED INDEX IX_Stok_B2B_Search_Optimize
ON [dbo].[stok] (urunkodu)
INCLUDE (
    urun, 
    urunalt, 
    ureticifirma, 
    grubu, 
    kategori, -- 'kateGOri' yazımı düzeltildi
    tipi, 
    Raf, 
    fiyatı, 
    OEM, 
    STK_FULL, 
    OEM_0, 
    OEM_1, 
    OEM_2, 
    OEM_3, 
    OEM_4
);
GO


-- ====================================================================================
-- 3. ADIM: İŞLEM TABLOSU BAKİYE VE HAREKET OPTİMİZASYONU
-- ====================================================================================
PRINT '3. islem tablosu bakiye ve hareket analizi performansı optimize ediliyor...';

CREATE NONCLUSTERED INDEX IX_Islem_DetayKodu_Bakiye_Optimize
ON [dbo].[islem] (detay_kodu, I_DATE, I_TIME)
INCLUDE (alısmiktar, satısmiktar, I_TYPE, birimfiyat, depo, ikid_bag);
GO


-- ====================================================================================
-- 4. ADIM: ISLEMKAYDI TABLOSU JOIN OPTİMİZASYONU
-- Veritabanındaki tablonun fiziki adına göre otomatik index basar (ı/i karmaşasını önler)
-- ====================================================================================
PRINT '4. islemkaydı tablosu veri bağlama hızı optimize ediliyor...';

IF OBJECT_ID('[dbo].[islemkaydı]') IS NOT NULL
    CREATE NONCLUSTERED INDEX IX_IslemKaydi_Covering_Amor ON [dbo].[islemkaydı] (ikid) INCLUDE (id_name, belgetarihi, belgesaati, faturanumarası, belgenumarası, islemtipi, BB_TL, AB_TL);
ELSE IF OBJECT_ID('[dbo].[islemkaydi]') IS NOT NULL
    CREATE NONCLUSTERED INDEX IX_IslemKaydi_Covering_Amor ON [dbo].[islemkaydi] (ikid) INCLUDE (id_name, belgetarihi, belgesaati, faturanumarası, belgenumarası, islemtipi, BB_TL, AB_TL);
GO


-- ====================================================================================
-- 5. ADIM: VW_FATURADETAYRAPORU İÇİN GÜVENLİ BAĞLANTI İNDEXİ
-- ====================================================================================
PRINT '5. Fatura detay raporu join ara bağlantı indexi oluşturuluyor...';

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[dbo].[islem]') AND name = 'IX_Islem_IslemNumarasi_Covering')
    DROP INDEX [IX_Islem_IslemNumarasi_Covering] ON [dbo].[islem];
GO

CREATE NONCLUSTERED INDEX IX_Islem_IslemNumarasi_Covering
ON [dbo].[islem] (islemnumarası)
INCLUDE (islemid, detay, detay_kodu, birim, birimfiyat, kdvoranı, kdv, alısmiktar, satısmiktar, alıstutarı, satıstutarı, kasaid, bankaid, Cariid, net);
GO

PRINT '================================================================================';
PRINT '✅ Tablo yapılarına dokunulmadan, geçiş işlemi BAŞARIYLA TAMAMLANDI!';
PRINT '================================================================================';
GO