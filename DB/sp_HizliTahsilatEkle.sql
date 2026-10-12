USE [ONEDB]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_HizliTahsilatEkle]
    @CariId INT,
    @CariAdi NVARCHAR(255),
    @KasaId INT,
    @Tutar FLOAT,
    @Aciklama NVARCHAR(255) = N'HIZLI TAHSİLAT',
    @IslemTipi NVARCHAR(50) = N'NAKİT TAHSİLAT' -- 'NAKİT TAHSİLAT' veya 'KREDİ KARTI TAHSİLAT'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IslemNo INT = 0;
    DECLARE @SonBelgeNo NVARCHAR(50) = N'';
    DECLARE @YeniBelgeNo NVARCHAR(50) = N'';
    DECLARE @SayisalKisim INT = 0;
    DECLARE @Grubu NVARCHAR(10) = 'NT';

    DECLARE @VarsayilanPersonelID INT = 1;
    DECLARE @GuncelDolarKuru FLOAT = 1.0;
    DECLARE @GuncelEuroKuru FLOAT = 1.0;
    DECLARE @AktifDonem NVARCHAR(50);
    DECLARE @IslemAyi NVARCHAR(10);
    DECLARE @OneleeSaat DATETIME;

    DECLARE @TotalBorc FLOAT = 0.0;
    DECLARE @TotalAlacak FLOAT = 0.0;
    DECLARE @NetBakiye FLOAT = 0.0;

    IF @IslemTipi LIKE N'%KART%' OR @IslemTipi = 'KKT'
    BEGIN
        SET @Grubu = 'KKT';
        SET @IslemTipi = N'KREDİ KARTI TAHSİLAT';
    END
    ELSE
    BEGIN
        SET @Grubu = 'NT';
        SET @IslemTipi = N'NAKİT TAHSİLAT';
    END

    SET @OneleeSaat = DATEADD(day, DATEDIFF(day, GETDATE(), '19000101'), GETDATE());
    SET @IslemAyi = CAST(MONTH(GETDATE()) AS NVARCHAR(10));

    SELECT TOP 1 @AktifDonem = ISNULL(cdonemi, CAST(YEAR(GETDATE()) AS NVARCHAR(50)))
    FROM [dbo].[islemkaydı] ORDER BY ikid DESC;

    SELECT TOP 1 @GuncelDolarKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'USD';
    SELECT TOP 1 @GuncelEuroKuru = ISNULL([kur_PS], 1.0) FROM [dbo].[doviz] WHERE [birim] = 'EUR';

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Son Belge Numarasını Al ve Artır
        SELECT TOP 1 @SonBelgeNo = ISNULL(belgenumarası, N'')
        FROM [dbo].[islemkaydı]
        WHERE grubu = @Grubu
          AND ISNULL(belgenumarası, N'') <> N''
          AND ISNUMERIC(belgenumarası) = 1
        ORDER BY ikid DESC;

        IF @SonBelgeNo = N'' SET @SonBelgeNo = N'0000000001';
        SET @SayisalKisim = CAST(@SonBelgeNo AS INT) + 1;
        SET @YeniBelgeNo = RIGHT('0000000000' + CAST(@SayisalKisim AS NVARCHAR(50)), LEN(@SonBelgeNo));

        -- 2. islemkaydı Başlığı (Tahsilat: TA = 'A', Alacak Tutarı = @Tutar)
        INSERT INTO [dbo].[islemkaydı] (
            id, id_ilgili, id_name, islemtipi,
            grubu, grubu_a,
            belgenumarası, belgetarihi, belgesaati,
            faturanumarası, faturatarihi, faturasaati,
            irsaliyenumarası, irsaliyetarihi, irsaliyesaati,
            vadetarihi, vadesaati,
            isyeri, ack, personel, cdonemi, ozelkod,
            kapat, isk_oranı, isk_tutarı, isk_tevkifat, theme, cardid,
            TDH_STATU, belge_dovizi, Kur_USD, Kur_EUR,
            TT, TA, BB, AB, BB_TL, AB_TL,
            P_DATE, P_TIME, I_KEY, I_UUID
        )
        VALUES (
            @CariId, 0, CAST(@CariAdi AS VARCHAR(500)),
            @IslemTipi,
            @Grubu, @Grubu,
            @YeniBelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat,
            @YeniBelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat,
            @YeniBelgeNo, CAST(GETDATE() AS DATE), @OneleeSaat,
            CAST(GETDATE() AS DATE), @OneleeSaat,
            '1', ISNULL(@Aciklama, N'HIZLI TAHSİLAT'), @VarsayilanPersonelID, @AktifDonem, N'WEB_ERP',
            NULL, 0.0, 0.0, 0.0, N'WEB_TAHSILAT', NULL,
            '0', 'TL',
            @GuncelDolarKuru,
            @GuncelEuroKuru,
            @Tutar,
            'A', -- Alacak (Müşterinin borcunu düşürür)
            0.0, @Tutar, 0.0, @Tutar,
            CAST(GETDATE() AS DATE),
            @OneleeSaat,
            UPPER(LEFT(REPLACE(NEWID(), '-', ''), 24)),
            CAST(NEWID() AS VARCHAR(40))
        );

        SET @IslemNo = SCOPE_IDENTITY();

        -- 3. islem Satırı (Kasa veya POS hareket satırı)
        INSERT INTO [dbo].[islem] (
            islemnumarası, oto, birimfiyat, birimfiyat_Doviz, birim, birim_kodu,
            alısmiktar, satısmiktar, kdvoranı, kdv, otvoranı, otv,
            iskontooranı, iskonto, alıstutarıham, satıstutarıham,
            alıstutarı, satıstutarı, net, stok, detay, detay_kodu, detay_grubu,
            Cariid, kasaid, bankaid, ccardid, hostingid,
            ay, ikid_bag, depo, I_TYPE, I_SR, doviz, temp_tutar,
            I_DATE, I_TIME, I_LONG, B_COST, O_STATU
        )
        VALUES (
            @IslemNo, 1, @Tutar, 0.0, 'ADET', 'C62',
            0.0, 0.0, 0, 0.0, 0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            @Tutar, 0.0, @Tutar, 0.0,
            ISNULL(@Aciklama, N'TAHSİLAT'), '-', 'TL',
            @CariId, @KasaId, 0, 0, 0,
            @IslemAyi, @IslemNo, 'MERKEZ', '', 1, 'TL',
            @Tutar,
            CAST(GETDATE() AS DATE),
            @OneleeSaat,
            CAST(GETDATE() AS DATETIME), 0.0, 'SNC'
        );

        -- 4. Kasa Bakiyesini Artır
        IF @KasaId > 0
        BEGIN
            UPDATE [dbo].[kasa]
            SET BK_TL = ISNULL(BK_TL, 0) + @Tutar
            WHERE kasaid = @KasaId;
        END

        -- 5. Cari Net Bakiyesini Yeniden Hesapla ve Güncelle
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

        SELECT 1 AS [Success], N'Tahsilat başarıyla kaydedildi ve kasa bakiyesi güncellendi.' AS [Message], @IslemNo AS [IslemNo], @YeniBelgeNo AS [BelgeNo];

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT 0 AS [Success], ERROR_MESSAGE() AS [Message], 0 AS [IslemNo], '' AS [BelgeNo];
    END CATCH
END
GO
