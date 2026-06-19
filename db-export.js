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

// 🎯 NOKTA ATIŞI LİSTE: Sadece senin yazdığın ve projeye ait yapılar
const BENIM_NESNELERIM = {
    views: [
        'V_CariAnalizRaporu',
        'vw_CariEkstreDetay',
        'vw_FaturaDetayRaporu',
        'vw_StokListesi'
    ],
    procedures: [
        'sp_StokDetayGetir',
        'sp_StokDuzenle',
        'sp_UrunHareketAnaliz'
    ],
    // ⚡ Senin eklediğin ve canlıyı koruyacak olan indekslerin tam listesi:
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
        
        let finalSqlScript = `-- ✨ Otomatik Üretilen Güncelleme Scripti (${new Date().toLocaleString('tr-TR')})\n`;
        finalSqlScript += `-- ⚠️ Manuel düzenleme yapmayın, 'npm run db-pack' ile güncelleyin.\n\n`;

        const viewListStr = BENIM_NESNELERIM.views.map(v => `'${v}'`).join(',');
        const spListStr = BENIM_NESNELERIM.procedures.map(p => `'${p}'`).join(',');
        const indexListStr = BENIM_NESNELERIM.indexes.map(i => `'${i}'`).join(',');

        // ---- 1. ADIM: VIEW'LARI ÇEK ----
        if (BENIM_NESNELERIM.views.length > 0) {
            console.log('🔍 View yapıları çekiliyor...');
            const viewResult = await pool.request().query(`
                SELECT sm.definition FROM sys.sql_modules sm
                JOIN sys.objects o ON sm.object_id = o.object_id
                WHERE o.type = 'V' AND o.name IN (${viewListStr})
            `);
            viewResult.recordset.forEach(row => {
                let definition = row.definition.replace(/CREATE\s+VIEW/i, 'CREATE OR ALTER VIEW');
                finalSqlScript += `${definition.trim()}\nGO\n\n`;
            });
        }

        // ---- 2. ADIM: STORED PROCEDURE'LERİ ÇEK ----
        if (BENIM_NESNELERIM.procedures.length > 0) {
            console.log('🔍 Stored Procedure yapıları çekiliyor...');
            const spResult = await pool.request().query(`
                SELECT sm.definition FROM sys.sql_modules sm
                JOIN sys.objects o ON sm.object_id = o.object_id
                WHERE o.type = 'P' AND o.name IN (${spListStr})
            `);
            spResult.recordset.forEach(row => {
                let definition = row.definition.replace(/CREATE\s+PROCEDURE/i, 'CREATE OR ALTER PROCEDURE');
                definition = definition.replace(/CREATE\s+PROC/i, 'CREATE OR ALTER PROCEDURE');
                finalSqlScript += `${definition.trim()}\nGO\n\n`;
            });
        }

        // ---- 3. ADIM: DİNAMİK INDEX SCRIPTINI OLUŞTUR (Geliştirilmiş / INCLUDE Destekli) ----
        if (BENIM_NESNELERIM.indexes.length > 0) {
            console.log('🔍 Index yapıları analiz ediliyor (Covering & Şema korumalı)...');
            
            const indexResult = await pool.request().query(`
                SELECT 
                    i.name AS IndexName,
                    OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
                    OBJECT_NAME(i.object_id) AS TableName,
                    -- Ana İndex Kolonları (Key Columns)
                    STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
                           FROM sys.index_columns ic 
                           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                           ORDER BY ic.key_ordinal
                           FOR XML PATH('')), 1, 1, '') AS KeyColumns,
                    -- Varsa Taşınan/Dahil Edilen Kolonlar (Included Columns)
                    STUFF((SELECT ',' + c.name
                           FROM sys.index_columns ic 
                           JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
                           ORDER BY ic.index_column_id
                           FOR XML PATH('')), 1, 1, '') AS IncludeColumns
                FROM sys.indexes i
                WHERE i.name IN (${indexListStr})
            `);

            indexResult.recordset.forEach(row => {
                const fullTableName = `[${row.SchemaName}].[${row.TableName}]`;
                
                finalSqlScript += `-- ⚡ Index: ${row.IndexName} (Tablo: ${fullTableName})\n`;
                
                // Varsa önce sil
                finalSqlScript += `IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${row.IndexName}' AND object_id = OBJECT_ID('${fullTableName}'))\n`;
                finalSqlScript += `BEGIN\n    DROP INDEX [${row.IndexName}] ON ${fullTableName};\nEND;\nGO\n`;
                
                // İndeksi kur (INCLUDE kontrolü ile birlikte)
                if (row.IncludeColumns) {
                    finalSqlScript += `CREATE NONCLUSTERED INDEX [${row.IndexName}] ON ${fullTableName} (${row.KeyColumns}) INCLUDE (${row.IncludeColumns});\nGO\n\n`;
                } else {
                    finalSqlScript += `CREATE NONCLUSTERED INDEX [${row.IndexName}] ON ${fullTableName} (${row.KeyColumns});\nGO\n\n`;
                }
            });
        }

        // ---- 4. ADIM: DOSYAYA YAZMA ----
        const outputPath = path.join(__dirname, 'DB', 'guncelleme.sql');
        fs.writeFileSync(outputPath, finalSqlScript, 'utf8');
        
        console.log(`✅ İşlem Başarılı! Seçilen tüm View, SP ve Index yapıları 'DB/guncelleme.sql' dosyasına paketlendi.`);
        await sql.close();
    } catch (err) {
        console.error('❌ Hata oluştu:', err);
        try { await sql.close(); } catch(e) {}
    }
}

exportSchema();