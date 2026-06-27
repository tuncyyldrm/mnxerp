USE [ONEDB];
GO

PRINT '--- 1. sp_UrunHareketAnaliz Prosedürü Optimize Ediliyor ---';
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- 🗑️ Eğer prosedür zaten varsa önce güvenli bir şekilde siliyoruz
IF OBJECT_ID('[dbo].[sp_UrunHareketAnaliz]', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[sp_UrunHareketAnaliz];
END
GO

-- ✨ Şimdi sıfırdan ve temiz bir şekilde oluşturuyoruz
CREATE PROCEDURE [dbo].[sp_UrunHareketAnaliz]
    @DetayKodu NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- SQL Server'ın RAM'de sıralama (Sort) hatasına düşmesini engellemek için
    -- ve eldeki IX_Islem_DetayKodu_Bakiye_Optimize indeksini tam sömürmesi için optimize edildi.
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
    -- Mevcut index yapısındaki i.ikid_bag bağını doğrudan anahtara paslıyoruz
    LEFT JOIN dbo.islemkaydı ik WITH (NOLOCK) ON i.ikid_bag = ik.ikid
    WHERE i.detay_kodu = @DetayKodu
    -- Performans İpucu: Optimizer'ın kafasını karıştırmamak için tablo yönlendirmeli sıralama
    ORDER BY i.detay_kodu DESC, i.I_DATE DESC, i.I_TIME DESC; 
END
GO