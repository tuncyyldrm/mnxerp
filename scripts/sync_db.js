const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// 1. .env.local değişkenlerini yükle
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '2026',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'ONEDB',
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  requestTimeout: 120000 // 2 dakika
};

const sqlFiles = [
  'vw_StokListesi.sql',
  'vw_CariEkstreDetay.sql',
  'V_CariAnalizRaporu.sql',
  'vw_FaturaDetayRaporu.sql',
  'sp_StokDetayGetir.sql',
  'sp_StokDuzenle.sql',
  'sp_UrunHareketAnaliz.sql',
  'sp_KatalogtanSatisEkle.sql',
  'sp_HizliTahsilatEkle.sql',
  'sp_SayimSistemeIsle.sql',
  'index.sql'
];

async function syncDatabase() {
  console.log(`\n======================================================`);
  console.log(`📦 MNX ERP - Veritabanı Otomatik Kurulum ve Eşitleme`);
  console.log(`🎯 Hedef Veritabanı: [${sqlConfig.database}] (${sqlConfig.server}:${sqlConfig.port})`);
  console.log(`======================================================\n`);

  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    console.log(`✅ SQL Server bağlantısı kuruldu.\n`);
  } catch (err) {
    console.error(`❌ SQL Server bağlantı hatası! Lütfen .env.local ayarlarınızı kontrol edin.`, err.message);
    process.exit(1);
  }

  let basarili = 0;
  let hatali = 0;

  for (const file of sqlFiles) {
    const filePath = path.join(__dirname, '..', 'DB', file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ [Atlandı] Dosya bulunamadı: DB/${file}`);
      continue;
    }

    try {
      const rawContent = fs.readFileSync(filePath, 'utf8');
      const normalized = rawContent.replace(/\r\n/g, '\n');
      const batches = normalized
        .split(/(?:^|\n)\s*GO\s*(?:\n|$)/i)
        .map(b => b.trim())
        .filter(Boolean);

      for (const batch of batches) {
        // USE [DB] komutlarını atla; zaten hedef veritabanına bağlıyız
        if (/^\s*USE\s+\[?[\w]+\]?\s*;?\s*$/i.test(batch)) {
          continue;
        }
        await pool.request().query(batch);
      }

      console.log(`  ✅ Kuruldu: DB/${file}`);
      basarili++;
    } catch (err) {
      console.error(`  ❌ Hata (DB/${file}):`, err.message);
      hatali++;
    }
  }

  await pool.close();

  console.log(`\n======================================================`);
  if (hatali === 0) {
    console.log(`🎉 Kurulum Tamamlandı! Toplam ${basarili} SQL nesnesi başarıyla eşitlendi.`);
    console.log(`👉 Artık 'npm run dev' ile sistemi sorunsuz kullanabilirsiniz.`);
  } else {
    console.log(`⚠️ Kurulum Bitti: ${basarili} başarılı, ${hatali} hata oluştu.`);
  }
  console.log(`======================================================\n`);
}

syncDatabase();
