import * as sql from 'mssql';

// sql.config yerine doğrudan nesne olarak tanımlayıp geçişte tip kontrolünü esnetiyoruz
const sqlConfig: any = {
    user: 'sa',
    password: '2026',
    server: '127.0.0.1',
    database: 'ONEDB',
    port: 1433,
    
    // Sürücünün tam olarak tanıdığı isimler ve konumlar
    connectionTimeout: 15000, // Yoğunlukta hızlı vazgeçmesi için 15sn (Hata veren yer düzeltildi)
    requestTimeout: 300000,    // Ağır B2B indeks yapılandırmaları için 5 dakika sigortası
    
    options: {
        encrypt: false, 
        trustServerCertificate: true
    },
    pool: {
        max: 50, 
        min: 2, 
        idleTimeoutMillis: 30000 
    }
};

// Next.js Hot-Reload ve Global Scope için tip tanımı
declare global {
    // eslint-disable-next-line no-var
    var _msSqlPoolPromise: Promise<sql.ConnectionPool> | undefined;
}

export function getDbConnection(): Promise<sql.ConnectionPool> {
    // 1. Eğer havuz zaten oluşturuluyorsa veya oluşturulduysa direkt o Promise'i dön
    if (globalThis._msSqlPoolPromise) {
        return globalThis._msSqlPoolPromise;
    }

    // 2. İlk defa veya bağlantı koptuktan sonra ilk kez çağrılıyorsa Promise'i başlat
    globalThis._msSqlPoolPromise = new Promise<sql.ConnectionPool>(async (resolve, reject) => {
        try {
            const pool = new sql.ConnectionPool(sqlConfig);
            
            // Havuz içindeki bağlantı hatalarını dinle (Kendi kendini tamir mekanizması)
            pool.on('error', (err) => {
                console.error('SQL Pool İç Hatası (Bağlantı koptu veya kapandı):', err);
                // Havuz hata aldığında referansı sıfırlıyoruz ki bir sonraki istekte sıfırdan bağlansın
                globalThis._msSqlPoolPromise = undefined;
                
                // Güvenlik önlemi: Hataya düşen havuzu kapatmayı dene ki arka planda açık soket kalmasın
                try { pool.close(); } catch { /* Zaten kapalıysa es geç */ }
            });

            await pool.connect();
            console.log('🚀 SQL Server Bağlantı Havuzu Başarıyla Kuruldu.');
            resolve(pool);
        } catch (err) {
            console.error('❌ Veritabanına bağlanırken kritik hata:', err);
            globalThis._msSqlPoolPromise = undefined; // Hata durumunda sıfırla ki kilitli kalmasın
            reject(err);
        }
    });

    return globalThis._msSqlPoolPromise;
}