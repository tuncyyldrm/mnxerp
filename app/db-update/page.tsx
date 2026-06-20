'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function DbUpdateContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Veritabanı güncelleniyor, lütfen sayfayı kapatmayın...');

  useEffect(() => {
    if (!key) {
      setStatus('error');
      setMessage('Geçersiz istek: Güvenlik anahtarı (key) eksik!');
      return;
    }

    // Gerçek API'ye istek atıyoruz
    fetch(`/api/db-update?key=${key}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Veritabanı başarıyla güncellendi!');
        } else {
          setStatus('error');
          // API'den gelen error ve details bilgisini birleştirerek ekrana basıyoruz
          const hataMesaji = data.details 
            ? `${data.error} Detay: ${data.details}` 
            : (data.error || 'Güncelleme sırasında bir hata oluştu.');
          setStatus('error');
          setMessage(hataMesaji);
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Sunucuya bağlanırken veya sorgu yürütülürken zaman aşımı/bağlantı hatası oluştu.');
      });
  }, [key]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner}></div>
            <h2 style={styles.textLoading}>MNX ERP Güncelleniyor</h2>
            <p style={styles.subText}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.iconSuccess}>✓</div>
            <h2 style={styles.textSuccess}>İşlem Başarılı!</h2>
            <p style={styles.subText}>{message}</p>
            <button onClick={() => window.location.href = '/'} style={styles.button}>
              Panele Git
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.iconError}>✕</div>
            <h2 style={styles.textError}>Güncelleme Başarısız</h2>
            <p style={styles.subText} className="error-message">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DbUpdatePage() {
  return (
    <Suspense fallback={<div style={styles.container}>Yükleniyor...</div>}>
      <DbUpdateContent />
    </Suspense>
  );
}

// Basit ve Şık CSS Styles
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
    maxWidth: '450px', // Hata detayları sığsın diye genişliği biraz artırdık
    width: '100%',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #f3f3f3',
    borderTop: '5px solid #3498db',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  textLoading: { color: '#2c3e50', marginBottom: '10px' },
  textSuccess: { color: '#27ae60', marginBottom: '10px' },
  textError: { color: '#c0392b', marginBottom: '10px' },
  subText: { color: '#7f8c8d', fontSize: '14px', marginBottom: '20px', wordBreak: 'break-word' as const },
  iconSuccess: { fontSize: '50px', color: '#27ae60', marginBottom: '10px' },
  iconError: { fontSize: '50px', color: '#c0392b', marginBottom: '10px' },
  button: {
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};