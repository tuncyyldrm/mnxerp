-- =========================================================================================
-- Prosedür: sp_SayimSistemeIsle
-- Amaç    : Web El Terminali / Mobil Depo Sayım oturumunu Onelee ERP tablolarına 
--           (INDX_SAYIM, INDX_SAYIM_STOK, INDX_SAYIM_STOK_ALT) işler.
--           Stoklar eşitlendiğinde, oluşan sayım farkları (fazlalık/eksiklik) için
--           stok hareket defterine (islemkaydı ve islem) 'SAYIM FİŞİ' oluşturur;
--           böylece ürün detayında stok hareket geçmişinde tam izlenebilirlik sağlanır.
-- Uyumluluk: SQL Server 2008+ (Compatibility Level 100 destekli XML ayrıştırma)
-- =========================================================================================

IF OBJECT_ID('dbo.sp_SayimSistemeIsle', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_SayimSistemeIsle;
GO

CREATE PROCEDURE dbo.sp_SayimSistemeIsle
    @SayimAdi NVARCHAR(200) = N'Web Depo Sayımı',
    @SayimXml NVARCHAR(MAX),
    @KullaniciId INT = 1,
    @StoklariGuncelle BIT = 1 -- 1 ise stok tablosundaki STK_FULL, STK_MERKEZ, STK_GERCEK eşitlenir ve hareket fişi yazılır
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SyId INT = 0;
    DECLARE @IkId INT = 0;
    DECLARE @FarkSayisi INT = 0;
    DECLARE @OneleeSaat DATETIME;
    DECLARE @XmlData XML;

    SET @OneleeSaat = DATEADD(day, DATEDIFF(day, GETDATE(), '19000101'), GETDATE());

    BEGIN TRY
        SET @XmlData = CAST(@SayimXml AS XML);
    END TRY
    BEGIN CATCH
        SELECT 0 AS [Success], N'Geçersiz XML formatı: ' + ERROR_MESSAGE() AS [Message], 0 AS [SyId];
        RETURN;
    END CATCH

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Sayım Başlığını Oluştur (INDX_SAYIM)
        INSERT INTO [dbo].[INDX_SAYIM] (
            [S_NAME],
            [S_DATE],
            [S_TIME],
            [F_DATE],
            [F_TIME],
            [S_STATU],
            [A_DATE],
            [A_TIME],
            [A_STATU]
        )
        VALUES (
            @SayimAdi,
            CAST(GETDATE() AS DATE),
            @OneleeSaat,
            CAST(GETDATE() AS DATE),
            @OneleeSaat,
            CASE WHEN @StoklariGuncelle = 1 THEN 'K' ELSE 'A' END, -- K: Kapalı/İşlendi, A: Açık
            CAST(GETDATE() AS DATE),
            @OneleeSaat,
            'A'
        );

        SET @SyId = SCOPE_IDENTITY();

        -- 2. XML Verisini Geçici Tabloya Çıkar
        CREATE TABLE #TempSayim (
            urunkodu NVARCHAR(100),
            sayilanStok FLOAT,
            raf NVARCHAR(50)
        );

        INSERT INTO #TempSayim (urunkodu, sayilanStok, raf)
        SELECT 
            T.c.value('(kod)[1]', 'NVARCHAR(100)') AS urunkodu,
            T.c.value('(adet)[1]', 'FLOAT') AS sayilanStok,
            T.c.value('(raf)[1]', 'NVARCHAR(50)') AS raf
        FROM @XmlData.nodes('/items/item') AS T(c);

        -- 3. Sayım Kalemlerini Onelee INDX_SAYIM_STOK Tablosuna Yaz
        INSERT INTO [dbo].[INDX_SAYIM_STOK] (
            [SY_ID],
            [S_ID],
            [S_CODE],
            [S_NAME],
            [S_STOK],
            [S_ADET],
            [S_STATU]
        )
        SELECT 
            @SyId,
            ISNULL(s.[oto], 0),
            t.urunkodu,
            ISNULL(s.[urun], t.urunkodu),
            ISNULL(s.[STK_FULL], 0),
            t.sayilanStok,
            'A'
        FROM #TempSayim t
        LEFT JOIN [dbo].[stok] s WITH (NOLOCK) ON s.[urunkodu] = t.urunkodu;

        -- 4. Sayım Detaylarını INDX_SAYIM_STOK_ALT Tablosuna Yaz
        INSERT INTO [dbo].[INDX_SAYIM_STOK_ALT] (
            [S_TIME],
            [U_ID],
            [S_ID],
            [SY_ID],
            [SS_ID],
            [D_CODE],
            [S_ADET],
            [S_NOT],
            [S_STATU]
        )
        SELECT 
            GETDATE(),
            @KullaniciId,
            ISNULL(s.[oto], 0),
            @SyId,
            ss.[SS_ID],
            ISNULL(NULLIF(t.raf, ''), ISNULL(s.[Raf], '')),
            t.sayilanStok,
            N'Web Terminal Sayımı',
            'A'
        FROM #TempSayim t
        LEFT JOIN [dbo].[stok] s WITH (NOLOCK) ON s.[urunkodu] = t.urunkodu
        LEFT JOIN [dbo].[INDX_SAYIM_STOK] ss WITH (NOLOCK) ON ss.[SY_ID] = @SyId AND ss.[S_CODE] = t.urunkodu;

        -- 5. STOK HAREKETLERİNE SAYIM FARKI İŞLEME (Audit Trail / Sayım Fişi Hareketi)
        IF @StoklariGuncelle = 1
        BEGIN
            -- Fark olan kalem sayısını kontrol et
            SELECT @FarkSayisi = COUNT(*) 
            FROM #TempSayim t
            INNER JOIN [dbo].[stok] s WITH (NOLOCK) ON s.[urunkodu] = t.urunkodu
            WHERE (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) <> 0;

            IF @FarkSayisi > 0
            BEGIN
                -- 5.a. islemkaydı başlığı oluştur
                INSERT INTO [dbo].[islemkaydı] (
                    [id], [id_ilgili], [id_name], 
                    [islemtipi], [grubu], [grubu_a], 
                    [belgenumarası], [belgetarihi], [belgesaati], 
                    [faturanumarası], [faturatarihi], [faturasaati],
                    [irsaliyenumarası], [irsaliyetarihi], [irsaliyesaati],
                    [vadetarihi], [vadesaati],
                    [isyeri], [ack], [personel], [cdonemi], [ozelkod],
                    [kapat], [theme],
                    [TT], [TA], [BB], [AB], [BB_TL], [AB_TL],
                    [P_DATE], [P_TIME], [I_KEY], [I_UUID]
                )
                VALUES (
                    0, 0, N'DEPO SAYIMI - SAYIM FARKI',
                    N'SAYIM FİŞİ', 'SYM', 'SYM',
                    N'SYM-' + CAST(@SyId AS NVARCHAR(50)), CAST(GETDATE() AS DATE), @OneleeSaat,
                    N'SYM-' + CAST(@SyId AS NVARCHAR(50)), CAST(GETDATE() AS DATE), @OneleeSaat,
                    N'SYM-' + CAST(@SyId AS NVARCHAR(50)), CAST(GETDATE() AS DATE), @OneleeSaat,
                    CAST(GETDATE() AS DATE), @OneleeSaat,
                    '1', @SayimAdi, @KullaniciId, CAST(YEAR(GETDATE()) AS NVARCHAR(50)), N'SAYIM',
                    NULL, N'WEB_SAYIM',
                    0.0, 'A', 0.0, 0.0, 0.0, 0.0,
                    CAST(GETDATE() AS DATE), @OneleeSaat,
                    UPPER(LEFT(REPLACE(NEWID(), '-', ''), 24)), CAST(NEWID() AS VARCHAR(40))
                );

                SET @IkId = SCOPE_IDENTITY();

                -- 5.b. Fark olan her ürün için islem satırı oluştur (Giriş / Çıkış)
                INSERT INTO [dbo].[islem] (
                    [islemnumarası], [ikid_bag], [oto], 
                    [detay_kodu], [detay], [birim], 
                    [alısmiktar], [satısmiktar], 
                    [I_TYPE], [I_SR], 
                    [stok], [depo], [birimfiyat], 
                    [net], [temp_tutar], 
                    [I_DATE], [I_TIME], [I_LONG], [O_STATU]
                )
                SELECT 
                    @IkId, @IkId, ISNULL(s.[oto], 1),
                    s.[urunkodu], s.[urun], ISNULL(s.[birim], 'ADET'),
                    -- Fark > 0 ise Alış/Giriş (Sayım Fazlası)
                    CASE WHEN (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) > 0 
                         THEN (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) 
                         ELSE 0.0 
                    END AS alısmiktar,
                    -- Fark < 0 ise Satış/Çıkış (Sayım Eksiği)
                    CASE WHEN (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) < 0 
                         THEN ABS(t.sayilanStok - ISNULL(s.[STK_FULL], 0)) 
                         ELSE 0.0 
                    END AS satısmiktar,
                    CASE WHEN (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) > 0 THEN 'A' ELSE 'S' END AS I_TYPE,
                    1,
                    (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) AS stok,
                    'MERKEZ',
                    ISNULL(s.[fiyatı], 0.0),
                    0.0, 0.0,
                    CAST(GETDATE() AS DATE), @OneleeSaat, CAST(GETDATE() AS DATETIME), 'SNC'
                FROM #TempSayim t
                INNER JOIN [dbo].[stok] s WITH (NOLOCK) ON s.[urunkodu] = t.urunkodu
                WHERE (t.sayilanStok - ISNULL(s.[STK_FULL], 0)) <> 0;
            END

            -- 5.c. stok tablosunu güncel sayılan adetlere eşitle
            UPDATE s
            SET 
                s.[STK_FULL]   = t.sayilanStok,
                s.[STK_MERKEZ] = t.sayilanStok,
                s.[STK_GERCEK] = t.sayilanStok,
                s.[Raf]        = CASE 
                                   WHEN t.raf IS NOT NULL AND RTRIM(LTRIM(t.raf)) <> '' 
                                   THEN RTRIM(LTRIM(t.raf)) 
                                   ELSE s.[Raf] 
                                 END
            FROM [dbo].[stok] s
            INNER JOIN #TempSayim t ON s.[urunkodu] = t.urunkodu;
        END

        DROP TABLE #TempSayim;

        COMMIT TRANSACTION;

        SELECT 
            1 AS [Success], 
            N'Sayım ve stok hareketleri başarıyla sisteme işlendi.' AS [Message], 
            @SyId AS [SyId],
            @IkId AS [IkId];

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        IF OBJECT_ID('tempdb..#TempSayim') IS NOT NULL
            DROP TABLE #TempSayim;

        SELECT 
            0 AS [Success], 
            ERROR_MESSAGE() AS [Message], 
            0 AS [SyId],
            0 AS [IkId];
    END CATCH
END
GO
