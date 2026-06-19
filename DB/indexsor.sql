-- 📊 ONEDB Tüm İndeks Durumları, Performansları ve Eksik Yapılar Analiz Sorgusu
SELECT 
    OBJECT_NAME(i.object_id) AS [Tablo Adi],
    i.name AS [İndeks Adi],
    i.type_desc AS [İndeks Tipi],
    -- Kullanım İstatistikleri
    ISNULL(s.user_seeks, 0) AS [Nokta Atisi Arama (Seek)],
    ISNULL(s.user_scans, 0) AS [Boydan Boya Tarama (Scan)],
    ISNULL(s.user_lookups, 0) AS [Ana Tabloya Gitme (Lookup)],
    -- Güncellenme İstatistikleri (Insert/Update/Delete maliyeti)
    ISNULL(s.user_updates, 0) AS [Yazma/Guncelleme Yukü],
    -- Son Kullanım Tarihleri
    s.last_user_seek AS [Son Nokta Atisi Tarihi],
    s.last_user_scan AS [Son Tarama Tarihi],
    -- İndeksin Durumu ve Sağlık Yorumu
    CASE 
        WHEN i.is_primary_key = 1 THEN 'Ana Anahtar (Primary Key)'
        WHEN i.is_unique = 1 THEN 'Benzersiz İndeks (Unique)'
        WHEN s.user_seeks = 0 AND s.user_scans = 0 AND s.user_lookups = 0 AND s.user_updates > 0 THEN '⚠️ ATIL İNDEKS (Sadece yazma yükü var, hiç kullanılmıyor!)'
        WHEN s.user_scans > s.user_seeks THEN '🚨 YUKSEK TARAMA (Scan yüksek, indeks sorguya tam uymuyor olabilir)'
        ELSE '✅ Sağlıklı / Çalışıyor'
    END AS [Performans Durumu]
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s ON s.object_id = i.object_id 
    AND i.index_id = s.index_id 
    AND s.database_id = DB_ID()
WHERE i.object_id > 100 -- Sistem tablolarını gizle, sadece kullanıcı tablolarını getir
ORDER BY [Nokta Atisi Arama (Seek)] DESC, [Boydan Boya Tarama (Scan)] ASC;