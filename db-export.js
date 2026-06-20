// db-export.js
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
    user: 'sa',
    password: '2026',
    server: '127.0.0.1',
    database: 'ONEDB',
    options: { encrypt: false, trustServerCertificate: true }
};

// 🎯 NOKTA ATIŞI LİSTE: Bağımlılık sırasına göre tam hizalanmış liste
const BENIM_NESNELERIM = {
    views: [
        'vw_CariEkstreDetay',    // 🔥 KRİTİK: Önce bağımsız ana ekstre görünümü kurulmalı!
        'V_CariAnalizRaporu',   // Çünkü bu yapı vw_CariEkstreDetay'ın IslemTarihi kolonuna bağımlı.
        'vw_FaturaDetayRaporu',
        'vw_StokListesi'
    ],
    procedures: [
        'sp_StokDetayGetir',
        'sp_StokDuzenle',
        'sp_UrunHareketAnaliz'
    ],
    indexes: [
        'IX_Islem_DetayKodu_Bakiye_Optimize',
        'IX_IslemKaydi_Covering_Amor',
        'IX_Stok_Filtreleme_Master',
        'IX_Stok_B2B_Search_Optimize',
        'IX_Stok_Urun_Arama',
        'IX_Stok_OEM_Search',
        'IX_Islem_IslemNumarasi_Covering',
    ]
};

async function exportSchema() {
    try {
        console.log('🔌 Kendi SQL Server\'ıma bağlanılıyor...');
        const pool = await sql.connect(config);
        
        let finalSqlScript = `-- ✨ Otomatik Üretilen Güvenli Güncelleme Scripti (${new Date().toLocaleString('tr-TR')})\n`;
        finalSqlScript += `-- ⚠️ Manuel düzenleme yapmayın, 'npm run db-pack' ile güncelleyin.\n`;
        finalSqlScript += `-- 🛡️ Dükkan veritabanlarında eksik olan yapılar için "Varlık Kontrolü (Stub)" eklenmiştir.\n\n`;

        const viewListStr = BENIM_NESNELERIM.views.map(v => `'${v}'`).join(',');
        const spListStr = BENIM_NESNELERIM.procedures.map(p => `'${p}'`).join(',');
        const indexListStr = BENIM_NESNELERIM.indexes.map(i => `'${i}'`).join(',');

        // ====================================================
        // ÖN ADIM: DÜKKANDA HİÇ OLMAYAN YAPILAR İÇİN SAHTE (STUB) OLUŞTURMA
        // ====================================================
        finalSqlScript += `-- ----------------------------------------------------\n`;
        finalSqlScript += `-- 🛡️ ÖN HAZIRLIK: EKSİK NESNELERİ GÜVENLİCE ILK DEFA OLUŞTURMA\n`;
        finalSqlScript += `-- ----------------------------------------------------\n\n`;

        // Olmayan View'lar için boş taslak oluştur
        BENIM_NESNELERIM.views.forEach(viewName => {
            finalSqlScript += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${viewName}]') AND type in (N'V'))\n`;
            finalSqlScript += `BEGIN\n    EXEC('CREATE VIEW [dbo].[${viewName}] AS SELECT 1 as TaslakKolon');\nEND;\nGO\n`;
        });

        // Olmayan SP'ler için boş taslak oluştur
        BENIM_NESNELERIM.procedures.forEach(spName => {
            finalSqlScript += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${spName}]') AND type in (N'P', N'PC'))\n`;
            finalSqlScript += `BEGIN\n    EXEC('CREATE PROCEDURE [dbo].[${spName}] AS BEGIN SET NOCOUNT ON; END');\nEND;\nGO\n`;
        });
        finalSqlScript += `\n`;

        // ---- 1. ADIM: VIEW'LARI ÇEK (SIRALAMA KORUMALI) ----
        if (BENIM_NESNELERIM.views.length > 0) {
            console.log('🔍 View yapıları çekiliyor...');
            const viewResult = await pool.request().query(`
                SELECT o.name, sm.definition FROM sys.sql_modules sm
                JOIN sys.objects o ON sm.object_id = o.object_id
                WHERE o.type = 'V' AND o.name IN (${viewListStr})
            `);
            
            finalSqlScript += `-- ----------------------------------------------------\n`;
            finalSqlScript += `-- 📊 AŞAMA 1: VIEW GÜNCELLEMELERİ (ASIL GÖVDELER)\n`;
            finalSqlScript += `-- ----------------------------------------------------\n\n`;
            
            // 🧠 ZEKİ DOKUNUŞ: SQL Server'dan gelen kayıtları, BENIM_NESNELERIM dizisindeki sıraya göre hizala!
            const viewMap = {};
            viewResult.recordset.forEach(row => {
                viewMap[row.name] = row.definition;
            });

            BENIM_NESNELERIM.views.forEach(viewName => {
                const rawDef = viewMap[viewName];
                if (rawDef) {
                    let definition = rawDef.replace(/CREATE\s+VIEW/i, 'ALTER VIEW');
                    finalSqlScript += `${definition.trim()}\nGO\n\n`;
                }
            });
        }

        // ---- 2. ADIM: STORED PROCEDURE'LERİ ÇEK ----
        if (BENIM_NESNELERIM.procedures.length > 0) {
            console.log('🔍 Stored Procedure yapıları çekiliyor...');
            const spResult = await pool.request().query(`
                SELECT o.name, sm.definition FROM sys.sql_modules sm
                JOIN sys.objects o ON sm.object_id = o.object_id
                WHERE o.type = 'P' AND o.name IN (${spListStr})
            `);
            finalSqlScript += `-- ----------------------------------------------------\n`;
            finalSqlScript += `-- ⚡ AŞAMA 2: STORED PROCEDURE GÜNCELLEMELERİ (ASIL GÖVDELER)\n`;
            finalSqlScript += `-- ----------------------------------------------------\n\n`;

            const spMap = {};
            spResult.recordset.forEach(row => {
                spMap[row.name] = row.definition;
            });

            BENIM_NESNELERIM.procedures.forEach(spName => {
                const rawDef = spMap[spName];
                if (rawDef) {
                    let definition = rawDef.replace(/CREATE\s+PROCEDURE/i, 'ALTER PROCEDURE');
                    definition = definition.replace(/CREATE\s+PROC/i, 'ALTER PROCEDURE');
                    finalSqlScript += `${definition.trim()}\nGO\n\n`;
                }
            });
        }

        // ---- 3. ADIM: DİNAMİK INDEX SCRIPTINI OLUŞTUR ----
        if (BENIM_NESNELERIM.indexes.length > 0) {
            console.log('🔍 Index yapıları analiz ediliyor...');
            
            const indexResult = await pool.request().query(`
                SELECT 
                    i.name AS IndexName,
                    OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
                    OBJECT_NAME(i.object_id) AS TableName,
                    STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
                           FROM sys.index_columns ic 
                           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                           ORDER BY ic.key_ordinal
                           FOR XML PATH('')), 1, 1, '') AS KeyColumns,
                    STUFF((SELECT ',' + c.name
                           FROM sys.index_columns ic 
                           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
                           ORDER BY ic.index_column_id
                           FOR XML PATH('')), 1, 1, '') AS IncludeColumns
                FROM sys.indexes i
                WHERE i.name IN (${indexListStr})
            `);

            finalSqlScript += `-- ----------------------------------------------------\n`;
            finalSqlScript += `-- 🛠️ AŞAMA 3: INDEX OPTİMİZASYONLARI\n`;
            finalSqlScript += `-- ----------------------------------------------------\n\n`;

            indexResult.recordset.forEach(row => {
                const fullTableName = `[${row.SchemaName}].[${row.TableName}]`;
                
                finalSqlScript += `-- ⚡ Index: ${row.IndexName} (Tablo: ${fullTableName})\n`;
                finalSqlScript += `IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('${fullTableName}') AND type in (N'U'))\n`;
                finalSqlScript += `BEGIN\n`;
                finalSqlScript += `    IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${row.IndexName}' AND object_id = OBJECT_ID('${fullTableName}'))\n`;
                finalSqlScript += `    BEGIN\n         DROP INDEX [${row.IndexName}] ON ${fullTableName};\n    END;\n`;
                
                if (row.IncludeColumns) {
                    finalSqlScript += `    CREATE NONCLUSTERED INDEX [${row.IndexName}] ON ${fullTableName} (${row.KeyColumns}) INCLUDE (${row.IncludeColumns});\n`;
                } else {
                    finalSqlScript += `    CREATE NONCLUSTERED INDEX [${row.IndexName}] ON ${fullTableName} (${row.KeyColumns});\n`;
                }
                finalSqlScript += `END;\nGO\n\n`;
            });
        }

        // ---- 4. ADIM: DOSYAYA YAZMA ----
        const dbDir = path.join(process.cwd(), 'DB');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        const outputPath = path.join(dbDir, 'guncelleme.sql');
        fs.writeFileSync(outputPath, finalSqlScript, 'utf8');
        
        console.log(`✅ İşlem Başarılı! Dükkan uyumlu korumalı yapılar 'DB/guncelleme.sql' dosyasına paketlendi.`);
        await sql.close();
    } catch (err) {
        console.error('❌ Hata oluştu:', err);
        try { await sql.close(); } catch(e) {}
    }
}

exportSchema();