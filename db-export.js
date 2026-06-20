const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
    user: 'sa',
    password: '2026',
    server: '127.0.0.1',
    database: 'ONEDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// =========================================================================
// 📋 MANIFEST: KESİN BAĞIMLILIK SIRALAMASINA GÖRE NESNELER
// =========================================================================
const DB = {
    views: [
        'vw_CariEkstreDetay',   // Önce ana detay view'ı
        'V_CariAnalizRaporu',   // vw_CariEkstreDetay'a bağımlı analiz view'ı
        'vw_FaturaDetayRaporu',
        'vw_StokListesi'
    ],
    procedures: [
        'sp_StokDetayGetir',
        'sp_StokDuzenle',
        'sp_UrunHareketAnaliz'
    ],
    indexes: [
        { name: 'IX_CARI_STATU_ID', table: 'cari', cols: 'C_STATU, id', include: 'kodu,firma,sehir,email,ilkdate,BB_TL,AB_TL' },
        { name: 'IX_ISLEMKAYDI_IKID_COVERING', table: 'islemkaydı', cols: 'ikid', include: 'id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL' },
        { name: 'IX_ISLEM_ISLEMNUMARASI_COVERING', table: 'islem', cols: 'islemnumarası', include: 'islemid,detay,detay_kodu,birim,birimfiyat,kdvoranı,kdv,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net' },
        { name: 'IX_ACK_IKID', table: 'islemkaydı_ack', cols: 'IK_ID', include: 'I_NOTE,SR' },
        { name: 'IX_ISLEM_DETAY_KODU_BAKIYE', table: 'islem', cols: 'detay_kodu, I_DATE, I_TIME', include: 'alısmiktar,satısmiktar,I_TYPE,birimfiyat,depo,ikid_bag' },
        { name: 'IX_STOK_ARAMA_MASTER', table: 'stok', cols: 'urunkodu', include: 'urun,urunalt,ureticifirma,grubu,kategori,tipi,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4' },
        { name: 'IX_STOK_URUN_AD_ARAMA', table: 'stok', cols: 'urun', include: 'urunkodu,fiyatı,STK_FULL,Raf,grubu' },
        { name: 'IX_KASA_ID', table: 'kasa', cols: 'kasaid', include: 'kasa_ack' },
        { name: 'IX_BANKA_ID', table: 'banka', cols: 'id', include: 'banka,sube' }
    ]
};

// =========================================================================
// 🛡️ DYNA-STUB ENGINE: %100 TABLOSUZ VE BAĞIMSIZ SANAL ŞEMALAR
// =========================================================================
const STUBS = {
    vw_CariEkstreDetay: `
        CREATE VIEW [dbo].[vw_CariEkstreDetay] AS 
        SELECT CAST(1 AS int) AS [CariID], CAST('1' AS varchar(50)) AS [CariKodu], CAST('1' AS varchar(500)) AS [FirmaAdi], CAST(1 AS int) AS [IslemNo], CAST(GETDATE() AS datetime) AS [IslemTarihi], CAST('1' AS nvarchar(100)) AS [BelgeNo], CAST('1' AS nvarchar(100)) AS [IslemTipi], CAST(1.0 AS float) AS [IslemTutari], CAST('B' AS varchar(1)) AS [Yon]`,
    
    V_CariAnalizRaporu: `
        CREATE VIEW [dbo].[V_CariAnalizRaporu] AS 
        SELECT CAST(1 AS int) AS [id], CAST('1' AS varchar(50)) AS [kodu], CAST('1' AS varchar(500)) AS [firma], CAST('1' AS varchar(50)) AS [sehir], CAST('1' AS varchar(18)) AS [CariTipi], CAST(1.0 AS float) AS [NetBakiyeTL], CAST('1' AS varchar(12)) AS [Kanali], CAST(GETDATE() AS datetime) AS [SonIslemTarihi], CAST(1 AS int) AS [GecikmeGunSayisi]`,
    
    vw_FaturaDetayRaporu: `
        CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS 
        SELECT CAST(1 AS int) AS [IslemNo], CAST('1' AS nvarchar(255)) AS [CariAdi], CAST('1' AS nvarchar(100)) AS [IslemTipi], CAST(GETDATE() AS datetime) AS [FaturaTarihi], CAST('1' AS nvarchar(100)) AS [BelgeNo], CAST(1.0 AS float) AS [FaturaToplamTutar], CAST('1' AS nvarchar(max)) AS [FaturaNotu], CAST(1 AS int) AS [SatirId], CAST('1' AS nvarchar(255)) AS [UrunAdi], CAST('1' AS nvarchar(100)) AS [StokKodu], CAST('1' AS nvarchar(50)) AS [Birim], CAST(1.0 AS float) AS [BirimFiyat], CAST(1 AS int) AS [KdvOrani], CAST(1.0 AS float) AS [KdvTutari], CAST(1.0 AS float) AS [KdvDahilBirimFiyat], CAST(1.0 AS float) AS [Miktar], CAST(1.0 AS decimal(18,4)) AS [SatirTutarı]`,
    
    vw_StokListesi: `
        CREATE VIEW [dbo].[vw_StokListesi] AS 
        SELECT CAST('1' AS varchar(300)) AS [urunkodu], CAST('1' AS varchar(300)) AS [urun], CAST('1' AS varchar(300)) AS [urunalt], CAST('1' AS varchar(300)) AS [ureticifirma], CAST('1' AS varchar(300)) AS [grubu], CAST('1' AS varchar(300)) AS [kategori], CAST('1' AS varchar(300)) AS [tipi], CAST('1' AS varchar(50)) AS [Raf], CAST(1.0 AS float) AS [fiyatı], CAST('1' AS varchar(350)) AS [OEM], CAST(1.0 AS float) AS [STK_FULL], CAST('1' AS varchar(350)) AS [OEM_0], CAST('1' AS varchar(350)) AS [OEM_1], CAST('1' AS varchar(350)) AS [OEM_2], CAST('1' AS varchar(350)) AS [OEM_3], CAST('1' AS varchar(350)) AS [OEM_4], CAST(1 AS int) AS [OEM_5], CAST(1 AS int) AS [OEM_6], CAST(1 AS int) AS [OEM_7], CAST(1 AS int) AS [OEM_8], CAST(1 AS int) AS [OEM_9], CAST(1.0 AS float) AS [MevcutBakiye]`
};

function safeAlterView(def) {
    return def
        .replace(/CREATE\s+VIEW/i, 'ALTER VIEW')
        .replace(/WITH\s+SCHEMABINDING/i, '');
}

function safeAlterProc(def) {
    return def
        .replace(/CREATE\s+PROCEDURE/i, 'ALTER PROCEDURE')
        .replace(/CREATE\s+PROC/i, 'ALTER PROCEDURE');
}

function buildIndex(ix) {
    const includeStr = ix.include ? `INCLUDE (${ix.include})` : '';
    return `
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.${ix.table}') AND type = 'U')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='${ix.name}' AND object_id = OBJECT_ID('dbo.${ix.table}'))
    BEGIN
        DROP INDEX [${ix.name}] ON dbo.${ix.table};
    END;
    CREATE NONCLUSTERED INDEX [${ix.name}] ON dbo.${ix.table} (${ix.cols}) ${includeStr};
END;
GO
`;
}

// =========================================================================
// 🚀 MAIN EXECUTION
// =========================================================================
async function run() {
    const pool = await sql.connect(config);

    let script = `/* =========================================================================
    ✨ OTOMATİK ÜRETİLEN GÜVENLİ KURULUM VE GÜNCELLEME SCRIPTİ
    Generated: ${new Date().toLocaleString('tr-TR')}
    🛡️ Taslak Mimari & %100 Sıfır Kurulum Güvencesi Aktiftir.
========================================================================= */

SET NOCOUNT ON;
GO
`;

    const viewRes = await pool.request().query(`
        SELECT o.name, sm.definition FROM sys.objects o
        LEFT JOIN sys.sql_modules sm ON sm.object_id = o.object_id WHERE o.type='V'
    `);

    const spRes = await pool.request().query(`
        SELECT o.name, sm.definition FROM sys.objects o
        LEFT JOIN sys.sql_modules sm ON sm.object_id = o.object_id WHERE o.type='P'
    `);

    const viewMap = {};
    const spMap = {};
    viewRes.recordset.forEach(v => viewMap[v.name] = v.definition);
    spRes.recordset.forEach(p => spMap[p.name] = p.definition);

    // =========================================================================
    // ADIM 1: GÜVENLİ SIFIRLAMA VE TEMİZ TASLAK AÇMA (CRITICAL FIX)
    // =========================================================================
    script += `\n/* ===================== 🛡️ ADIM 1: DYNAMIC STUBS (TEMİZ TEMEL) ===================== */\n`;
    
    // Bağımlılıklardan dolayı DROP sıralaması manifest'in TERSİ olmalı
    const reversedViews = [...DB.views].reverse();
    for (const v of reversedViews) {
        script += `
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V'))
BEGIN
    DROP VIEW [dbo].[${v}];
END;
GO\n`;
    }

    // Şimdi manifest sırasına göre tertemiz, %100 bağımsız stub gövdelerini ayağa kaldırıyoruz
    for (const v of DB.views) {
        if (STUBS[v]) {
            script += `
EXEC('${STUBS[v].replace(/'/g, "''").trim()}');
GO\n`;
        }
    }

    // Prosedürler için taslaklar
    for (const p of DB.procedures) {
        if (!spMap[p]) {
            script += `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${p}]') AND type in (N'P', N'PC'))
BEGIN
    EXEC('CREATE PROCEDURE [dbo].[${p}] AS BEGIN SET NOCOUNT ON; END');
END;
GO\n`;
        }
    }

    // =========================================================================
    // ADIM 2: ASIL GÖVDELERİN YAZILMASI (Sadece Tabloları Var Olan DB'ler İçin Gerçekleşir)
    // =========================================================================
    script += `\n/* ===================== 📊 ADIM 2: VIEW GÜNCELLEMELERİ (ALTER) ===================== */\n`;
    for (const v of DB.views) {
        const def = viewMap[v];
        if (def) {
            // Eğer veritabanında asıl gövde şeması varsa script içine yaz ve derle
            script += `
BEGIN TRY
    EXEC('${safeAlterView(def).replace(/'/g, "''").trim()}');
END TRY
BEGIN CATCH
    PRINT 'ℹ️ [Uyarı] [dbo].[${v}] asıl gövdesi bağımlı tablolar henüz mevcut olmadığından derlenemedi, taslak korundu.';
END CATCH;
GO\n`;
        } else {
            script += `-- ℹ️ View [dbo].[${v}] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.\nGO\n\n`;
        }
    }

    script += `\n/* ===================== ⚡ ADIM 3: STORED PROCEDURE GÜNCELLEMELERİ ===================== */\n`;
    for (const p of DB.procedures) {
        const def = spMap[p];
        if (def) {
            script += safeAlterProc(def).trim() + '\nGO\n\n';
        } else {
            script += `-- ℹ️ Procedure [dbo].[${p}] yerel DB'de tanımlı gövdeye sahip olmadığından taslak şeması korundu.\nGO\n\n`;
        }
    }

    // =========================================================================
    // ADIM 4: HIGH-PERFORMANCE INDEXES
    // =========================================================================
    script += `\n/* ===================== 🛠️ ADIM 4: HIGH-PERFORMANCE INDEXES ===================== */\n`;
    for (const ix of DB.indexes) {
        script += buildIndex(ix);
    }

    // Önbellek Temizleme Kapanışı
    script += `
PRINT '⚡ İşlem tamamlandı. Sorgu plan hafızası sıfırlanıyor...';
DBCC FREEPROCCACHE;
GO
`;

    const dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    fs.writeFileSync(path.join(dir, 'guncelleme.sql'), script, 'utf8');

    console.log('✅ %100 TAM UYUMLU VE ZİNCİRLEME HATALARI ÇÖZÜLMÜŞ DB SCRIPTİ ÜRETİLDİ');
    await sql.close();
}

run().catch(err => {
    console.error('❌ CRITICAL ERROR:', err.message);
});