-- --- 1. [dbo].[islem] Tablosu ---

-- CLUSTERED INDEX (Fiziksel Sıralama)
CREATE CLUSTERED INDEX [CX_Islem_IslemId_Fiziksel] 
ON [dbo].[islem] ([islemid]);
GO

-- NONCLUSTERED INDEX: IX_Islem_DetayKodu_Bakiye_Optimize
CREATE NONCLUSTERED INDEX [IX_Islem_DetayKodu_Bakiye_Optimize]
ON [dbo].[islem] ([detay_kodu], [I_DATE], [I_TIME])
INCLUDE ([alısmiktar], [satısmiktar], [I_TYPE], [birimfiyat], [depo], [ikid_bag]);
GO

-- NONCLUSTERED INDEX: IX_Islem_IslemNumarasi_Covering
CREATE NONCLUSTERED INDEX [IX_Islem_IslemNumarasi_Covering]
ON [dbo].[islem] ([islemnumarası])
INCLUDE (
    [islemid], [detay], [detay_kodu], [birim], [birimfiyat], 
    [kdvoranı], [kdv], [alısmiktar], [satısmiktar], [alıstutarı], 
    [satıstutarı], [kasaid], [bankaid], [Cariid], [net]
);
GO

-- NONCLUSTERED INDEX: IX_Islem_Islemnumarasi_B2B_Covering
CREATE NONCLUSTERED INDEX [IX_Islem_Islemnumarasi_B2B_Covering]
ON [dbo].[islem] ([islemnumarası])
INCLUDE ([detay_kodu], [kasaid], [bankaid], [alısmiktar], [satısmiktar], [alıstutarı], [satıstutarı], [net]);
GO


-- --- 2. [dbo].[stok] Tablosu ---

-- CLUSTERED INDEX (Fiziksel Sıralama)
CREATE CLUSTERED INDEX [CX_Stok_UrunKodu_Fiziksel] 
ON [dbo].[stok] ([urunkodu]);
GO

-- NONCLUSTERED INDEX: IX_stok_B2B_Arama_Ultra_Hizli
CREATE NONCLUSTERED INDEX [IX_stok_B2B_Arama_Ultra_Hizli]
ON [dbo].[stok] ([urun], [urunkodu], [OEM])
INCLUDE (
    [urunalt], [grubu], [kateGOri], [tipi], [Raf], [fiyatı], [STK_FULL], 
    [OEM_0], [OEM_1], [OEM_2], [OEM_3], [OEM_4]
);
GO



-- Eski denemeler varsa temizleyelim
DROP INDEX IF EXISTS UX_vw_StokListesi_urunkodu ON [dbo].[vw_StokListesi];
DROP INDEX IF EXISTS IX_vw_StokListesi_B2B_Arama_Nihai ON [dbo].[vw_StokListesi];
GO

-- 1. View'u fiziksel bir tablo iskeletine dönüştüren benzersiz clustered index
CREATE UNIQUE CLUSTERED INDEX UX_vw_StokListesi_urunkodu 
ON [dbo].[vw_StokListesi] (urunkodu);
GO

-- 2. Next.js arama motorundaki "MÜŞÜR / FAN / 306" kelimelerini RAM'den süzecek nihai arama indeksi
CREATE NONCLUSTERED INDEX IX_vw_StokListesi_B2B_Arama_Nihai
ON [dbo].[vw_StokListesi] (urun, OEM)
INCLUDE (urunalt, grubu, kateGOri, tipi, Raf, fiyatı, STK_FULL, OEM_0, OEM_1, OEM_2, OEM_3);
GO