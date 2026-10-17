import Sidebar from '../components/Sidebar';

export default function YonetimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sol Menü Bileşeni (Masaüstü ve Mobil Bar dahil) */}
      <Sidebar />

      {/* Sağ Taraf - Sayfa İçeriği */}
      <main className="flex-1 md:pl-64 pt-16 md:pt-0 min-w-0 transition-all duration-200">
        {children}
      </main>
    </div>
  );
}
