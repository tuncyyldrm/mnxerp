'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import ScrollToTop from '@/components/ScrollToTop';
import { Urun } from '@/components/katalog/types';
import KatalogFiltre from '@/components/katalog/KatalogFiltre';
import UrunGridKart from '@/components/katalog/UrunGridKart';
import UrunListeSatir from '@/components/katalog/UrunListeSatir';
import UrunDetayModal from '@/components/katalog/UrunDetayModal';
import HizliSatisModal from '@/components/katalog/HizliSatisModal';

export default function Katalog() {
  const [stoklar, setStoklar] = useState<Urun[]>([]);
  const [gruplar, setGruplar] = useState<string[]>([]);
  const [kategoriler, setKategoriler] = useState<string[]>([]);
  const [tipler, setTipler] = useState<string[]>([]);

  const [gorunumModu, setGorunumModu] = useState<'grid' | 'list'>('grid');
  const [seciliGrup, setSeciliGrup] = useState('');
  const [seciliKategori, setSeciliKategori] = useState('');
  const [seciliTip, setSeciliTip] = useState('');

  const [aramaMetni, setAramaMetni] = useState('');
  const [aramaSorgusu, setAramaSorgusu] = useState('');
  const [sayfa, setSayfa] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Modal State'leri
  const [seciliUrun, setSeciliUrun] = useState<Urun | null>(null);
  const [satisModalAcik, setSatisModalAcik] = useState(false);
  const [satisYapilacakUrun, setSatisYapilacakUrun] = useState<Urun | null>(null);

  // İlk açılışta grupları çek
  useEffect(() => {
    let ignore = false;
    fetch('/api/filtreler?tip=grubu')
      .then(res => res.json())
      .then(data => {
        if (!ignore) setGruplar(Array.isArray(data) ? data : []);
      })
      .catch(console.error);

    return () => {
      ignore = true;
    };
  }, []);

  // Grup değişince kategorileri çek
  useEffect(() => {
    let ignore = false;
    if (seciliGrup) {
      fetch(`/api/filtreler?tip=kategori&anaGrup=${encodeURIComponent(seciliGrup)}`)
        .then(res => res.json())
        .then(data => {
          if (!ignore) setKategoriler(Array.isArray(data) ? data : []);
        });
    }

    return () => {
      ignore = true;
    };
  }, [seciliGrup]);

  // Kategori değişince tipleri çek
  useEffect(() => {
    let ignore = false;
    if (seciliKategori) {
      fetch(`/api/filtreler?tip=tipi&anaGrup=${encodeURIComponent(seciliGrup)}&kategori=${encodeURIComponent(seciliKategori)}`)
        .then(res => res.json())
        .then(data => {
          if (!ignore) setTipler(Array.isArray(data) ? data : []);
        });
    }

    return () => {
      ignore = true;
    };
  }, [seciliGrup, seciliKategori]);

  // Asıl Veri Çekme Effect'i
  useEffect(() => {
    let ignore = false;

    const fetchStok = async () => {
      try {
        const params = new URLSearchParams({
          search: aramaSorgusu,
          grubu: seciliGrup,
          kategori: seciliKategori,
          tipi: seciliTip,
          sayfa: String(sayfa)
        });
        const res = await fetch(`/api/stok?${params}`);
        const data = await res.json();
        const yeniUrunler = Array.isArray(data) ? data : [];

        if (!ignore) {
          if (sayfa === 1) {
            setStoklar(yeniUrunler);
          } else {
            setStoklar(prev => [...prev, ...yeniUrunler]);
          }
        }
      } catch (err) {
        console.error('Veri yüklenirken hata:', err);
        if (!ignore && sayfa === 1) {
          setStoklar([]);
        }
      } finally {
        if (!ignore) {
          setYukleniyor(false);
        }
      }
    };

    fetchStok();

    return () => {
      ignore = true;
    };
  }, [aramaSorgusu, seciliGrup, seciliKategori, seciliTip, sayfa]);

  useEffect(() => {
    if (seciliUrun || satisModalAcik) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [seciliUrun, satisModalAcik]);

  const handleAramaTetikle = () => {
    setYukleniyor(true);
    setSayfa(1);
    setAramaSorgusu(aramaMetni);
  };

  const handleGrupDegistir = (grup: string) => {
    setYukleniyor(true);
    setSeciliGrup(grup);
    setSeciliKategori('');
    setSeciliTip('');
    setKategoriler([]);
    setTipler([]);
    setSayfa(1);
  };

  const handleKategoriDegistir = (kat: string) => {
    setYukleniyor(true);
    setSeciliKategori(kat);
    setSeciliTip('');
    setTipler([]);
    setSayfa(1);
  };

  const handleTipDegistir = (tip: string) => {
    setYukleniyor(true);
    setSeciliTip(tip);
    setSayfa(1);
  };

  const handleFiltreTemizle = () => {
    setYukleniyor(true);
    setSeciliGrup('');
    setSeciliKategori('');
    setSeciliTip('');
    setKategoriler([]);
    setTipler([]);
    setAramaMetni('');
    setAramaSorgusu('');
    setSayfa(1);
  };

  const handleUrunGuncellendi = (guncelUrun: Urun) => {
    setStoklar(prev => prev.map(s => s.urunkodu === guncelUrun.urunkodu ? guncelUrun : s));
    setSeciliUrun(guncelUrun);
  };

  const handleSatisButonTikla = (urun: Urun) => {
    setSatisYapilacakUrun(urun);
    setSatisModalAcik(true);
  };

  const handleDahaFazlaYukle = () => {
    setYukleniyor(true);
    setSayfa(s => s + 1);
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 pb-10 font-sans selection:bg-blue-100 overflow-x-hidden">

      {/* ÜST BAR */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[60] shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 md:h-16 flex justify-between items-center">

          {/* Sol Kısım: Logo ve Başlık */}
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-lg font-black italic text-base md:text-xl shadow-xs shrink-0">
              E
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-black tracking-tight leading-none uppercase text-slate-800">
                EZM OTO
              </h1>
              <p className="text-[8px] md:text-[10px] font-bold text-blue-500 uppercase tracking-[0.15em] mt-0.5 md:mt-1">
                Yedek Parça & Katalog Sistemi
              </p>
            </div>
          </div>

          {/* Sağ Kısım: Kontroller ve Raporlar Linki */}
          <div className="flex items-center gap-2.5">

            {/* Görünüm Modu Seçici (Kare/Liste) */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                onClick={() => setGorunumModu('grid')}
                className={`px-3 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${
                  gorunumModu === 'grid'
                    ? 'bg-white shadow-xs text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                KARE
              </button>
              <button
                onClick={() => setGorunumModu('list')}
                className={`px-3 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${
                  gorunumModu === 'list'
                    ? 'bg-white shadow-xs text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                LİSTE
              </button>
            </div>

            {/* Yönetim Paneli Linki */}
            <Link
              href="/raporlar/kar-analiz"
              className="flex items-center gap-1.5 h-8 md:h-9 px-3.5 md:px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] md:text-xs font-bold transition-all group shrink-0 shadow-xs"
            >
              <LayoutDashboard size={14} className="transition-transform group-hover:scale-105" />
              <span>YÖNETİM PANELİ</span>
            </Link>

          </div>

        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-8">

        {/* FİLTRELEME BÖLÜMÜ */}
        <KatalogFiltre
          aramaMetni={aramaMetni}
          setAramaMetni={setAramaMetni}
          onAramaTetikle={handleAramaTetikle}
          seciliGrup={seciliGrup}
          setSeciliGrup={handleGrupDegistir}
          gruplar={gruplar}
          seciliKategori={seciliKategori}
          setSeciliKategori={handleKategoriDegistir}
          kategoriler={kategoriler}
          seciliTip={seciliTip}
          setSeciliTip={handleTipDegistir}
          tipler={tipler}
          onTemizle={handleFiltreTemizle}
          setSayfa={setSayfa}
        />

        {/* LİSTELEME ALANI */}
        {yukleniyor && sayfa === 1 ? (
          <div className="py-40 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-[5px] border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Ürünler Hazırlanıyor...</p>
          </div>
        ) : stoklar.length === 0 ? (
          <div className="py-40 text-center">
            <div className="text-6xl mb-6">📦</div>
            <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Aranan kriterlerde ürün bulunamadı.</h3>
          </div>
        ) : gorunumModu === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 md:gap-6">
            {stoklar.map(item => (
              <UrunGridKart
                key={item.urunkodu}
                item={item}
                onClick={() => setSeciliUrun(item)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs backdrop-blur-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[950px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Görsel / Kod</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ürün Tanımı</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Referans No</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Konum</th>
                    <th className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Birim Fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stoklar.map((item) => (
                    <UrunListeSatir
                      key={item.urunkodu}
                      item={item}
                      onClick={() => setSeciliUrun(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SAYFALAMA ALANI */}
        <footer className="flex flex-col items-center justify-center gap-4 py-16 border-t border-slate-100 bg-white/50 backdrop-blur-xs mt-6 rounded-[2.5rem]">
          {stoklar.length > 0 && stoklar.length % 24 === 0 ? (
            <button
              disabled={yukleniyor}
              onClick={handleDahaFazlaYukle}
              className="group flex items-center justify-center gap-3 px-8 py-4 h-14 rounded-xl bg-slate-950 text-white font-bold text-sm shadow-md transition-all hover:bg-slate-900 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
            >
              {yukleniyor ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>PARÇALAR YÜKLENİYOR...</span>
                </>
              ) : (
                <>
                  <span>DAHA FAZLA PARÇA GÖSTER</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:translate-y-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            stoklar.length > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-full border border-emerald-100 shadow-xs">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-black tracking-wider uppercase">
                  TÜM SONUÇLAR LİSTELENDİ ({stoklar.length} ÜRÜN)
                </span>
              </div>
            )
          )}

          {stoklar.length > 0 && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
              Şu an {stoklar.length} ürün görüntüleniyor • Toplam {sayfa} sayfa açıldı
            </p>
          )}
        </footer>

        <ScrollToTop isModalOpen={!!seciliUrun || satisModalAcik} />
      </main>

      {/* DETAY VE DÜZENLEME MODALI */}
      {seciliUrun && (
        <UrunDetayModal
          key={seciliUrun.urunkodu}
          urun={seciliUrun}
          isOpen={!!seciliUrun}
          onClose={() => setSeciliUrun(null)}
          onUrunGuncellendi={handleUrunGuncellendi}
          onSatisYap={handleSatisButonTikla}
        />
      )}

      {/* HIZLI SATIŞ MODALI */}
      {satisYapilacakUrun && (
        <HizliSatisModal
          key={satisYapilacakUrun.urunkodu}
          urun={satisYapilacakUrun}
          isOpen={satisModalAcik}
          onClose={() => setSatisModalAcik(false)}
          onSatisBasarili={() => {
            setYukleniyor(true);
            setSayfa(1);
          }}
        />
      )}

      {/* Global CSS for Animations & Scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .scale-in { animation: scaleIn 0.3s ease-out; }
        @keyframes scaleIn {
          from { transform: scale(0.9) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

    </div>
  );
}