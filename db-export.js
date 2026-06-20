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
// 📋 MANIFEST: TÜM VERİTABANI NESNELERİ VE GÜÇLENDİRİLMİŞ İNDEKS MİMARİSİ
// =========================================================================
const DB = {
    views: [
        'vw_CariEkstreDetay',
        'V_CariAnalizRaporu',
        'vw_FaturaDetayRaporu',
        'vw_StokListesi'
    ],
    procedures: [
        'sp_StokDetayGetir',
        'sp_StokDuzenle',
        'sp_UrunHareketAnaliz'
    ],
    indexes: [
        // Cari ve Cari Analiz Performans İndeksleri
        { name: 'IX_CARI_STATU_ID', table: 'cari', cols: 'C_STATU, id', include: 'kodu,firma,sehir,email,ilkdate,BB_TL,AB_TL' },
        
        // İşlem Kayıtları ve Fatura Raporlama İndeksleri (Covering)
        { name: 'IX_ISLEMKAYDI_IKID_COVERING', table: 'islemkaydı', cols: 'ikid', include: 'id_name,belgetarihi,belgesaati,faturanumarası,belgenumarası,islemtipi,BB_TL,AB_TL' },
        { name: 'IX_ISLEM_ISLEMNUMARASI_COVERING', table: 'islem', cols: 'islemnumarası', include: 'islemid,detay,detay_kodu,birim,birimfiyat,kdvoranı,kdv,alısmiktar,satısmiktar,alıstutarı,satıstutarı,kasaid,bankaid,Cariid,net' },
        { name: 'IX_ACK_IKID', table: 'islemkaydı_ack', cols: 'IK_ID', include: 'I_NOTE,SR' },
        
        // Stok, Arama ve Bakiye Hesaplama Can Damarı İndeksleri (10s -> 5ms Düşüren Kısım)
        { name: 'IX_ISLEM_DETAY_KODU_BAKIYE', table: 'islem', cols: 'detay_kodu, I_DATE, I_TIME', include: 'alısmiktar,satısmiktar,I_TYPE,birimfiyat,depo,ikid_bag' },
        { name: 'IX_STOK_ARAMA_MASTER', table: 'stok', cols: 'urunkodu', include: 'urun,urunalt,ureticifirma,grubu,kategori,tipi,Raf,fiyatı,OEM,STK_FULL,OEM_0,OEM_1,OEM_2,OEM_3,OEM_4' },
        { name: 'IX_STOK_URUN_AD_ARAMA', table: 'stok', cols: 'urun', include: 'urunkodu,fiyatı,STK_FULL,Raf,grubu' },
        
        // Finansal Yardımcı İndeksler
        { name: 'IX_KASA_ID', table: 'kasa', cols: 'kasaid', include: 'kasa_ack' },
        { name: 'IX_BANKA_ID', table: 'banka', cols: 'id', include: 'banka,sube' }
    ]
};

// =========================================================================
// 🛡️ DYNA-STUB ENGINE: YENİ KURULUMLAR İÇİN GÜVENLİ TASLAK OLUŞTURUCULAR
// =========================================================================
const STUBS = {
    vw_CariEkstreDetay: `
        CREATE VIEW [dbo].[vw_CariEkstreDetay] AS 
        SELECT CAST(NULL AS int) AS [CariID], CAST(NULL AS varchar(50)) AS [CariKodu], CAST(NULL AS varchar(500)) AS [FirmaAdi], CAST(NULL AS int) AS [IslemNo], CAST(NULL AS datetime) AS [IslemTarihi], CAST(NULL AS nvarchar(100)) AS [BelgeNo], CAST(NULL AS nvarchar(100)) AS [IslemTipi], CAST(NULL AS float) AS [IslemTutari], CAST(NULL AS varchar(1)) AS [Yon]`,
    
    V_CariAnalizRaporu: `
        CREATE VIEW [dbo].[V_CariAnalizRaporu] AS 
        SELECT CAST(NULL AS int) AS [id], CAST(NULL AS varchar(50)) AS [kodu], CAST(NULL AS varchar(500)) AS [firma], CAST(NULL AS varchar(50)) AS [sehir], CAST(NULL AS varchar(18)) AS [CariTipi], CAST(NULL AS float) AS [NetBakiyeTL], CAST(NULL AS varchar(12)) AS [Kanali], CAST(NULL AS datetime) AS [SonIslemTarihi], CAST(NULL AS int) AS [GecikmeGunSayisi]`,
    
    vw_FaturaDetayRaporu: `
        CREATE VIEW [dbo].[vw_FaturaDetayRaporu] AS 
        SELECT CAST(NULL AS int) AS [IslemNo], CAST(NULL AS nvarchar(255)) AS [CariAdi], CAST(NULL AS nvarchar(100)) AS [IslemTipi], CAST(NULL AS datetime) AS [FaturaTarihi], CAST(NULL AS nvarchar(100)) AS [BelgeNo], CAST(NULL AS float) AS [FaturaToplamTutar], CAST(NULL AS nvarchar(max)) AS [FaturaNotu], CAST(NULL AS int) AS [SatirId], CAST(NULL AS nvarchar(255)) AS [UrunAdi], CAST(NULL AS nvarchar(100)) AS [StokKodu], CAST(NULL AS nvarchar(50)) AS [Birim], CAST(NULL AS float) AS [BirimFiyat], CAST(NULL AS int) AS [KdvOrani], CAST(NULL AS float) AS [KdvTutari], CAST(NULL AS float) AS [KdvDahilBirimFiyat], CAST(NULL AS float) AS [Miktar], CAST(NULL AS decimal(18,4)) AS [SatirTutarı]`,
    
    vw_StokListesi: `
        CREATE VIEW [dbo].[vw_StokListesi] AS 
        SELECT CAST(NULL AS varchar(300)) AS [urunkodu], CAST(NULL AS varchar(300)) AS [urun], CAST(NULL AS varchar(300)) AS [urunalt], CAST(NULL AS varchar(300)) AS [ureticifirma], CAST(NULL AS varchar(300)) AS [grubu], CAST(NULL AS varchar(300)) AS [kategori], CAST(NULL AS varchar(300)) AS [tipi], CAST(NULL AS varchar(50)) AS [Raf], CAST(NULL AS float) AS [fiyatı], CAST(NULL AS varchar(350)) AS [OEM], CAST(NULL AS float) AS [STK_FULL], CAST(NULL AS varchar(350)) AS [OEM_0], CAST(NULL AS varchar(350)) AS [OEM_1], CAST(NULL AS varchar(350)) AS [OEM_2], CAST(NULL AS varchar(350)) AS [OEM_3], CAST(NULL AS varchar(350)) AS [OEM_4], CAST(NULL AS int) AS [OEM_5], CAST(NULL AS int) AS [OEM_6], CAST(NULL AS int) AS [OEM_7], CAST(NULL AS int) AS [OEM_8], CAST(NULL AS int) AS [OEM_9], CAST(NULL AS float) AS [MevcutBakiye]`
};

// =========================================================================
// 🛠️ HELPERS
// =========================================================================
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
IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name='${ix.name}' 
    AND object_id = OBJECT_ID('dbo.${ix.table}')
)
BEGIN
    DROP INDEX [${ix.name}] ON dbo.${ix.table};
END;
GO
CREATE NONCLUSTERED INDEX [${ix.name}] ON dbo.${ix.table} (${ix.cols}) ${includeStr};
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
    🛡️ Taslak Mimari & Optimize INCLUDE İndeksleri Aktiftir.
========================================================================= */

SET NOCOUNT ON;
GO
`;

    // 1. Veritabanındaki mevcut durum şemasını çekiyoruz
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
    // AŞAMA 1: ÖN HAZIRLIK (YENİ KURULUMLAR İÇİN EKSİK BAĞIMLI NESNELERİ OLUŞTURMA)
    // =========================================================================
    script += `\n/* ===================== 🛡️ ADIM 1: DYNAMIC STUBS (ÖN HAZIRLIK) ===================== */\n`;
    for (const v of DB.views) {
        if (!viewMap[v] && STUBS[v]) {
            script += `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${v}]') AND type in (N'V'))
BEGIN
    EXEC('${STUBS[v].replace(/'/g, "''").trim()}');
END;
GO\n`;
        }
    }

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
    // AŞAMA 2: ASIL GÖVDELERİN GÜNCELLENMESİ (ALTER YAPILARI)
    // =========================================================================
    script += `\n/* ===================== 📊 ADIM 2: VIEW GÜNCELLEMELERİ (ALTER) ===================== */\n`;
    for (const v of DB.views) {
        const def = viewMap[v];
        if (def) {
            script += safeAlterView(def).trim() + '\nGO\n\n';
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
    // AŞAMA 4: ENDÜSTRİYEL SEVİYE İNDEKS OPTİMİZASYONLARI
    // =========================================================================
    script += `\n/* ===================== 🛠️ ADIM 4: HIGH-PERFORMANCE INDEXES ===================== */\n`;
    for (const ix of DB.indexes) {
        script += buildIndex(ix);
    }

    // 5. Dosyaya Yazma İşlemi
    const dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    fs.writeFileSync(path.join(dir, 'guncelleme.sql'), script, 'utf8');

    console.log('✅ TAM UYUMLU VE YÜKSEK PERFORMANSLI DB SCRIPTİ BAŞARIYLA ÜRETİLDİ');
    await sql.close();
}

run().catch(err => {
    console.error('❌ CRITICAL ERROR:', err.message);
});