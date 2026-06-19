"use client";

import { useState, useEffect, useCallback } from 'react';
// Sayfa geçişi için Link, görsel zenginlik için ikonumuzu ekliyoruz
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import Image from 'next/image';
import ScrollToTop from '@/components/ScrollToTop'; // Bileşenin yolunu belirtin

// --- AYARLAR / KONFİGÜRASYON ---
const KRITIK_STOK_ESIGI = 2; // Bu değer ve altı "KRİTİK" sayılır.

// --- TİPLER ---
interface Urun {
  urunkodu: string;        // Benzersiz ürün kodu (Zorunlu)
  urun: string;            // Ürün adı/açıklaması (Zorunlu)
  urunalt?: string;        // Alt açıklama (Boş gelebilir)
  grubu?: string;          // Ürün grubu (Boş gelebilir)
  kateGOri?: string;       // Kategori (Boş gelebilir)
  tipi?: string;           // Tipi (Boş gelebilir)
  ureticifirma?: string;   // Üretici Firma (Boş gelebilir)
  Raf?: string;            // Raf Bilgisi (Boş gelebilir)
  fiyatı: number;          // Fiyat (Zorunlu)
  STK_FULL?: number;       // Eski/Alternatif stok alanı
  MevcutBakiye: number;    // Canlı bakiye alanı (Zorunlu/0 döner)

  // OEM Numaraları (Hepsi opsiyonel - Boş gelebilir)
  OEM?: string;
  OEM_0?: string;
  OEM_1?: string;
  OEM_2?: string;
  OEM_3?: string;
  OEM_4?: string;
  OEM_5?: string;
  OEM_6?: string;
  OEM_7?: string;
  OEM_8?: string;
  OEM_9?: string;
}

// --- YARDIMCI BİLEŞENLER ---
function BilgiSatiri({ etiket, deger, vurgu = false }: { etiket: string, deger: string | number, vurgu?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-3 border-b border-slate-100 ${vurgu ? 'bg-blue-50/50 px-3 -mx-3 rounded-xl' : ''}`}>
      <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{etiket}</span>
      <span className={`text-[11px] md:text-sm font-bold text-right ml-4 ${vurgu ? 'text-blue-700' : 'text-slate-800'}`}>
        {deger || "-"}
      </span>
    </div>
  );
}

export default function Katalog() {

  const [isZoomed, setIsZoomed] = useState(false);
  const [stoklar, setStoklar] = useState<Urun[]>([]);
  const [gruplar, setGruplar] = useState<string[]>([]);
  const [kategoriler, setKategoriler] = useState<string[]>([]);
  const [tipler, setTipler] = useState<string[]>([]);

  const [gorunumModu, setGorunumModu] = useState<'grid' | 'list'>('grid');
  const [seciliGrup, setSeciliGrup] = useState("");
  const [seciliKategori, setSeciliKategori] = useState("");
  const [seciliTip, setSeciliTip] = useState("");

  const [aramaMetni, setAramaMetni] = useState(""); // Input'taki anlık metin
  const [aramaSorgusu, setAramaSorgusu] = useState(""); // Filtrelemeyi tetikleyen asıl metin
  const [sayfa, setSayfa] = useState(1);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [seciliUrun, setSeciliUrun] = useState<Urun | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ urun: "", Raf: "", oems: ["", "", "", "", ""] });
  const [isSaving, setIsSaving] = useState(false);

  // Düzenleme modunu açan fonksiyon
  const handleEditAç = (urun: Urun) => {
    setEditForm({
      urun: urun.urun,
      Raf: urun.Raf || "",
      oems: [
        urun.OEM_0 || urun.OEM || "", // Ana OEM veya OEM_0 fallback
        urun.OEM_1 || "",
        urun.OEM_2 || "",
        urun.OEM_3 || "",
        urun.OEM_4 || ""
      ]
    });
    setIsEditing(false); // Her ihtimale karşı temiz başlasın
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Fiyat Formatlayıcı
  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(deger);
  };

  const getCleanedCode = (code: string) => {
    return code?.replace(/\s?(OEM|ITH|ESD|MUA|EZM|YERLI|ORJ)\b/gi, "")
      .replace(/[/\\?%*:|"<>]/g, '-')
      .trim() || "";
  };

  const getStokDurumu = (stok?: number) => {
    const s = Number(stok) || 0;

    if (s <= 0) {
      return {
        label: "STOKTA YOK",
        bg: "bg-red-50",
        text: "text-red-600",
        border: "border-red-100",
        dot: "bg-red-500",
        isYok: true
      };
    }

    if (s <= KRITIK_STOK_ESIGI) {
      return {
        label: `KRİTİK (SON ${s})`,
        bg: "bg-orange-50",
        text: "text-orange-600",
        border: "border-orange-100",
        dot: "bg-orange-500",
        isKritik: true
      };
    }

    return {
      label: "STOKTA VAR",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-100",
      dot: "bg-emerald-500",
      isVar: true
    };
  };

  // İlk açılışta grupları çek
  useEffect(() => {
    fetch('/api/filtreler?tip=grubu').then(res => res.json()).then(setGruplar).catch(console.error);
  }, []);

  // 🚀 KRİTİK B2B DÜZELTMESİ: Filtreler veya arama terimi değiştiğinde listeyi tamamen temizle ve 1. sayfaya çek
  useEffect(() => {
    setStoklar([]);
    setSayfa(1);
  }, [aramaSorgusu, seciliGrup, seciliKategori, seciliTip]);

  // Grup değişince kategorileri çek
  useEffect(() => {
    if (seciliGrup) {
      fetch(`/api/filtreler?tip=kategori&anaGrup=${encodeURIComponent(seciliGrup)}`)
        .then(res => res.json())
        .then(setKategoriler);
    } else { setKategoriler([]); }
    setSeciliKategori(""); setSeciliTip("");
  }, [seciliGrup]);

  // Kategori değişince tipleri çek
  useEffect(() => {
    if (seciliKategori) {
      fetch(`/api/filtreler?tip=tipi&anaGrup=${encodeURIComponent(seciliGrup)}&kategori=${encodeURIComponent(seciliKategori)}`)
        .then(res => res.json())
        .then(setTipler);
    } else { setTipler([]); }
    setSeciliTip("");
  }, [seciliKategori]);

  // ARAMA TETİKLEYİCİLERİ
  const handleAramaTetikle = () => {
    setAramaSorgusu(aramaMetni);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAramaTetikle();
    }
  };

  // ASIL VERİ ÇEKME FONKSİYONU ("Daha Fazla Göster" Uyumlu Hale Getirildi)
  const stokGetir = useCallback(async () => {
    setYukleniyor(true);
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

      // 🚀 MANTIK: Eğer ilk sayfadaysak listeyi sıfırdan doldur, sonraki sayfalardaysak eskinin altına ekle.
      if (sayfa === 1) {
        setStoklar(yeniUrunler);
      } else {
        setStoklar(prev => [...prev, ...yeniUrunler]);
      }
    } catch (err) {
      console.error("Veri yüklenirken hata:", err);
      if (sayfa === 1) setStoklar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [aramaSorgusu, seciliGrup, seciliKategori, seciliTip, sayfa]);

  // Sadece bağımlılıklar değiştiğinde çalışır
  useEffect(() => {
    stokGetir();
  }, [stokGetir]);


  useEffect(() => {
    if (seciliUrun) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [seciliUrun]);

  // STATE TANIMLARI
  const [hareketler, setHareketler] = useState<any[]>([]);
  const [loadingHareket, setLoadingHareket] = useState(true);

  // EFFECT TANIMI
  useEffect(() => {
    if (seciliUrun && seciliUrun.urunkodu) {
      setLoadingHareket(true);
      fetch(`/api/stok-hareket?detayKodu=${encodeURIComponent(seciliUrun.urunkodu)}`)
        .then(res => res.json())
        .then(data => {
          setHareketler(data);
          setLoadingHareket(false);
        })
        .catch(err => {
          console.error("Hata:", err);
          setLoadingHareket(false);
        });
    } else {
      setHareketler([]);
      setLoadingHareket(false);
    }
  }, [seciliUrun]);

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 pb-10 font-sans selection:bg-blue-100 overflow-x-hidden">

      {/* ÜST BAR */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[60] shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 md:h-16 flex justify-between items-center">

          {/* Sol Kısım: Logo ve Başlık */}
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-lg font-black italic text-base md:text-xl shadow-sm shrink-0">
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
                className={`px-3 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${gorunumModu === 'grid'
                    ? 'bg-white shadow-xs text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                KARE
              </button>
              <button
                onClick={() => setGorunumModu('list')}
                className={`px-3 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all ${gorunumModu === 'list'
                    ? 'bg-white shadow-xs text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                LİSTE
              </button>
            </div>

            {/* Raporlar Paneline Geçiş Butonu */}
            <Link
              href="/raporlar/cari"
              className="flex items-center gap-1.5 h-8 md:h-9 px-3 md:px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 text-blue-600 rounded-lg text-[10px] md:text-xs font-bold transition-all group shrink-0"
            >
              <BarChart3 size={13} className="md:w-[15px] md:h-[15px] transition-transform group-hover:scale-105" />
              <span>RAPORLAR</span>
            </Link>

          </div>

        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-8">

        {/* FİLTRELEME BÖLÜMÜ */}
        <section className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 mb-4 md:mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 items-center">

            {/* ARAMA ALANI */}
            <div className="relative w-full lg:w-[35%] flex gap-2">
              <div className="relative flex-1">
                <input
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAramaTetikle()}
                  placeholder="Parça Adı, Marka veya OEM Kodu..."
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 rounded-lg outline-none text-xs font-bold text-slate-700 border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {/* Lucide Search yoksa direkt 🔍 bırakabilirsin */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                </span>
              </div>

              <button
                onClick={handleAramaTetikle}
                className="h-11 px-5 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center shrink-0 shadow-xs"
              >
                ARA
              </button>
            </div>

            {/* SELECT FİLTRELERİ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 flex-1 w-full gap-2">
              <select
                className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white cursor-pointer transition-all dynamic-select"
                value={seciliGrup}
                onChange={(e) => { setSeciliGrup(e.target.value); setSayfa(1); }}
              >
                <option value="">TÜM GRUPLAR</option>
                {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
              </select>

              <select
                disabled={!seciliGrup}
                className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white disabled:opacity-40 transition-all cursor-pointer"
                value={seciliKategori}
                onChange={(e) => { setSeciliKategori(e.target.value); setSayfa(1); }}
              >
                <option value="">KATEGORİ</option>
                {kategoriler.map(k => <option key={k} value={k}>{k}</option>)}
              </select>

              <select
                disabled={!seciliKategori}
                className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white disabled:opacity-40 col-span-2 sm:col-span-1 transition-all cursor-pointer"
                value={seciliTip}
                onChange={(e) => { setSeciliTip(e.target.value); setSayfa(1); }}
              >
                <option value="">TİP / YÖN</option>
                {tipler.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* SIFIRLA BUTONU */}
            <button
              onClick={() => {
                setSeciliGrup("");
                setSeciliKategori("");
                setSeciliTip("");
                setAramaMetni("");
                setAramaSorgusu("");
                setSayfa(1);
              }}
              className="h-11 w-full lg:w-auto px-4 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold uppercase hover:bg-red-50 hover:text-red-600 border border-slate-200/60 transition-all flex items-center justify-center shrink-0"
            >
              Temizle
            </button>

          </div>
        </section>

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
            {stoklar.map(item => {
              const stokSayisi = Number(item.STK_FULL) || 0;
              const durum = getStokDurumu(stokSayisi);

              return (
                <article
                  key={item.urunkodu}
                  onClick={() => setSeciliUrun(item)}
                  className={`bg-white p-3 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] border transition-all cursor-pointer group flex flex-col h-full active:scale-[0.98] relative
                  ${durum.isYok
                      ? 'border-red-200 opacity-80'
                      : 'border-green-200 hover:shadow-2xl hover:border-blue-400 shadow-sm'
                    }`}
                >

                  {/* ÜST GÖRSEL ALANI */}
                  <div className={`aspect-square rounded-[1.1rem] md:rounded-[1.4rem] mb-3 md:mb-5 flex items-center justify-center overflow-hidden p-2 md:p-4 relative shadow-inner transition-colors
                  ${durum.isYok ? 'bg-slate-0' : 'bg-slate-0 group-hover:bg-blue-0/0'}`}
                  >
                    {/* SOL ÜST: Dinamik Stok Durumu ve Adet */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
                      <span className={`px-2 py-1 rounded-lg text-[7px] md:text-[8px] font-black border shadow-sm uppercase tracking-tighter transition-transform group-hover:scale-105 flex items-center gap-1
                      ${durum.bg} ${durum.text} ${durum.border}`}>
                        {durum.label}
                        {!durum.isYok && <span className="opacity-60 ml-1">({stokSayisi} ADET)</span>}
                      </span>
                    </div>

                    {/* SAĞ ÜST: Katalog Kodu */}
                    <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[12px] md:text-[15px] font-black text-slate-500 border border-slate-100 shadow-sm uppercase z-10">
                      {item.urunkodu}
                    </span>

                    <img
                      src={`/images/urunler/${getCleanedCode(item.urunkodu)}.jpg`}
                      alt={item.urun}
                      className={`max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 
                      ${durum.isYok ? 'opacity-95' : 'grayscale-0'}`}
                      loading="lazy"
                      onError={(e: any) => e.target.src = 'https://placehold.co/400x400?text=Resim+Yok'}
                    />

                    {/* SAĞ ALT: Net Stok Bilgisi */}
                    <div className="absolute bottom-2 right-2">
                      <div className={`px-2 py-1 rounded-md text-[7px] md:text-[8px] font-bold border backdrop-blur-sm shadow-sm
                      ${durum.bg}/80 ${durum.text} ${durum.border}`}>
                        {durum.isYok ? 'TEMİN EDİLECEK' : `MEVCUT: ${stokSayisi}`}
                      </div>
                    </div>

                    {/* SOL ALT: Kritik Stok Uyarı Işığı */}
                    <div className="absolute bottom-2 left-2">
                      {durum.isKritik && (
                        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-orange-200 shadow-sm animate-bounce">
                          <span className={`w-1.5 h-1.5 ${durum.dot} rounded-full animate-ping`} />
                          <span className="text-[7px] font-black text-orange-600 uppercase">TÜKENİYOR</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ÜRÜN BİLGİLERİ */}
                  <div className="flex-1">
                    <p className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest mb-1 
                    ${durum.isYok ? 'text-slate-400' : 'text-blue-500'}`}>
                      {item.grubu}
                    </p>

                    <h3 className={`text-[8px] md:text-[10px] font-bold line-clamp-2 min-h-[2.5rem] leading-tight mb-3 uppercase transition-colors
                    ${durum.isYok ? 'text-slate-500' : 'text-slate-800 group-hover:text-blue-600'}`}>
                      {item.urun}
                    </h3>
                  </div>

                  {/* ALT BAR: Fiyat ve Raf */}
                  <div className={`mt-auto flex justify-between items-center pt-3 border-t 
                  ${durum.isYok ? 'border-slate-100' : 'border-slate-200'}`}>

                    <div className="flex flex-col">
                      <span className={`text-xs md:text-base font-black tracking-tighter ${durum.isYok ? 'text-slate-400' : 'text-slate-950'}`}>
                        {formatPara(item.fiyatı)} TL
                      </span>
                      <span className="text-[6px] text-slate-400 font-bold tracking-tighter uppercase">Birim Fiyat</span>
                    </div>

                    <span className={`text-[7px] md:text-[9px] font-black px-2 py-1 rounded-md transition-all shadow-sm
                    ${durum.isYok
                        ? 'bg-slate-50 text-slate-400 border border-slate-100'
                        : 'bg-slate-900 text-white group-hover:bg-blue-600'}`}>
                      RAF: {item.Raf}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm backdrop-blur-sm">
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
                  {stoklar.map((item) => {
                    const stokSayisi = Number(item.STK_FULL) || 0;
                    const durum = getStokDurumu(stokSayisi);

                    return (
                      <tr
                        key={item.urunkodu}
                        onClick={() => setSeciliUrun(item)}
                        className={`group transition-all duration-200 cursor-pointer
                        ${durum.isYok
                            ? 'bg-gray-50/50 hover:bg-red-50/30'
                            : 'hover:bg-indigo-50/40'}`}
                      >
                        {/* Görsel ve Kod Bölümü */}
                        <td className="px-6 py-4 w-[280px]">
                          <div className="flex items-center gap-4">
                            <div className="relative group/img">
                              <div className={`w-16 h-16 rounded-xl border-2 p-1 transition-all
                              ${durum.isYok ? 'border-slate-100 bg-slate-50' : 'border-white bg-white shadow-sm group-hover/img:border-blue-100'}`}>
                                  <img
                                    src={`/images/urunler/${getCleanedCode(item.urunkodu)}.jpg`}
                                    className="w-full h-full object-contain animate-in zoom-in-95 duration-200 select-none"
                                    alt={item.urun}
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
                                        target.src = 'https://placehold.co/400x400?text=Resim+Yok';
                                      }
                                    }}
                                  />
                                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${durum.dot}`} />
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className={`text-[14px] font-bold px-2 py-0.5 rounded border tracking-tight
                              ${durum.isYok ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                {item.urunkodu}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Ürün Tanımı */}
                        <td className="px-6 py-4">
                          <div className="max-w-[400px]">
                            <h4 className={`text-[12px] font-bold leading-snug mb-2 uppercase
                            ${durum.isYok ? 'text-slate-400' : 'text-slate-800'}`}>
                              {item.urun}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border
                              ${durum.isYok ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {durum.isYok ? 'STOK BEKLENİYOR' : `${stokSayisi} ADET STOKTA`}
                              </span>
                              <span className="text-[10px] text-slate-300 font-medium">|</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                {item.grubu}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Referans / Marka */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 tracking-tighter">OEM</span>
                            <span className={`text-[11px] font-semibold ${durum.isYok ? 'text-slate-400' : 'text-slate-600'}`}>
                              {item.OEM || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Raf / Konum */}
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-block px-4 py-1.5 rounded-lg text-[11px] font-bold border transition-all
                          ${durum.isYok
                              ? 'bg-slate-50 text-slate-300 border-slate-100'
                              : 'bg-white text-slate-700 border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-700 shadow-sm'}`}>
                            {item.Raf || ' '}
                          </div>
                        </td>

                        {/* Fiyat Alanı */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-lg md:text-xl font-black tracking-tight transition-colors
                            ${durum.isYok ? 'text-slate-300' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                              {formatPara(item.fiyatı)} <small className="text-[10px] font-bold">TL</small>
                            </span>
                            <div className="flex items-center gap-2">
                              {durum.isKritik && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-black rounded uppercase">
                                  Kritik Seviye
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 font-bold uppercase">KDV DAHİL</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 🛠️ B2B ODAKLI MODERN VE KULLANIŞLI YENİ SAYFALAMA ALANI */}
        <footer className="flex flex-col items-center justify-center gap-4 py-16 border-t border-slate-100 bg-white/50 backdrop-blur-sm mt-6 rounded-[2.5rem]">

          {/* SQL limitimiz 24 satır olduğu için, eğer tam 24 ve katları şeklinde ürün varsa arkası gelebilir demektir */}
          {stoklar.length > 0 && stoklar.length % 24 === 0 ? (
            <button
              disabled={yukleniyor}
              onClick={() => setSayfa(s => s + 1)}
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
            /* Ürünlerin bittiği ve başka sayfa olmadığı durum */
            stoklar.length > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-full border border-emerald-100 shadow-sm">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-black tracking-wider uppercase">
                  TÜM SONUÇLAR LİSTELENDİ ({stoklar.length} ÜRÜN)
                </span>
              </div>
            )
          )}

          {/* Canlı Durum ve İstatistik Sayacı */}
          {stoklar.length > 0 && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
              Şu an {stoklar.length} ürün görüntüleniyor • Toplam {sayfa} sayfa açıldı
            </p>
          )}
        </footer>
        <ScrollToTop isModalOpen={!!seciliUrun} />
      </main>

      {/* --- DETAY POPUP (MODAL) REVIZE --- */}
      {/* --- DETAY & DÜZENLEME POPUP (MODAL) REVIZE --- */}
      {seciliUrun && (() => {
        // Veritabanından gelen STK_FULL veya MevcutBakiye alanını dinamik oku
        const stokSayisi = Number(seciliUrun.STK_FULL ?? seciliUrun.MevcutBakiye) || 0;
        const isStoktaYok = stokSayisi <= 0;
        const isStokKritik = stokSayisi > 0 && stokSayisi <= KRITIK_STOK_ESIGI;

        // Form elemanları değiştiğinde state'i güncelleyen inline yardımcı
        const handleInputChange = (field: string, val: string) => {
          setEditForm(prev => ({ ...prev, [field]: val }));
        };

        const handleOemChange = (idx: number, val: string) => {
          setEditForm(prev => {
            const yeniOems = [...prev.oems];
            yeniOems[idx] = val;
            return { ...prev, oems: yeniOems };
          });
        };

        // API Kayıt Fonksiyonu (Lokal State Güncellemeli)
        const handleUrunKaydet = async () => {
          setIsSaving(true);
          try {
            const response = await fetch('/api/urun-duzenle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                urunKodu: seciliUrun.urunkodu,
                urunAd: editForm.urun,
                raf: editForm.Raf,
                oems: editForm.oems
              })
            });

            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error || "Güncelleme başarısız.");

            // 🚀 MUAZZAM LOKAL GÜNCELLEME: Sayfa titremeden veriyi hafızada değiştiriyoruz
            const guncelUrun: Urun = {
              ...seciliUrun,
              urun: editForm.urun,
              Raf: editForm.Raf,
              OEM_0: editForm.oems[0],
              OEM_1: editForm.oems[1],
              OEM_2: editForm.oems[2],
              OEM_3: editForm.oems[3],
              OEM_4: editForm.oems[4]
            };

            setStoklar(prev => prev.map(s => s.urunkodu === seciliUrun.urunkodu ? guncelUrun : s));
            setSeciliUrun(guncelUrun); // Açık olan modal detayını da tazele
            setIsEditing(false);       // Düzenleme modundan çık
          } catch (err: any) {
            alert("Hata: " + err.message);
          } finally {
            setIsSaving(false);
          }
        };

        // Listeleme esnasında gösterilecek OEM'leri filtrele
        const oemListesi = [
          seciliUrun.OEM, seciliUrun.OEM_0, seciliUrun.OEM_1, seciliUrun.OEM_2, seciliUrun.OEM_3,
          seciliUrun.OEM_4, seciliUrun.OEM_5, seciliUrun.OEM_6, seciliUrun.OEM_7,
          seciliUrun.OEM_8, seciliUrun.OEM_9
        ].filter(oem => oem && oem.trim() !== "");

        const urunBarkodYazdir = (urun: Urun) => {
          const oemMetni = [
            urun.OEM, urun.OEM_1, urun.OEM_2, urun.OEM_3,
            urun.OEM_4, urun.OEM_5, urun.OEM_6, urun.OEM_7,
            urun.OEM_8, urun.OEM_9
          ].filter(oem => oem && oem.trim() !== "").join(" - ");

          const printWindow = window.open('', '_blank', 'width=600,height=500');
          if (!printWindow) return;
          printWindow.document.write(`
      <html>
        <head>
          <title>Barkod - ${urun.urunkodu}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { size: 55mm 40mm; margin: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: white; display: flex; justify-content: center; align-items: flex-start; height: 40mm; }
            .label-card { width: 52mm; height: 38mm; display: flex; flex-direction: column; align-items: center; padding: 1.5mm 1mm; box-sizing: border-box; overflow: hidden; position: relative; }
            .code { font-size: 16pt; font-weight: 800; line-height: 1; margin-bottom: 0.1mm; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #barcode { max-width: 100%; height: 8mm; margin: 0; }
            .name { font-size: 7.5pt; font-weight: 700; text-align: center; width: 100%; line-height: 1.1; height: 12mm; display: flex; align-items: center; justify-content: center; text-transform: uppercase; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
            .oem-footer { position: absolute; bottom: 1.5mm; left: 1mm; right: 1mm; border-top: 1px solid black; padding-top: 0.7mm; font-size: 6.5pt; font-weight: 800; text-align: center; overflow: hidden; text-overflow: ellipsis; background: white; white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="code">${urun.urunkodu}</div>
            <svg id="barcode"></svg>
            <div class="name">${urun.urun}</div>
            <div class="oem-footer">${oemMetni || "YOK"}</div>
          </div>
          <script>
            window.onload = function() {
              JsBarcode("#barcode", "${urun.urunkodu}", {
                format: "CODE128",
                width: 1.3,
                height: 25,
                displayValue: false,
                margin: 0
              });
              setTimeout(() => { window.print(); window.close(); }, 350);
            };
          </script>
        </body>
      </html>
    `);
          printWindow.document.close();
        };

        return (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            {/* Arka Plan Karartısı - Kaydetme esnasında veya Zoom açıkken kapanmayı önler */}
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => { if (!isSaving && !isZoomed) { setSeciliUrun(null); setIsEditing(false); } }}
            ></div>

            <div className="bg-white w-full max-w-[1000px] relative shadow-2xl flex flex-col md:flex-row overflow-hidden h-screen md:h-auto md:max-h-[85vh] z-10 animate-in slide-in-from-bottom-6 duration-300 rounded-none md:rounded-2xl">

              <button
                onClick={() => { setSeciliUrun(null); setIsEditing(false); }}
                disabled={isSaving}
                className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 bg-slate-100/90 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center z-[130] transition-colors shadow-xs disabled:opacity-50"
              >
                <span className="text-xs font-black">✕</span>
              </button>

              {/* SOL: ÜRÜN GÖRSELİ */}
              <div className="w-full md:w-[40%] bg-slate-50/50 p-4 md:p-6 flex flex-col items-center justify-center relative border-b md:border-b-0 md:border-r border-slate-100 shrink-0 h-[35vh] md:h-auto">
                <div className="absolute top-3 left-3 z-20">
                  <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight ${isStoktaYok ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {isStoktaYok ? '● Stokta Yok' : '● Stokta Mevcut'}
                  </span>
                </div>

                <div className="w-full h-full flex items-center justify-center relative group cursor-zoom-in" onClick={() => { if (!isSaving) setIsZoomed(true); }}>
                  <img
                    src={`/images/urunler/${getCleanedCode(seciliUrun.urunkodu)}.jpg`}
                    className="w-full h-full object-contain p-2 transition-transform hover:scale-[1.02]"
                    alt={seciliUrun.urun}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
                        target.src = 'https://placehold.co/400x400?text=Resim+Yok';
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex bg-black/5 rounded-lg">
                    <span className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-xs">Büyütmek için tıkla</span>
                  </div>
                </div>

                {/* BÜYÜTÜLMÜŞ GÖRSEL (ZOOM MODAL) */}
                {isZoomed && (
                  <div
                    className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 md:p-8 cursor-zoom-out"
                    onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                      className="absolute top-4 right-4 md:top-6 md:right-6 text-white bg-white/10 p-2.5 md:p-3 rounded-full hover:bg-white/20 transition-all z-50"
                    >
                      <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="w-full h-full flex items-center justify-center max-w-6xl max-h-[85vh] md:max-h-[90vh]">
                      <img
                        src={`/images/urunler/${getCleanedCode(seciliUrun.urunkodu)}.jpg`}
                        className="w-full h-full object-contain animate-in zoom-in-95 duration-200 select-none"
                        alt={seciliUrun.urun}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
                            target.src = 'https://placehold.co/400x400?text=Resim+Yok';
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SAĞ: İÇERİK ALANI */}
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">{seciliUrun.grubu}</span>
                      <span className="text-slate-300 text-[9px]">/</span>
                      <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{seciliUrun.kateGOri}</span>
                    </div>
                    <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight uppercase">
                      {seciliUrun.urunkodu}
                    </h2>
{/* ÜRÜN ADI / AÇIKLAMASI DÜZENLEME ALANI */}
{isEditing ? (
  <div className="mt-2">
    <label className="block text-[8px] font-bold text-blue-600 uppercase mb-1">Ürün Açıklaması</label>
    <textarea
      value={editForm.urun}
      onChange={e => handleInputChange('urun', e.target.value)}
      className="w-full p-2 text-xs font-mono border border-blue-300 rounded-lg bg-blue-50/30 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
      rows={2}
    />
  </div>
) : (
  <p className="text-slate-500 text-xs mt-0.5 font-mono break-words uppercase">{seciliUrun.urun}</p>
)}
                  </div>

                  <div className="space-y-3">

                    {/* REFERANS / OEM ALANI DÜZENLEME */}
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Referans Numaraları (OEM)</span>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {editForm.oems.map((oem, idx) => (
<div key={idx}>
  {/* idx 0 ise 'OEM', değilse 'OEM-1', 'OEM-2' şeklinde dinamik isim verir */}
  <label className="block text-[7px] text-slate-400 font-bold uppercase">
    {idx === 0 ? 'OEM' : `OEM-${idx}`}
  </label>
  <input
    type="text"
    value={oem}
    onChange={e => handleOemChange(idx, e.target.value)}
    className="w-full p-1.5 text-[10px] font-semibold bg-white border border-slate-200 rounded-sm focus:outline-hidden focus:border-blue-500"
    placeholder="Boş bırakılabilir"
  />
</div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {oemListesi.length > 0 ? oemListesi.map((oem, index) => (
                            <span key={index} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded text-[10px] font-semibold">{oem}</span>
                          )) : <span className="text-slate-400 text-[10px] italic">Referans bulunamadı</span>}
                        </div>
                      )}
                    </div>

                    {/* RAF & STOK GRID ALANI */}
                    <div className="grid grid-cols-2 gap-2">
<div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center flex flex-col justify-center">
  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Konum / Raf</span>
  {isEditing ? (
    <input
      type="text"
      value={editForm.Raf}
      onChange={e => handleInputChange('Raf', e.target.value)}
      className="w-full mt-1 p-1 text-center text-xs font-bold bg-white border border-slate-200 rounded-sm focus:outline-hidden focus:border-blue-500"
      placeholder="Raf No"
    />
  ) : (
    <span className="text-xs md:text-sm font-bold text-slate-800">{seciliUrun.Raf || "-"}</span>
  )}
</div>
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center flex flex-col justify-center">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stok Durumu</span>
                        <span className={`text-xs md:text-sm font-black ${isStoktaYok ? 'text-red-600' : isStokKritik ? 'text-orange-600' : 'text-emerald-600'}`}>
                          {isStoktaYok ? "YOK" : `(${stokSayisi} ADET)`}
                        </span>
                      </div>
                    </div>

                    {/* STOK HAREKETLERİ TABLOSU */}
                    <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-2xs">
                      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Son Stok Hareketleri</h3>
                      {loadingHareket ? (
                        <div className="text-xs text-slate-400 animate-pulse">Yükleniyor...</div>
                      ) : (
                        <div className="max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                          {hareketler.length > 0 ? (
                            <table className="w-full text-[10px] border-collapse">
                              <thead className="sticky top-0 bg-white z-10">
                                <tr className="text-left text-slate-400 border-b border-slate-100">
                                  <th className="py-1">Tarih</th>
                                  <th className="py-1">Müşteri</th>
                                  <th className="py-1 text-right">Fiyat</th>
                                  <th className="py-1 text-right">Miktar</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hareketler.map((h, idx) => (
                                  <tr key={idx} className="border-b border-slate-50">
                                    <td className="py-1 text-slate-600 whitespace-nowrap">{h.Tarih ? new Date(h.Tarih).toLocaleDateString('tr-TR') : "N/A"}</td>
                                    <td className="py-1 text-slate-700 truncate max-w-[80px]">{h.MusteriAdi || "Belirtilmemiş"}</td>
                                    <td className="py-1 text-right text-slate-900 font-medium">
                                      {h.BirimFiyat && !isNaN(parseFloat(h.BirimFiyat)) ? parseFloat(h.BirimFiyat).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : "-"}
                                    </td>
                                    <td className="py-1 text-right font-bold">
                                      {parseFloat(h.Giris || 0) > 0 ? <span className="text-emerald-600">+{h.Giris}</span> : <span className="text-rose-600">-{h.Cikis || 0}</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Hareket kaydı bulunamadı.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* FİYAT & AKSİYON TABANI */}
                <div className="p-4 md:p-5 bg-slate-50 md:bg-white border-t border-slate-100 flex flex-row items-center justify-between gap-3 shrink-0 pb-safe-bottom">
                  <div className="flex flex-col">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Birim Fiyat</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{formatPara(seciliUrun.fiyatı)}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">TL</span>
                    </div>
                  </div>

                  {/* DİNAMİK BUTON GRUBU */}
                  <div className="flex flex-1 md:flex-none justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setIsEditing(false)}
                          disabled={isSaving}
                          className="px-4 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 active:scale-[0.98] disabled:opacity-50"
                        >
                          İptal
                        </button>
                        <button
                          onClick={handleUrunKaydet}
                          disabled={isSaving}
                          className="px-5 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 flex items-center gap-1.5"
                        >
                          {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Düzenle Tetikleyici Buton - Önce verileri doldurur ardından düzenleme görünümüne sokar */}
                        <button
                          onClick={() => { handleEditAç(seciliUrun); setIsEditing(true); }}
                          className="px-3 md:px-4 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-slate-800 text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          <span>Düzenle</span>
                        </button>

                        <button
                          onClick={() => urunBarkodYazdir(seciliUrun)}
                          className="px-3 md:px-5 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 active:scale-[0.98]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h10M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
                          <span className="hidden sm:inline">Barkod</span>
                        </button>

                        <button
                          disabled={isStoktaYok}
                          onClick={() => window.open(`https://wa.me/90532XXXXXXX?text=${encodeURIComponent(`Merhaba, ${seciliUrun.urunkodu} kodlu ürün hakkında bilgi almak istiyorum.`)}`)}
                          className={`px-4 md:w-36 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${isStoktaYok ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'}`}
                        >
                          {isStoktaYok ? 'Yok' : 'WhatsApp'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

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