import Sidebar from '../components/Sidebar';

export default function RaporlarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sol Menü Bileşeni */}
      <Sidebar />

      {/* Sağ Taraf - Dinamik Sayfa İçerikleri */}
      {/* md:pl-64 masaüstünde menünün genişliği kadar sağa pay bırakır, pt-16 mobilde üst barın altına girmesini engeller */}
      <main className="flex-1 md:pl-64 pt-16 md:pt-0 min-w-0 transition-all duration-200">
        {children}
      </main>
    </div>
  );
}