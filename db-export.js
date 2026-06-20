// db-export.js
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

// 🔐 güvenli identifier
const q = (name) => `[${String(name).replace(/]/g, ']]')}]`;

const BENIM_NESNELERIM = {
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
        'IX_Islem_DetayKodu_Bakiye_Optimize',
        'IX_IslemKaydi_Covering_Amor',
        'IX_Stok_Filtreleme_Master',
        'IX_Stok_B2B_Search_Optimize',
        'IX_Stok_Urun_Arama',
        'IX_Stok_OEM_Search',
        'IX_Islem_IslemNumarasi_Covering'
    ]
};

async function exportSchema() {
    let pool;

    try {
        console.log('🔌 SQL Server bağlanıyor...');
        pool = await sql.connect(config);

        let script = `
-- =====================================================
-- DB EXPORT (${new Date().toLocaleString('tr-TR')})
-- =====================================================

`;

        const viewListStr = BENIM_NESNELERIM.views.map(v => `'${v}'`).join(',');
        const spListStr = BENIM_NESNELERIM.procedures.map(p => `'${p}'`).join(',');
        const indexListStr = BENIM_NESNELERIM.indexes.map(i => `'${i}'`).join(',');

        // =====================================================
        // 🧠 VIEW METADATA (DOĞRU YÖNTEM)
        // =====================================================
        console.log('🧠 View analiz...');

        const viewMeta = await pool.request().query(`
            SELECT 
                o.name AS ViewName,
                c.name AS ColumnName,
                t.name AS DataType
            FROM sys.columns c
            JOIN sys.objects o ON c.object_id = o.object_id
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            WHERE o.type = 'V'
              AND o.name IN (${viewListStr})
        `);

        const viewMap = {};
        viewMeta.recordset.forEach(r => {
            if (!viewMap[r.ViewName]) viewMap[r.ViewName] = [];
            viewMap[r.ViewName].push(
                `CAST(NULL AS ${r.DataType}) AS ${q(r.ColumnName)}`
            );
        });

        // =====================================================
        // 🛡️ STUB VIEW
        // =====================================================
        script += `-- STUB VIEWS\n`;

        for (const v of BENIM_NESNELERIM.views) {
            script += `
IF OBJECT_ID(N'dbo.${v}', 'V') IS NULL
BEGIN
    EXEC('CREATE VIEW dbo.${v} AS SELECT 1 AS Dummy');
END;
GO
`;
        }

        // =====================================================
        // 📊 VIEW DEFINITIONS (DMV SAFE)
        // =====================================================
        console.log('🔍 View definition çekiliyor...');

        const viewRes = await pool.request().query(`
            SELECT o.name, sm.definition
            FROM sys.sql_modules sm
            JOIN sys.objects o ON sm.object_id = o.object_id
            WHERE o.type = 'V'
              AND o.name IN (${viewListStr})
        `);

        const viewDefMap = {};
        viewRes.recordset.forEach(r => viewDefMap[r.name] = r.definition);

        script += `-- VIEW DEFINITIONS\n`;

        for (const v of BENIM_NESNELERIM.views) {
            const def = viewDefMap[v];
            if (!def) {
                console.warn(`⚠️ Missing VIEW: ${v}`);
                continue;
            }

            script += `
${def.replace(/CREATE\s+VIEW/i, 'ALTER VIEW')}
GO
`;
        }

        // =====================================================
        // ⚡ STORED PROCEDURES
        // =====================================================
        console.log('🔍 SP çekiliyor...');

        const spRes = await pool.request().query(`
            SELECT o.name, sm.definition
            FROM sys.sql_modules sm
            JOIN sys.objects o ON sm.object_id = o.object_id
            WHERE o.type = 'P'
              AND o.name IN (${spListStr})
        `);

        const spMap = {};
        spRes.recordset.forEach(r => spMap[r.name] = r.definition);

        script += `-- STORED PROCEDURES\n`;

        for (const sp of BENIM_NESNELERIM.procedures) {
            const def = spMap[sp];
            if (!def) {
                console.warn(`⚠️ Missing SP: ${sp}`);
                continue;
            }

            script += `
${def
    .replace(/CREATE\s+PROCEDURE/i, 'ALTER PROCEDURE')
    .replace(/CREATE\s+PROC/i, 'ALTER PROCEDURE')}
GO
`;
        }

        // =====================================================
        // 🛠️ INDEXES (FIXED + SAFE)
        // =====================================================
        console.log('🔍 Index analizi...');

        const idxRes = await pool.request().query(`
            SELECT 
                i.name AS IndexName,
                s.name AS SchemaName,
                t.name AS TableName,
                ic.is_included_column,
                c.name AS ColumnName,
                ic.is_descending_key,
                ic.key_ordinal
            FROM sys.indexes i
            JOIN sys.tables t ON i.object_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.name IN (${indexListStr})
        `);

        const indexMap = {};

        idxRes.recordset.forEach(r => {
            const key = `${r.IndexName}||${r.SchemaName}||${r.TableName}`;

            if (!indexMap[key]) {
                indexMap[key] = {
                    schema: r.SchemaName,
                    table: r.TableName,
                    keys: [],
                    includes: []
                };
            }

            if (r.is_included_column) {
                indexMap[key].includes.push(r.ColumnName);
            } else {
                indexMap[key].keys.push(
                    r.ColumnName + (r.is_descending_key ? ' DESC' : ' ASC')
                );
            }
        });

        script += `-- INDEXES\n`;

        for (const k of Object.keys(indexMap)) {
            const i = indexMap[k];
            const table = `${q(i.schema)}.${q(i.table)}`;
            const idxName = k.split('||')[0];

            script += `
-- ${idxName}
IF OBJECT_ID('${i.schema}.${i.table}', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = '${idxName}' 
        AND object_id = OBJECT_ID('${i.schema}.${i.table}')
    )
    BEGIN
        DROP INDEX ${q(idxName)} ON ${table};
    END;

    CREATE NONCLUSTERED INDEX ${q(idxName)}
    ON ${table} (${i.keys.join(', ') || '1=1'})
    ${i.includes.length ? `INCLUDE (${i.includes.join(', ')})` : ''};
END;
GO
`;
        }

        // =====================================================
        // 💾 OUTPUT FILE
        // =====================================================
        const dir = path.join(process.cwd(), 'DB');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const file = path.join(dir, `guncelleme_${Date.now()}.sql`);
        fs.writeFileSync(file, script, 'utf8');

        console.log('✅ Export tamamlandı:', file);

    } catch (err) {
        console.error('❌ HATA:', err);
    } finally {
        if (pool) await sql.close();
    }
}

exportSchema();