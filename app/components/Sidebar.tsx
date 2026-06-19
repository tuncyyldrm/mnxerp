'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, Users, FileText, 
  Layers, ShoppingCart, Sliders, Menu, X 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Klasör yapına göre dinamik menü listesi
  const menuItems = [
    { name: 'Cari Raporları', href: '/raporlar/cari', icon: Users },
    { name: 'Fatura Raporları', href: '/raporlar/fatura', icon: FileText },
    { name: 'Anasayfa', href: '/', icon: Layers },
  ];

  return (
    <>
      {/* MOBIL RESPONSIVE UST BAR -> print:hidden eklendi */}
      <div className="md:hidden print:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">E</div>
          <span className="font-black text-slate-800 text-sm tracking-wide">Ezm Oto Panel</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* MOBIL ARKA FON GÖLGESİ (OVERLAY) -> print:hidden eklendi */}
      {isOpen && (
        <div 
          className="md:hidden print:hidden fixed inset-0 bg-slate-950/20 backdrop-blur-xs z-40" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* ANA SIDEBAR -> print:hidden eklendi */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
        print:hidden
        md:translate-x-0 
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${'pt-16 md:pt-0'} /* Mobil üst bar payı */
      `}>
        {/* LOGO ALANI */}
        <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm shadow-indigo-500/20">
            E
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-sm leading-tight tracking-wide">Ezm Oto</h2>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">Yönetim Paneli</p>
          </div>
        </div>

        {/* MENÜ LINKLERI */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)} // Mobil tıklamada kapat
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }
                `}
              >
                <Icon 
                  size={18} 
                  className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} 
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* ALT KISIM (KULLANICI BİLGİSİ VB.) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">v1.0.4 - Kararlı Sürüm</p>
        </div>
      </aside>
    </>
  );
}