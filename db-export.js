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

// 🎯 LİSTE: Buraya istediğin gibi yeni view, procedure veya index ekleyebilirsin. 
// Akıllı altyapı sayesinde sıralama veya kolon bağımlılıkları otomatik çözülür.
const BENIM_NESNELERIM = {
    views: [
        'vw_CariEkstreDetay',    // Önce bağımsız ana ekstre görünümü kurulmalı
        'V_CariAnalizRaporu',   // vw_CariEkstreDetay'ın kolonlarına bağımlı
        'vw_FaturaDetayRaporu',
        'vw_StokListesi'         // Gelecekte ekleyeceğin tüm yeni View'ları buraya eklemen yeterli!
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
        finalSqlScript += `-- 🛡️ Dükkan veritabanları için "Akıllı Dinamik Taslak (Dyna-Stub)" mimarisi aktiftir.\n\n`;

        const viewListStr = BENIM_NESNELERIM.views.map(v => `'${v}'`).join(',');
        const spListStr = BENIM_NESNELERIM.procedures.map(p => `'${p}'`).join(',');
        const indexListStr = BENIM_NESNELERIM.indexes.map(i => `'${i}'`).join(',');

        // ====================================================
        // 🔮 DİNAMİK VE AKILLI TASLAK (STUB) ANALİZ ADIMI
        // ====================================================
        console.log('🧠 Görünümlerin kolon yapıları dinamik olarak analiz ediliyor...');
        const columnsResult = await pool.request().query(`
            SELECT 
                c.name AS ColumnName,
                OBJECT_NAME(c.object_id) AS ViewName,
                t.name AS DataType,
                CASE 
                    WHEN t.name IN ('char', 'varchar', 'nchar', 'nvarchar') AND c.max_length = -1 THEN 'max'
                    WHEN t.name IN ('char', 'varchar') THEN CAST(c.max_length AS VARCHAR)
                    WHEN t.name IN ('nchar', 'nvarchar') THEN CAST(c.max_length / 2 AS VARCHAR)
                    ELSE NULL
                END AS Length
            FROM sys.columns c
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            WHERE c.object_id IN (
                SELECT object_id FROM sys.objects WHERE type = 'V' AND name IN (${viewListStr})
            )
            ORDER BY ViewName, c.column_id;
        `);

        // Kolon verilerini View gruplarına göre haritala
        const viewColumnsMap = {};
        columnsResult.recordset.forEach(col => {
            if (!viewColumnsMap[col.ViewName]) viewColumnsMap[col.ViewName] = [];
            
            let typeStr = col.DataType;
            if (col.Length) typeStr += `(${col.Length})`;
            
            viewColumnsMap[col.ViewName].push(`CAST(NULL AS ${typeStr}) AS [${col.ColumnName}]`);
        });

        // Script Ön Hazırlık Alanı
        finalSqlScript += `-- ----------------------------------------------------\n`;
        finalSqlScript += `-- 🛡️ ÖN HAZIRLIK: EKSİK NESNELERİ AKILLI TASLAKLARLA ILK DEFA OLUŞTURMA\n`;
        finalSqlScript += `-- ----------------------------------------------------\n\n`;

        // 🚀 Her View için lokaldeki şemayı birebir taklit eden taslak (Stub) oluşturma
        BENIM_NESNELERIM.views.forEach(viewName => {
            finalSqlScript += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${viewName}]') AND type in (N'V'))\n`;
            finalSqlScript += `BEGIN\n`;
            
            const cols = viewColumnsMap[viewName];
            if (cols && cols.length > 0) {
                // Görünüm lokaldeki sütunlarının tipleriyle birebir sahte select olarak doğar!
                const stubSelect = `SELECT ${cols.join(', ')}`;
                // SQL Server tırnak kaçış hatası vermesin diye tek tırnakları dubleliyoruz
                const safeStubSelect = stubSelect.replace(/'/g, "''");
                finalSqlScript += `    EXEC('CREATE VIEW [dbo].[${viewName}] AS ${safeStubSelect}');\n`;
            } else {
                finalSqlScript += `    EXEC('CREATE VIEW [dbo].[${viewName}] AS SELECT 1 as TaslakKolon');\n`;
            }
            
            finalSqlScript += `END;\nGO\n\n`;
        });

        // Olmayan SP'ler için standart boş taslak oluştur
        BENIM_NESNELERIM.procedures.forEach(spName => {
            finalSqlScript += `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${spName}]') AND type in (N'P', N'PC'))\n`;
            finalSqlScript += `BEGIN\n    EXEC('CREATE PROCEDURE [dbo].[${spName}] AS BEGIN SET NOCOUNT ON; END');\nEND;\nGO\n`;
        });
        finalSqlScript += `\n`;

        // ---- 1. ADIM: VIEW'LARI ÇEK (SIRALAMA KORUMALI) ----
        if (BENIM_NESNELERIM.views.length > 0) {
            console.log('🔍 View gövdeleri çekiliyor...');
            const viewResult = await pool.request().query(`
                SELECT o.name, sm.definition FROM sys.sql_modules sm
                JOIN sys.objects o ON sm.object_id = o.object_id
                WHERE o.type = 'V' AND o.name IN (${viewListStr})
            `);
            
            finalSqlScript += `-- ----------------------------------------------------\n`;
            finalSqlScript += `-- 📊 AŞAMA 1: VIEW GÜNCELLEMELERİ (ASIL GÖVDELER)\n`;
            finalSqlScript += `-- ----------------------------------------------------\n\n`;
            
            const viewMap = {};
            viewResult.recordset.forEach(row => {
                viewMap[row.name] = row.definition;
            });

            // SQL Server'dan gelen karmaşık sıralamayı yoksayıp BENIM_NESNELERIM dizisindeki sırayı koruyoruz
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
                    -- Key Kolonları (Doğru Index ID eşleşmesiyle)
                    STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
                           FROM sys.index_columns ic 
                           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                           ORDER BY ic.key_ordinal
                           FOR XML PATH('')), 1, 1, '') AS KeyColumns,
                    -- Include Kolonları (Düzeltilen Yer: ic.index_id = i.index_id)
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
        
        console.log(`✅ Harika! Kurşun geçirmez güncelleme scripti 'DB/guncelleme.sql' dosyasına paketlendi.`);
        await sql.close();
    } catch (err) {
        console.error('❌ Hata oluştu:', err);
        try { await sql.close(); } catch(e) {}
    }
}

exportSchema();