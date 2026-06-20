'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SystemUpdateContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [currentStep, setCurrentStep] = useState('Sistem güncellemesi başlatılıyor...');
  const [details, setDetails] = useState<{ git?: string; sql?: string }>({});
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!key) {
      setStatus('error');
      setErrorMessage('Geçersiz istek: Güvenlik anahtarı (key) eksik!');
      return;
    }

    // Tek API'ye istek atıyoruz
    fetch(`/api/system-sync?key=${key}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setCurrentStep('Sistem Tamamen Güncel!');
          setDetails({
            git: data.gitStatus,
            sql: data.sqlStatus
          });
        } else {
          setStatus('error');
          setErrorMessage(data.details ? `${data.error} Detay: ${data.details}` : (data.error || 'Güncelleme başarısız.'));
          setDetails({ git: data.gitStatus });
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Sunucu zaman aşımına uğradı veya bağlantı koptu.');
      });
  }, [key]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner}></div>
            <h2 style={styles.textLoading}>MNX ERP Güncelleniyor</h2>
            <p style={styles.subText}>{currentStep}</p>
            <p style={styles.infoText}>Lütfen işlem bitene kadar tarayıcıyı veya AnyDesk'i kapatmayın.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.iconSuccess}>✓</div>
            <h2 style={styles.textSuccess}>Sistem Güncellendi</h2>
            
            <div style={styles.reportBox}>
              <p><strong>💾 Kod Durumu:</strong> {details.git}</p>
              <p><strong>🗄️ Veritabanı:</strong> {details.sql}</p>
            </div>

            <button onClick={() => window.location.href = '/'} style={styles.button}>
              Paneli Başlat
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.iconError}>✕</div>
            <h2 style={styles.textError}>Güncelleme Yarıda Kaldı</h2>
            <p style={styles.errorText}>{errorMessage}</p>
            {details.git && (
              <div style={styles.reportBox}>
                <p><strong>💾 En Son Git Durumu:</strong> {details.git}</p>
              </div>
            )}
          </>
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
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    textAlign: 'center' as const,
    maxWidth: '500px',
    width: '100%',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #f3f3f3',
    borderTop: '5px solid #e67e22', // Dikkat çekici turuncu spinner
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  textLoading: { color: '#2c3e50', marginBottom: '10px' },
  textSuccess: { color: '#27ae60', marginBottom: '10px' },
  textError: { color: '#c0392b', marginBottom: '10px' },
  subText: { color: '#e67e22', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' },
  infoText: { color: '#7f8c8d', fontSize: '13px', marginBottom: '20px' },
  errorText: { color: '#c0392b', fontSize: '14px', marginBottom: '20px', fontWeight: '500', wordBreak: 'break-word' as const },
  reportBox: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'left' as const,
    fontSize: '13px',
    color: '#495057',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  iconSuccess: { fontSize: '50px', color: '#27ae60', marginBottom: '10px' },
  iconError: { fontSize: '50px', color: '#c0392b', marginBottom: '10px' },
  button: {
    backgroundColor: '#2ecc71',
    color: '#fff',
    border: 'none',
    padding: '12px 25px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
};