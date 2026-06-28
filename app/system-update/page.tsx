'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

interface LogItem {
  id: string;
  message: string;
}

function SystemUpdateContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [currentStepText, setCurrentStepText] = useState('Sistem güncelleme emri bekleniyor...');

  // 🧠 GÜVENLİK REF'İ: onerror tetiklendiğinde status state'inin en güncel değerine anında erişebilmek için
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const sistemiGuncelle = () => {
    if (!key) {
      setStatus('error');
      setLogs([{ id: 'err-init', message: 'Geçersiz istek: Güvenlik anahtarı (key) eksik!' }]);
      return;
    }

    setStatus('loading');
    setProgress(5); // Sürecin başladığını belirten küçük bir bar hareketi
    setLogs([{ id: `log-init-${Date.now()}`, message: 'Güncelleme süreci kullanıcı onayı ile başlatıldı...' }]);

    const eventSource = new EventSource(`/api/system-sync?key=${key}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Önce state güncellemelerini güvenle yap
        setStatus(data.status);
        setProgress(data.progress);
        
        if (data.message) {
          setCurrentStepText(data.message);
          
          // Log listesine sadece anlamlı mesajları ekle
          const uniqueId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          setLogs((prevLogs) => [{ id: uniqueId, message: data.message }, ...prevLogs]);
        }

        // Eğer başarı sinyali geldiyse akışı temizce kapat
        if (data.status === 'success') {
          eventSource.close();
          setCurrentStepText('🎉 Güncelleme Başarıyla Tamamlandı! Sistem arka planda hot-restart ediliyor.');
        }

        if (data.status === 'error') {
          eventSource.close();
        }
      } catch (err) {
        setStatus('error');
        setCurrentStepText('❌ Canlı veri akışı çözümlenirken hata oluştu.');
        setLogs((prevLogs) => [
          { id: `err-${Date.now()}`, message: 'Canlı veri akışı formatı çözümlenemedi.' },
          ...prevLogs
        ]);
        eventSource.close();
      }
    };

    // Sadece ilgili fonksiyonun içi güncellenmiştir, stil ve JSX yapılarınız tam uyumludur.
    eventSource.onerror = () => {
      // 🔮 GELİŞTİRİLMİŞ AKILLI KONTROL: State asenkron ilerlediği için hem ref'i hem de progress durumunu kontrol et
      if (statusRef.current === 'success' || progress >= 95) {
        console.log("🔄 PM2 servis reload aşamasında bağlantı kapandı. Güncelleme başarıyla tamamlandığı için bu durum normal kabul edildi.");
        eventSource.close();
        return;
      }

      setStatus('error');
      setCurrentStepText('⚠️ Sunucu bağlantısı kesildi. Servisler yenileniyor olabilir.');
      setLogs((prevLogs) => [
        { id: `err-conn-${Date.now()}`, message: 'Sunucuyla canlı bağlantı koptu. PM2 süreci yenileniyor veya timeout oluştu.' },
        ...prevLogs
      ]);
      eventSource.close();
    };
  };

  // Backend adımlarıyla tam senkronize yüzdelik sınır kontrolü
  const getStepStatus = (step: 1 | 2 | 3 | 4) => {
    if (status === 'idle') return '⌛ Bekliyor';
    
    // Eğer o aşamadayken veya öncesinde hata alındıysa aşamayı işaretle
    if (status === 'error') {
      if (step === 1 && progress <= 30) return '❌ Hata Oluştu';
      if (step === 2 && progress > 30 && progress <= 75) return '❌ Hata Oluştu';
      if (step === 3 && progress > 75 && progress <= 90) return '❌ Hata Oluştu';
      if (step === 4 && progress > 90 && progress < 100) return '❌ Hata Oluştu';
    }
    
    switch (step) {
      case 1: // Git Çekme (Aşama 1: %15 - %30)
        if (progress >= 30) return '✅ Tamamlandı';
        if (progress > 0) return '⚡ İşleniyor...';
        return '⌛ Bekliyor';
      case 2: // Build Alımı (Aşama 2: %50 - %75)
        if (progress >= 75) return '✅ Tamamlandı';
        if (progress >= 30) return '⚡ İşleniyor...';
        return '⌛ Bekliyor';
      case 3: // SQL Veritabanı (Aşama 3: %80 - %90)
        if (progress >= 90) return '✅ Tamamlandı';
        if (progress >= 75) return '⚡ İşleniyor...';
        return '⌛ Bekliyor';
      case 4: // PM2 Reload (Aşama 4: %95 - %100)
        if (status === 'success' || progress === 100) return '✅ Tamamlandı';
        if (progress >= 90) return '⚡ İşleniyor...';
        return '⌛ Bekliyor';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>MNX ERP Sistem Otomasyonu</h2>
        
        {status === 'idle' && (
          <div style={styles.idleContainer}>
            <div style={styles.infoAlert}>
              <strong>⚠️ Önemli Bilgilendirme:</strong> Güncelleme sistemi canlıda **Build** modunu tetiklerken, kendi bilgisayarınızdaki **Dev** modunu otomatik algılar ve yerel geliştirmelerinizi kilitlemeden sadece dosyaları ve SQL veritabanını günceller.
            </div>
            <p style={styles.description}>
              GitHub üzerindeki en son kararlı kaynak kodları çekmek, dosya bütünlüğünü doğrulamak ve `guncelleme.sql` şemalarını senkronize etmek için başlatın.
            </p>
            <button onClick={sistemiGuncelle} style={styles.startButton}>
              🚀 Güncellemeyi Doğrula ve Başlat
            </button>
          </div>
        )}

        {status !== 'idle' && (
          <>
            <div style={{
              ...styles.currentStepBox,
              borderColor: status === 'error' ? '#ff7675' : (status === 'success' ? '#2ecc71' : '#f39c12')
            }}>
              <span style={styles.currentStepBadge}>Şu Anki İşlem:</span>
              <div style={styles.currentStepText}>{currentStepText}</div>
            </div>

            <div style={styles.progressContainer}>
              <div style={{ 
                ...styles.progressBar, 
                width: `${progress}%`, 
                backgroundColor: status === 'error' ? '#c0392b' : (status === 'success' ? '#27ae60' : '#e67e22') 
              }}></div>
            </div>
            <div style={styles.progressText}>Genel İlerleme Oranı: %{progress}</div>

            <div style={styles.detailedStepsContainer}>
              <div style={styles.detailStepLine}>
                <span>📁 Aşama 1: Git Kod Senkronizasyonu</span>
                <span style={{...styles.stepStatusBadge, color: progress >= 30 ? '#27ae60' : '#e67e22'}}>{getStepStatus(1)}</span>
              </div>
              <div style={styles.detailStepLine}>
                <span>🛠️ Aşama 2: Next.js Proje Derleme (Build)</span>
                <span style={{...styles.stepStatusBadge, color: progress >= 75 ? '#27ae60' : (progress >= 30 ? '#e67e22' : '#7f8c8d')}}>{getStepStatus(2)}</span>
              </div>
              <div style={styles.detailStepLine}>
                <span>🗄️ Aşama 3: SQL Server Veritabanı Güncelleme</span>
                <span style={{...styles.stepStatusBadge, color: progress >= 90 ? '#27ae60' : (progress >= 75 ? '#e67e22' : '#7f8c8d')}}>{getStepStatus(3)}</span>
              </div>
              <div style={styles.detailStepLine}>
                <span>🚀 Aşama 4: PM2 Servis ve Hot-Restart Aşaması</span>
                <span style={{...styles.stepStatusBadge, color: (status === 'success' || progress === 100) ? '#27ae60' : (progress >= 90 ? '#e67e22' : '#7f8c8d')}}>{getStepStatus(4)}</span>
              </div>
            </div>

            <div style={styles.logContainer}>
              <div style={styles.logHeader}>Ayrıntılı Konsol Çıktısı:</div>
              <div style={styles.logBox}>
                {logs.map((item, index) => (
                  <div 
                    key={item.id} 
                    style={{ 
                      ...styles.logLine, 
                      color: index === 0 ? (status === 'error' ? '#ff7675' : '#ffeaa7') : '#b2bec3', 
                      fontWeight: index === 0 ? 'bold' : 'normal' 
                    }}
                  >
                    {item.message}
                  </div>
                ))}
              </div>
            </div>

            {status === 'success' && (
              <button onClick={() => window.location.href = '/'} style={styles.button}>
                🎉 Güncelleme Başarılı - Ana Panele Dön
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SystemUpdatePage() {
  return (
    <Suspense fallback={<div style={styles.container}>Otomasyon Yükleniyor...</div>}>
      <SystemUpdateContent />
    </Suspense>
  );
}

// Styles nesnesi aynen kalabilir...
const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif', padding: '20px' },
  card: { backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: '600px', width: '100%', textAlign: 'center' as const },
  title: { color: '#2c3e50', fontSize: '22px', marginBottom: '20px', fontWeight: 'bold' },
  idleContainer: { textAlign: 'left' as const, marginTop: '10px' },
  infoAlert: { backgroundColor: '#e8f4fd', color: '#1d6fa5', border: '1px solid #d4eafd', padding: '15px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5', marginBottom: '15px' },
  description: { color: '#57606f', fontSize: '14px', lineHeight: '1.6', marginBottom: '25px' },
  startButton: { backgroundColor: '#2980b9', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%', boxShadow: '0 4px 10px rgba(41, 128, 185, 0.3)', transition: 'background-color 0.2s' },
  currentStepBox: { backgroundColor: '#f8f9fa', borderLeft: '5px solid #f39c12', padding: '12px 15px', borderRadius: '6px', textAlign: 'left' as const, marginBottom: '20px' },
  currentStepBadge: { fontSize: '11px', textTransform: 'uppercase' as const, color: '#7f8c8d', fontWeight: 'bold', display: 'block', marginBottom: '4px' },
  currentStepText: { fontSize: '14px', fontWeight: 'bold', color: '#2c3e50' },
  progressContainer: { backgroundColor: '#e9ecef', borderRadius: '10px', height: '14px', width: '100%', overflow: 'hidden', marginBottom: '8px' },
  progressBar: { height: '100%', transition: 'width 0.4s ease-in-out' },
  progressText: { fontSize: '13px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '25px' },
  detailedStepsContainer: { backgroundColor: '#fdfdfd', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', textAlign: 'left' as const, marginBottom: '25px' },
  detailStepLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f1f5f9', color: '#334155' },
  stepStatusBadge: { fontWeight: 'bold', fontSize: '12px' },
  logContainer: { textAlign: 'left' as const, marginBottom: '25px' },
  logHeader: { fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '6px' },
  logBox: { backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', height: '150px', overflowY: 'auto' as const, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)' },
  logLine: { fontSize: '12px', fontFamily: 'monospace', lineHeight: '1.6', marginBottom: '6px', borderBottom: '1px solid #334155', paddingBottom: '4px' },
  button: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '14px 30px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%', boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)' }
};