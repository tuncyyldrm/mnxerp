'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#fff',
        fontFamily: 'sans-serif',
        margin: 0,
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#c0392b' }}>⚠️ Sistem Hatası</h2>
        <p style={{ color: '#57606f' }}>Beklenmedik bir arka plan hatası oluştu.</p>
        <button 
          onClick={() => reset()} 
          style={{ padding: '10px 20px', backgroundColor: '#2980b9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Yeniden Dene
        </button>
      </body>
    </html>
  );
}