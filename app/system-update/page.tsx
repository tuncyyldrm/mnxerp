'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SystemUpdateContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!key) {
      setStatus('error');
      setLogs(['Geçersiz istek: Güvenlik anahtarı (key) eksik!']);
      return;
    }

    // Server-Sent Events (SSE) bağlantısını başlatıyoruz
    const eventSource = new EventSource(`/api/system-sync?key=${key}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data.status);
        setProgress(data.progress);
        
        // Gelen canlı mesajı log listesinin en üstüne ekle
        setLogs((prevLogs) => [data.message, ...prevLogs]);

        if (data.status === 'success' || data.status === 'error') {
          eventSource.close(); // İşlem bittiyse bağlantıyı kapat
        }
      } catch (err) {
        setStatus('error');
        setLogs(['Canlı veri akışı çözümlenemedi.']);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      setLogs(['Sunucuyla canlı bağlantı koptu veya zaman aşımı oluştu. Terminalden komut kilitlenmiş olabilir.']);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [key]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>MNX ERP Sistem Otomasyonu</h2>
        
        {/* İlerleme Çubuğu */}
        <div style={styles.progressContainer}>
          <div style={{ ...styles.progressBar, width: `${progress}%`, backgroundColor: status === 'error' ? '#c0392b' : (status === 'success' ? '#27ae60' : '#e67e22') }}></div>
        </div>
        <div style={styles.progressText}>İlerleme: %{progress}</div>

        {/* Canlı Durum İkonları */}
        <div style={styles.statusSection}>
          {status === 'loading' && <div style={styles.spinner}></div>}
          {status === 'success' && <div style={styles.iconSuccess}>✓ Sonuç: Başarılı</div>}
          {status === 'error' && <div style={styles.iconError}>✕ Sonuç: Başarısız</div>}
        </div>

        {/* Canlı Log Ekranı */}
        <div style={styles.logContainer}>
          <div style={styles.logHeader}>Canlı İşlem Raporu:</div>
          <div style={styles.logBox}>
            {logs.map((log, index) => (
              <div key={index} style={{ ...styles.logLine, color: index === 0 ? (status === 'error' ? '#ff7675' : '#ffeaa7') : '#b2bec3', fontWeight: index === 0 ? 'bold' : 'normal' }}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {status === 'success' && (
          <button onClick={() => window.location.href = '/'} style={styles.button}>
            Ana Panele Git
          </button>
        )}
      </div>
    </div>
  );
}

export default function SystemUpdatePage() {
  return (
    <Suspense fallback={<div style={styles.container}>Yükleniyor...</div>}>
      <SystemUpdateContent />
    </Suspense>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f4f6f9',
    fontFamily: 'sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    maxWidth: '550px',
    width: '100%',
    textAlign: 'center' as const,
  },
  title: { color: '#2c3e50', fontSize: '20px', marginBottom: '20px' },
  progressContainer: {
    backgroundColor: '#e9ecef',
    borderRadius: '10px',
    height: '12px',
    width: '100%',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.4s ease-in-out',
  },
  progressText: { fontSize: '13px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '20px' },
  statusSection: { height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' },
  spinner: {
    width: '35px',
    height: '35px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #e67e22',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  iconSuccess: { color: '#27ae60', fontWeight: 'bold', fontSize: '18px' },
  iconError: { color: '#c0392b', fontWeight: 'bold', fontSize: '18px' },
  logContainer: { textAlign: 'left' as const, marginBottom: '20px' },
  logHeader: { fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '6px' },
  logBox: {
    backgroundColor: '#2d3436',
    padding: '12px',
    borderRadius: '8px',
    height: '180px',
    overflowY: 'auto' as const,
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
  },
  logLine: { fontSize: '12px', lineHeight: '1.5', marginBottom: '6px', borderBottom: '1px solid #3d4648', paddingBottom: '4px' },
  button: {
    backgroundColor: '#27ae60',
    color: '#fff',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    width: '100%',
  },
};