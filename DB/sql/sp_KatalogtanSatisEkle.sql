USE [ONEDB]
GO

/****** Object:  StoredProcedure [dbo].[sp_KatalogtanSatisEkle]    Script Date: 02.07.2026 17:15:13 ******/
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
    
    DECLARE @AktifDonem NVARCHAR(50);
    DECLARE @FaturaAyi NVARCHAR(10);
    
    DECLARE @TotalBorc FLOAT = 0.0;
    DECLARE @TotalAlacak FLOAT = 0.0;
    DECLARE @NetBakiye FLOAT = 0.0;
    
    DECLARE @OneleeSaat DATETIME;
    
    SET @HamTutar = @Miktar * @BirimFiyat; 
    SET @KdvTutari = @HamTutar * (CAST(@KdvOrani AS FLOAT) / 100.0); 
    SET @ToplamTutar = @HamTutar + @KdvTutari; 
    
    -- 🎯 GÜNLÜK KÜMÜLATİF MANTIK: Fatura ID sadece tarihe bağlıdır.
    SET @BelgeNo = N'KAT-' + REPLACE(CONVERT(VARCHAR, GETDATE(), 112), '-', '');

    -- Onelee standartlarında saniyeli temiz 1900-01-01 saat ataması
    SET @OneleeSaat = DATEADD(day, DATEDIFF(day, GETDATE(), '19000101'), GETDATE());

    -- Onelee'nin en son kullandığı aktif çalışma dönemini sistemden dinamik alıyoruz
    SELECT TOP 1 @AktifDonem = ISNULL(cdonemi, CAST(YEAR(GETDATE()) AS NVARCHAR(50))) 
    FROM [dbo].[islemkaydı] ORDER BY ikid DESC;

    SET @FaturaAyi = CAST(MONTH(GETDATE()) AS NVARCHAR(10));

    SELECT TOP 1 @GuncelDolarKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'USD';
    SELECT TOP 1 @GuncelEuroKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'EUR';

    SELECT TOP 1 @StokOtoId = [oto] FROM [dbo].[stok] WHERE [urunkodu] = @StokKodu;
    
    IF @StokOtoId IS NULL OR @StokOtoId = 0 SET @StokOtoId = 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. O güne ait, ilgili CARİ kimliğine açılmış katalog faturasını kontrol et
        SELECT TOP 1 @IslemNo = ik.ikid 
        FROM [dbo].[islemkaydı] ik WITH (UPDLOCK)
        WHERE ik.id = @CariId                         -- 🎯 Cari Filtresi (İzolasyonu Sağlar)
          AND ik.islemtipi = 'SATIŞ FATURASI'
          AND ik.grubu = 'SF' 
          AND ik.belgenumarası = @BelgeNo
          AND CAST(ik.belgetarihi AS DATE) = CAST(GETDATE() AS DATE);

        -- 2. Eğer o güne ait bu cariye kayıt açılmamışsa İLK BAŞLIĞI oluştur
        IF @IslemNo = 0 OR @IslemNo IS NULL
        BEGIN
            INSERT INTO [dbo].[islemkaydı] (
                id, id_ilgili, id_name, islemtipi, 
                grubu, grubu_a,                                    
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
                'SF', 'SF',                                        
                @BelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat, 
                @BelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat, 
                @BelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat, 
                CAST(GETDATE() AS DATE), @OneleeSaat,          
                '1', @AktifDonem, @VarsayilanPersonelID, N'KATALOG',
                NULL, 0.0, 0.0, 0.0, NULL, NULL,
                '0', 'TL', 
                @GuncelDolarKuru,        
                @GuncelEuroKuru,         
                @ToplamTutar, 
                'B',                     
                @ToplamTutar, 0.0, @ToplamTutar, 0.0, 
                CAST(GETDATE() AS DATE), 
                @OneleeSaat,
                UPPER(LEFT(REPLACE(NEWID(), '-', ''), 24)), 
                CAST(NEWID() AS VARCHAR(40)) 
            );

            SET @IslemNo = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            -- 3. Aynı cari gün içinde tekrar bir şey alırsa mevcut faturanın tutarlarını büyüt
            UPDATE [dbo].[islemkaydı]
            SET TT = ISNULL(TT, 0) + @ToplamTutar,
                BB = ISNULL(BB, 0) + @ToplamTutar,
                BB_TL = ISNULL(BB_TL, 0) + @ToplamTutar,
                belgesaati = @OneleeSaat,
                faturasaati = @OneleeSaat
            WHERE ikid = @IslemNo;
        END

        -- 4. FATURA SATIRI EKLEME (Her yeni ürün yeni satır olarak faturaya girer)
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
            CAST(@UrunAdi AS VARCHAR(300)), CAST(@StokKodu AS VARCHAR(300)), 'TL', 
            @CariId,                                            
            0, 0, 0, 0, 
            @FaturaAyi, @IslemNo, 'MERKEZ', 'S', 1, 'TL', 
            @HamTutar,           
            CAST(GETDATE() AS DATE), 
            @OneleeSaat, 
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

        -- 6. ONELEE NET BAKİYE STRATEJİSİ
        SELECT @TotalBorc = ISNULL(SUM(BB_TL), 0.0) FROM [dbo].[islemkaydı] WHERE id = @CariId AND TA = 'B';
        SELECT @TotalAlacak = ISNULL(SUM(AB_TL), 0.0) FROM [dbo].[islemkaydı] WHERE id = @CariId AND TA = 'A';

        SET @NetBakiye = @TotalBorc - @TotalAlacak;

        IF @NetBakiye >= 0
        BEGIN
            UPDATE [dbo].[cari] SET BB_TL = @NetBakiye, AB_TL = 0.0 WHERE [id] = @CariId;
        END
        ELSE
        BEGIN
            UPDATE [dbo].[cari] SET BB_TL = 0.0, AB_TL = ABS(@NetBakiye) WHERE [id] = @CariId;
        END

        COMMIT TRANSACTION;

        SELECT 1 AS [Success], N'Günlük kümülatif katalog faturasına ürün başarıyla işlendi.' AS [Message], @IslemNo AS [IslemNo];

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT 0 AS [Success], ERROR_MESSAGE() AS [Message], 0 AS [IslemNo];
    END CATCH
END
GO


