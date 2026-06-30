USE [ONEDB]
GO

/****** Object:  StoredProcedure [dbo].[sp_KatalogtanSatisEkle]    Script Date: 01.07.2026 01:53:20 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER   PROCEDURE [dbo].[sp_KatalogtanSatisEkle]
    @CariId INT,               
    @CariAdi NVARCHAR(255),    
    @UrunAdi NVARCHAR(255),    
    @StokKodu NVARCHAR(100),   
    @Miktar FLOAT,             
    @BirimFiyat FLOAT,         
    @KdvOrani INT = 20,        
    @Birim NVARCHAR(50) = N'ADET'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IslemNo INT = 0;
    DECLARE @StokOtoId INT = 0; 
    DECLARE @HamTutar FLOAT;
    DECLARE @KdvTutari FLOAT;
    DECLARE @ToplamTutar FLOAT;
    DECLARE @BelgeNo NVARCHAR(50);
    DECLARE @VarsayilanPersonelID INT = 1; 

    DECLARE @GuncelDolarKuru FLOAT = 1.0;
    DECLARE @GuncelEuroKuru FLOAT = 1.0;
    
    SET @HamTutar = @Miktar * @BirimFiyat; 
    SET @KdvTutari = @HamTutar * (CAST(@KdvOrani AS FLOAT) / 100.0); 
    SET @ToplamTutar = @HamTutar + @KdvTutari; 
    
    -- 🚀 İstediğin gibi 'KAT-' formatında gitmeye devam ediyor
    SET @BelgeNo = N'KAT-' + REPLACE(CONVERT(VARCHAR, GETDATE(), 112), '-', '');

    -- Döviz kurlarını çekiyoruz
    SELECT TOP 1 @GuncelDolarKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'USD';
    SELECT TOP 1 @GuncelEuroKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'EUR';

    SELECT TOP 1 @StokOtoId = [oto] FROM [dbo].[stok] WHERE [urunkodu] = @StokKodu;
    
    IF @StokOtoId IS NULL OR @StokOtoId = 0 SET @StokOtoId = 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Katalog faturasını kendi izole grubumuz ('KT') üzerinden kontrol ediyoruz
        SELECT TOP 1 @IslemNo = ik.ikid 
        FROM [dbo].[islemkaydı] ik WITH (UPDLOCK)
        WHERE ik.id = @CariId 
          AND ik.islemtipi = 'SATIŞ FATURASI'
          AND ik.grubu = 'KT' -- 🚀 İzole grup araması
          AND ik.belgenumarası = @BelgeNo 
          AND CAST(ik.belgetarihi AS DATE) = CAST(GETDATE() AS DATE);

        -- 2. Eğer o güne ait katalog faturası yoksa YENİ BAŞLIK açıyoruz
        IF @IslemNo = 0 OR @IslemNo IS NULL
        BEGIN
            INSERT INTO [dbo].[islemkaydı] (
                id, id_ilgili, id_name, islemtipi, 
                grubu, grubu_a,                                    -- 🎯 BURASI DEĞİŞTİ: Onelee sayacından gizlemek için 'KT' yapıldı
                belgenumarası, belgetarihi, belgesaati, 
                faturanumarası, faturatarihi, faturasaati,
                irsaliyenumarası, irsaliyetarihi, irsaliyesaati,  
                vadetarihi, vadesaati,                             
                isyeri, cdonemi, personel, ozelkod,                                          
                kapat, isk_oranı, isk_tutarı, isk_tevkifat, theme, cardid, 
                TDH_STATU, belge_dovizi, Kur_USD, Kur_EUR, 
                TT, TA, BB, AB, BB_TL, AB_TL, 
                P_DATE, P_TIME, I_KEY, I_UUID
            )
            VALUES (
                @CariId, 0, CAST(@CariAdi AS VARCHAR(500)), 
                'SATIŞ FATURASI', 
                'KT', 'KT',                                        -- 🎯 ÇÖZÜM: Onelee'nin normal SF sayacı artık burayı tarayamaz!
                @BelgeNo, CAST(GETDATE() AS DATE), CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME), 
                @BelgeNo, CAST(GETDATE() AS DATE), CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME), 
                @BelgeNo, CAST(GETDATE() AS DATE), CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME), 
                CAST(GETDATE() AS DATE), CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME),          
                '1', YEAR(GETDATE()), @VarsayilanPersonelID, N'KATALOG',
                NULL, 0.0, 0.0, 0.0, NULL, NULL,
                '0', 'TL', 
                @GuncelDolarKuru,        
                @GuncelEuroKuru,         
                @ToplamTutar, 
                'B',                     
                @ToplamTutar, 0.0, @ToplamTutar, 0.0, 
                CAST(GETDATE() AS DATE), 
                CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME),
                UPPER(LEFT(REPLACE(NEWID(), '-', ''), 24)), 
                CAST(NEWID() AS VARCHAR(40)) 
            );

            SET @IslemNo = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            -- 3. Mevcut faturaya ekleme yapılıyorsa kümülatif toplamları büyütüyoruz
            UPDATE [dbo].[islemkaydı]
            SET TT = ISNULL(TT, 0) + @ToplamTutar,
                BB = ISNULL(BB, 0) + @ToplamTutar,
                BB_TL = ISNULL(BB_TL, 0) + @ToplamTutar
            WHERE ikid = @IslemNo;
        END

        -- 4. FATURA SATIRI EKLEME
        INSERT INTO [dbo].[islem] (
            islemnumarası, oto, birimfiyat, birimfiyat_Doviz, birim, birim_kodu, alısmiktar, satısmiktar, 
            kdvoranı, kdv, otvoranı, otv, iskontooranı, iskonto, 
            alıstutarıham, satıstutarıham, alıstutarı, satıstutarı, net, 
            stok, detay, detay_kodu, detay_grubu, Cariid,
            kasaid, bankaid, ccardid, hostingid,
            ay, ikid_bag, depo, I_TYPE, I_SR, doviz, temp_tutar, 
            I_DATE, I_TIME, I_LONG, B_COST, O_STATU
        )
        VALUES (
            @IslemNo, @StokOtoId, @BirimFiyat, 0.0, CAST(@Birim AS VARCHAR(50)), 'C62', 0.0, @Miktar, 
            @KdvOrani, @KdvTutari, 0, 0.0, 0.0, 0.0, 
            0.0, @HamTutar, 0.0, @ToplamTutar, 
            -@ToplamTutar,       
            -@Miktar, 
            CAST(@UrunAdi AS VARCHAR(300)), CAST(@StokKodu AS VARCHAR(300)), 'TL', 1,
            0, 0, 0, 0, 
            MONTH(GETDATE()), @IslemNo, 'MERKEZ', 'S', 1, 'TL', 
            @HamTutar,           
            CAST(GETDATE() AS DATE), 
            CAST('1900-01-01 ' + CONVERT(VARCHAR, GETDATE(), 108) AS DATETIME), 
            CAST(GETDATE() AS DATETIME), @BirimFiyat, 'SNC'
        );

        -- 5. STOK DÜŞÜRME ADIMI
        IF @StokOtoId > 1
        BEGIN
            UPDATE [dbo].[stok]
            SET STK_MERKEZ = ISNULL(STK_MERKEZ, 0) - @Miktar,
                STK_GERCEK = ISNULL(STK_GERCEK, 0) - @Miktar,
                STK_FULL   = ISNULL(STK_FULL, 0) - @Miktar,
                STK_KALAN  = ISNULL(STK_KALAN, 0)
            WHERE [oto] = @StokOtoId;
        END

        COMMIT TRANSACTION;

        SELECT 1 AS [Success], N'Ürün başarıyla faturaya eklendi.' AS [Message], @IslemNo AS [IslemNo];

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT 0 AS [Success], ERROR_MESSAGE() AS [Message], 0 AS [IslemNo];
    END CATCH
END
GO


