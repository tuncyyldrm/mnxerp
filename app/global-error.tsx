'use client'; // 👈 En kritik satır burası şef, sakın silme!

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Dükkan bilgisayarında arka planda bir hata olursa terminale bassın
    console.error('Kritik Sistem Hatası:', error);
  }, [error]);

  return (
    <html>
      <body style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#f8d7da', 
        fontFamily: 'sans-serif',
        color: '#721c24',
        textAlign: 'center',
        padding: '20px',
        margin: 0
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <h2 style={{ fontSize: '22px', marginBottom: '10px', color: '#c0392b' }}>
            ⚠️ Kritik Sistem Hatası
          </h2>
          <p style={{ color: '#57606f', fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
            MNX ERP arka plan servislerinde beklenmeyen bir duraksama yaşandı. Panel verileri korunuyor.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#2980b9',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              width: '100%'
            }}
          >
            Yeniden Dene ve Sistemi Kurtar
          </button>
        </div>
      </body>
    </html>
  );
}