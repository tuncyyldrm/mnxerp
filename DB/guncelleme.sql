/* =========================================================================
    ✨ OTOMATİK ÜRETİLEN GÜVENLİ KURULUM VE GÜNCELLEME SCRIPTİ
    Generated: 21.06.2026 00:31:43
    🛡️ Taslak Mimari & %100 Sıfır Kurulum Güvencesi Aktiftir.
========================================================================= */

SET NOCOUNT ON;
GO

/* ===================== 🛡️ ADIM 1: DYNAMIC STUBS (TEMİZ TEMEL) ===================== */

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_StokListesi]') AND type in (N'V'))
BEGIN
    DROP VIEW [dbo].[vw_StokListesi];
END;
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_FaturaDetayRaporu]') AND type in (N'V'))
BEGIN
    DROP VIEW [dbo].[vw_FaturaDetayRaporu];
END;
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[V_CariAnalizRaporu]') AND type in (N'V'))
BEGIN
    DROP VIEW [dbo].[V_CariAnalizRaporu];
END;
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[vw_CariEkstreDetay]') AND type in (N'V'))
BEGIN
    DROP VIEW [dbo].[vw_CariEkstreDetay];
END;
GO

EXEC('CREATE VIEW [dbo].[vw_CariEkstreDetay] AS 
        SELECT CAST(1 AS int) AS [CariID], CAST(''1'' AS varchar(50)) AS [CariKodu], CAST(''1'' AS varchar(500)) AS [FirmaAdi], CAST(1 AS int) AS [IslemNo], CAST(GETDATE() AS datetime) AS [IslemTarihi], CAST(''1'' AS nvarchar(100)) AS [BelgeNo], CAST(''1'' AS nvarchar(100)) AS [IslemTipi], CAST(1.0 AS float) AS [IslemTutari], CAST(''B'' AS varchar(1)) AS [Yon]');
GO

EXEC('CREATE VIEW [dbo].[V_CariAnalizRaporu] AS 
        SELECT CAST(1 AS int) AS [id], CAST(''1'' AS varchar(50)) AS [kodu], CAST(''1'' AS varchar(500)) AS [firma], CAST(''1'' AS varchar(50)) AS [sehir], CAST(''1'' AS varchar(18)) AS [CariTipi], CAST(1.0 AS float) AS [NetBakiyeTL], CAST(''1'' AS varchar(12)) AS [Kanali], CAST(GETDATE() AS datetime) AS [SonIslemTarihi], CAST(1 AS int) AS [GecikmeGunSayisi]');
GO

EXEC('CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS 
        SELECT CAST(1 AS int) AS [IslemNo], CAST(''1'' AS nvarchar(255)) AS [CariAdi], CAST(''1'' AS nvarchar(100)) AS [IslemTipi], CAST(GETDATE() AS datetime) AS [FaturaTarihi], CAST(''1'' AS nvarchar(100)) AS [BelgeNo], CAST(1.0 AS float) AS [FaturaToplamTutar], CAST(''1'' AS nvarchar(max)) AS [FaturaNotu], CAST(1 AS int) AS [SatirId], CAST(''1'' AS nvarchar(255)) AS [UrunAdi], CAST(''1'' AS nvarchar(100)) AS [StokKodu], CAST(''1'' AS nvarchar(50)) AS [Birim], CAST(1.0 AS float) AS [BirimFiyat], CAST(1 AS int) AS [KdvOrani], CAST(1.0 AS float) AS [KdvTutari], CAST(1.0 AS float) AS [KdvDahilBirimFiyat], CAST(1.0 AS float) AS [Miktar], CAST(1.0 AS decimal(18,4)) AS [SatirTutarı]');
GO

EXEC('CREATE VIEW [dbo].[vw_StokListesi] AS 
        SELECT CAST(''1'' AS varchar(300)) AS [urunkodu], CAST(''1'' AS varchar(300)) AS [urun], CAST(''1'' AS varchar(300)) AS [urunalt], CAST(''1'' AS varchar(300)) AS [ureticifirma], CAST(''1'' AS varchar(300)) AS [grubu], CAST(''1'' AS varchar(300)) AS [kategori], CAST(''1'' AS varchar(300)) AS [tipi], CAST(''1'' AS varchar(50)) AS [Raf], CAST(1.0 AS float) AS [fiyatı], CAST(''1'' AS varchar(350)) AS [OEM], CAST(1.0 AS float) AS [STK_FULL], CAST(''1'' AS varchar(350)) AS [OEM_0], CAST(''1'' AS varchar(350)) AS [OEM_1], CAST(''1'' AS varchar(350)) AS [OEM_2], CAST(''1'' AS varchar(350)) AS [OEM_3], CAST(''1'' AS varchar(350)) AS [OEM_4], CAST(1 AS int) AS [OEM_5], CAST(1 AS int) AS [OEM_6], CAST(1 AS int) AS [OEM_7], CAST(1 AS int) AS [OEM_8], CAST(1 AS int) AS [OEM_9], CAST(1.0 AS float) AS [MevcutBakiye]');
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDetayGetir]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_StokDetayGetir] AS BEGIN SET NOCOUNT ON; END');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_StokDuzenle]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_StokDuzenle] AS BEGIN SET NOCOUNT ON; END');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UrunHareketAnaliz]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz] AS BEGIN SET NOCOUNT ON; END');
END;
GO

/* ===================== 📊 ADIM 2: VIEW GÜNCELLEMELERİ (ALTER) ===================== */
-- ℹ️ View [dbo].[vw_CariEkstreDetay] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO

-- ℹ️ View [dbo].[V_CariAnalizRaporu] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO

-- ℹ️ View [dbo].[vw_FaturaDetayRaporu] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO

-- ℹ️ View [dbo].[vw_StokListesi] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO


/* ===================== ⚡ ADIM 3: STORED PROCEDURE GÜNCELLEMELERİ ===================== */
-- ℹ️ Procedure [dbo].[sp_StokDetayGetir] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO

-- ℹ️ Procedure [dbo].[sp_StokDuzenle] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO

-- ℹ️ Procedure [dbo].[sp_UrunHareketAnaliz] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.
GO


/* ===================== 🛠️ ADIM 4: HIGH-PERFORMANCE INDEXES ===================== */

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.cari') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CARI_STATU_ID' AND object_id = OBJECT_ID('dbo.cari'))
    BEGIN
        DROP INDEX [IX_CARI_STATU_ID] ON dbo.cari;
    END;
    CREATE NONCLUSTERED INDEX [IX_CARI_STATU_ID] ON dbo.cari (C_STATU, id) INCLUDE (kodu,firma,sehir,email,ilkdate,BB_TL,AB_TL);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.islemkaydı') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ISLEMKAYDI_IKID_COVERING' AND object_id = OBJECT_ID('dbo.islemkaydı'))
    BEGIN
        DROP INDEX [IX_ISLEMKAYDI_IKID_COVERING] ON dbo.islemkaydı;
    END;
    CREATE NONCLUSTERED INDEX [IX_ISLEMKAYDI_IKID_COVERING] ON dbo.islemkaydı (ikid) INCLUDE (id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.islem') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ISLEM_ISLEMNUMARASI_COVERING' AND object_id = OBJECT_ID('dbo.islem'))
    BEGIN
        DROP INDEX [IX_ISLEM_ISLEMNUMARASI_COVERING] ON dbo.islem;
    END;
    CREATE NONCLUSTERED INDEX [IX_ISLEM_ISLEMNUMARASI_COVERING] ON dbo.islem (islemnumarası) INCLUDE (islemid,detay,detay_kodu,birim,birimfiyat,kdvoranı,kdv,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.islemkaydı_ack') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ACK_IKID' AND object_id = OBJECT_ID('dbo.islemkaydı_ack'))
    BEGIN
        DROP INDEX [IX_ACK_IKID] ON dbo.islemkaydı_ack;
    END;
    CREATE NONCLUSTERED INDEX [IX_ACK_IKID] ON dbo.islemkaydı_ack (IK_ID) INCLUDE (I_NOTE,SR);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.islem') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ISLEM_DETAY_KODU_BAKIYE' AND object_id = OBJECT_ID('dbo.islem'))
    BEGIN
        DROP INDEX [IX_ISLEM_DETAY_KODU_BAKIYE] ON dbo.islem;
    END;
    CREATE NONCLUSTERED INDEX [IX_ISLEM_DETAY_KODU_BAKIYE] ON dbo.islem (detay_kodu, I_DATE, I_TIME) INCLUDE (alısmiktar,satısmiktar,I_TYPE,birimfiyat,depo,ikid_bag);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.stok') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_STOK_ARAMA_MASTER' AND object_id = OBJECT_ID('dbo.stok'))
    BEGIN
        DROP INDEX [IX_STOK_ARAMA_MASTER] ON dbo.stok;
    END;
    CREATE NONCLUSTERED INDEX [IX_STOK_ARAMA_MASTER] ON dbo.stok (urunkodu) INCLUDE (urun,urunalt,ureticifirma,grubu,kategori,tipi,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.stok') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_STOK_URUN_AD_ARAMA' AND object_id = OBJECT_ID('dbo.stok'))
    BEGIN
        DROP INDEX [IX_STOK_URUN_AD_ARAMA] ON dbo.stok;
    END;
    CREATE NONCLUSTERED INDEX [IX_STOK_URUN_AD_ARAMA] ON dbo.stok (urun) INCLUDE (urunkodu,fiyatı,STK_FULL,Raf,grubu);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.kasa') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_KASA_ID' AND object_id = OBJECT_ID('dbo.kasa'))
    BEGIN
        DROP INDEX [IX_KASA_ID] ON dbo.kasa;
    END;
    CREATE NONCLUSTERED INDEX [IX_KASA_ID] ON dbo.kasa (kasaid) INCLUDE (kasa_ack);
END;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.banka') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_BANKA_ID' AND object_id = OBJECT_ID('dbo.banka'))
    BEGIN
        DROP INDEX [IX_BANKA_ID] ON dbo.banka;
    END;
    CREATE NONCLUSTERED INDEX [IX_BANKA_ID] ON dbo.banka (id) INCLUDE (banka,sube);
END;
GO

PRINT '⚡ İşlem tamamlandı. Sorgu plan hafızası sıfırlanıyor...';
DBCC FREEPROCCACHE;
GO
