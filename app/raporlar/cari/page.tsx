'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Users, AlertTriangle, ShoppingBag, MapPin, 
  ArrowUpRight, ArrowDownLeft, Search, Loader2, RefreshCw, X, Eye, 
  FileText, ChevronDown, ChevronUp, ExternalLink, Clock, MessageSquare, 
  Copy, Check, PlusCircle, Edit3, Phone, Mail, Building, Save
} from 'lucide-react';

interface ViewCari {
  id: number;
  kodu: string;
  firma: string;
  sehir: string;
  odemesekli?: string;
  vade?: number;
  CariTipi: string;
  NetBakiyeTL: number;
  BakiyeDurumu?: string;
  KayitTarihi?: string;
  SonIslemTarihi: string;
  Kanali: string;
  GecikmeGunSayisi: number;
  tel1?: string;
  tel2?: string;
  email?: string;
  yetkili?: string;
  adresi?: string;
  vergidairesi?: string;
  vergino?: string;
  riskSeviyesi: 'GUNCEL' | 'DIKKAT' | 'KRITIK' | 'YUKSEK_RISK';
}

interface CariHareket {
  CariID: number;
  CariKodu: string;
  FirmaAdi: string;
  IslemNo: number; 
  IslemTarihi: string;
  BelgeNo: string;
  IslemTipi: string;
  IslemTutari: number;
  Yon: 'B' | 'A'; 
}

interface FaturaSatir {
  satirId: number;
  urunAdi: string;
  stokKodu: string;
  birim: string;
  miktar: number;
  birimFiyat: number;
  satirTutari: number;
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', { 
  style: 'currency', 
  currency: 'TRY', 
  minimumFractionDigits: 2 
});
const formatTRY = (value: number) => currencyFormatter.format(value || 0);

const formatDateString = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
};

function CariYonetimMerkeziContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'yaslandirma' ? 'yaslandirma' : 'liste';

  // Aktif Sekme: 'liste' (Tüm Cariler & Ekstre) | 'yaslandirma' (Borç Yaşlandırma & Risk)
  const [activeTab, setActiveTab] = useState<'liste' | 'yaslandirma'>(initialTab);

  const [cariler, setCariler] = useState<ViewCari[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTip, setSelectedTip] = useState('');
  const [selectedSehir, setSelectedSehir] = useState('');
  const [onlyGecikenler, setOnlyGecikenler] = useState(false);
  const [riskFiltresi, setRiskFiltresi] = useState<string>('ALL');
  const [kopyalandiId, setKopyalandiId] = useState<number | null>(null);

  // Tarih Filtresi
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Ekstre Çekmece Paneli
  const [selectedCari, setSelectedCari] = useState<ViewCari | null>(null);
  const [hareketler, setHareketler] = useState<CariHareket[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedIslem, setExpandedIslem] = useState<number | null>(null);
  const [urunler, setUrunler] = useState<FaturaSatir[]>([]);
  const [urunLoading, setUrunLoading] = useState(false);

  // Cari Düzenleme Modal State
  const [duzenleModalOpen, setDuzenleModalOpen] = useState(false);
  const [duzenlenecekCari, setDuzenlenecekCari] = useState<ViewCari | null>(null);
  const [duzenleForm, setDuzenleForm] = useState({
    tel1: '',
    tel2: '',
    email: '',
    yetkili: '',
    adresi: '',
    sehir: '',
    vergidairesi: '',
    vergino: ''
  });
  const [isSavingCari, setIsSavingCari] = useState(false);

  // Hızlı Tahsilat Modal State
  const [tahsilatModalOpen, setTahsilatModalOpen] = useState(false);
  const [tahsilatCari, setTahsilatCari] = useState<ViewCari | null>(null);
  const [tahsilatTutar, setTahsilatTutar] = useState<string>('');
  const [tahsilatKasaId, setTahsilatKasaId] = useState<number>(1);
  const [kasalar, setKasalar] = useState<{ kasaid: number; kasa_ack: string; BK_TL: number }[]>([]);
  const [tahsilatIslemde, setTahsilatIslemde] = useState(false);
  const [bilgiMesaj, setBilgiMesaj] = useState<string | null>(null);

  // Carileri Yükle
  const loadCariler = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTip) params.append('tip', selectedTip);

    fetch(`/api/cariler?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setCariler(data.cariler || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadCariler();

    // Kasaları çek
    fetch('/api/finans/tahsilat')
      .then(res => res.json())
      .then(d => {
        if (d.success) setKasalar(d.kasalar || []);
      })
      .catch(console.error);
  }, [selectedTip]);

  // Ekstre açılınca body scroll kilit
  useEffect(() => {
    document.body.style.overflow = (selectedCari || duzenleModalOpen || tahsilatModalOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedCari, duzenleModalOpen, tahsilatModalOpen]);

  // Ekstre için Cari Seç
  const handleCariSelect = (cari: ViewCari) => {
    setSelectedCari(cari);
    setDetailLoading(true);
    setExpandedIslem(null); 
    setUrunler([]);

    fetch(`/api/cariler?detayId=${cari.id}`)
      .then(res => res.json())
      .then(data => {
        setHareketler(data || []);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  };

  // Fatura alt satırlarını aç/kapa
  const toggleIslemDetay = (islemNo: number) => {
    if (expandedIslem === islemNo) {
      setExpandedIslem(null);
      return;
    }
    setExpandedIslem(islemNo);
    setUrunLoading(true);
    setUrunler([]);

    fetch(`/api/cariler?islemId=${islemNo}&islemNo=${islemNo}`)
      .then(res => res.json())
      .then(result => {
        setUrunler(result.success && result.data?.satirlar ? result.data.satirlar : []);
        setUrunLoading(false);
      })
      .catch(() => {
        setUrunler([]);
        setUrunLoading(false);
      });
  };

  // Cari Düzenleme Modalını Aç
  const handleOpenDuzenle = (cari: ViewCari, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDuzenlenecekCari(cari);
    setDuzenleForm({
      tel1: cari.tel1 || '',
      tel2: cari.tel2 || '',
      email: cari.email || '',
      yetkili: cari.yetkili || '',
      adresi: cari.adresi || '',
      sehir: cari.sehir || '',
      vergidairesi: cari.vergidairesi || '',
      vergino: cari.vergino || ''
    });
    setDuzenleModalOpen(true);
  };

  // Cari Düzenlemeyi Kaydet
  const handleSaveCari = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duzenlenecekCari) return;
    setIsSavingCari(true);

    try {
      const res = await fetch('/api/cariler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: duzenlenecekCari.id,
          ...duzenleForm
        })
      });

      const data = await res.json();
      if (data.success) {
        setBilgiMesaj(`${duzenlenecekCari.firma} bilgileri başarıyla güncellendi.`);
        // Yerel state güncelle
        setCariler(prev => prev.map(c => c.id === duzenlenecekCari.id ? { ...c, ...duzenleForm } : c));
        if (selectedCari && selectedCari.id === duzenlenecekCari.id) {
          setSelectedCari(prev => prev ? { ...prev, ...duzenleForm } : null);
        }
        setDuzenleModalOpen(false);
        setTimeout(() => setBilgiMesaj(null), 4000);
      } else {
        alert('Hata: ' + (data.error || 'Güncellenemedi'));
      }
    } catch {
      alert('Sunucu bağlantı hatası oluştu.');
    } finally {
      setIsSavingCari(false);
    }
  };

  // Hızlı Tahsilat Modalını Aç
  const handleOpenTahsilat = (cari: ViewCari, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTahsilatCari(cari);
    setTahsilatTutar(String(Math.abs(cari.NetBakiyeTL || 0)));
    setTahsilatModalOpen(true);
  };

  // Hızlı Tahsilat Kaydet
  const handleTahsilatKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tahsilatCari) return;
    const tutarNum = parseFloat(tahsilatTutar.replace(',', '.'));
    if (isNaN(tutarNum) || tutarNum <= 0) {
      alert('Geçerli bir tutar girin.');
      return;
    }

    setTahsilatIslemde(true);
    try {
      const res = await fetch('/api/finans/tahsilat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cariId: tahsilatCari.id,
          cariAdi: tahsilatCari.firma,
          kasaId: tahsilatKasaId,
          tutar: tutarNum,
          aciklama: `${tahsilatCari.firma} TAHSİLAT`,
          islemTipi: 'NAKİT TAHSİLAT'
        })
      });
      const data = await res.json();
      if (data.success) {
        setBilgiMesaj(`${tahsilatCari.firma} için ${formatTRY(tutarNum)} tahsilat kaydedildi!`);
        setTahsilatModalOpen(false);
        setTahsilatTutar('');
        loadCariler();
        setTimeout(() => setBilgiMesaj(null), 5000);
      } else {
        alert('Hata: ' + data.error);
      }
    } catch {
      alert('Sunucu hatası oluştu.');
    } finally {
      setTahsilatIslemde(false);
    }
  };

  // WhatsApp Mesajı
  const cleanPhoneNumber = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '').replace(/^0/, '');
  };

  const getWhatsAppMessage = (item: ViewCari) => {
    return `Sayın ${item.firma}, Ezm Oto sistemimizde ${formatTRY(item.NetBakiyeTL)} tutarında açık bakiyeniz bulunmaktadır. (Gecikme süresi: ${item.GecikmeGunSayisi} gün). Ödemenizi rica eder, hayırlı işler dileriz.`;
  };

  const handleCopyMessage = (item: ViewCari, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = getWhatsAppMessage(item);
    navigator.clipboard.writeText(text);
    setKopyalandiId(item.id);
    setTimeout(() => setKopyalandiId(null), 2500);
  };

  const handleOpenWhatsApp = (item: ViewCari, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rawPhone = item.tel1 || item.tel2 || '';
    const phone = cleanPhoneNumber(rawPhone);
    const msg = encodeURIComponent(getWhatsAppMessage(item));
    const url = phone ? `https://wa.me/90${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  // Şehir Listesi
  const sehirListesi = useMemo(() => {
    return Array.from(new Set(cariler.map(c => c.sehir?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [cariler]);

  // Filtrelenmiş Cariler (Sekme 1 İçin)
  const filteredCariler = useMemo(() => {
    const sTerm = searchTerm.toLowerCase().trim();
    return cariler.filter(c => {
      const isCariRiskli = !(c.kodu || '').startsWith('770') && (c.NetBakiyeTL || 0) > 0 && Number(c.GecikmeGunSayisi || 0) > 30;
      const aramaRiskliTetiklendi = (sTerm === 'risk' || sTerm === 'geciken' || sTerm === 'vade') && isCariRiskli;

      const matchesSearch = !sTerm || (
        (c.firma?.toLowerCase() || '').includes(sTerm) ||
        (c.kodu || '').toLowerCase().includes(sTerm) ||
        (c.tel1 || '').includes(sTerm) ||
        (c.tel2 || '').includes(sTerm) ||
        (sTerm === 'trendyol' && c.Kanali?.toLowerCase() === 'trendyol') ||
        aramaRiskliTetiklendi
      );
      
      const matchesSehir = !selectedSehir || c.sehir === selectedSehir;
      const matchesGecikme = !onlyGecikenler || isCariRiskli;

      return matchesSearch && matchesSehir && matchesGecikme;
    });
  }, [cariler, searchTerm, selectedSehir, onlyGecikenler]);

  // Borçlu ve Yaşlandırma Carileri (Sekme 2 İçin)
  const borcluCariler = useMemo(() => {
    return cariler
      .filter(c => !(c.kodu || '').startsWith('770') && (c.NetBakiyeTL || 0) > 0)
      .filter(c => {
        if (riskFiltresi !== 'ALL' && c.riskSeviyesi !== riskFiltresi) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchAd = c.firma?.toLowerCase().includes(q);
          const matchKod = c.kodu?.toLowerCase().includes(q);
          const matchSehir = c.sehir?.toLowerCase().includes(q);
          const matchTel = c.tel1?.includes(q) || c.tel2?.includes(q);
          if (!matchAd && !matchKod && !matchSehir && !matchTel) return false;
        }
        return true;
      })
      .sort((a, b) => b.GecikmeGunSayisi - a.GecikmeGunSayisi);
  }, [cariler, riskFiltresi, searchTerm]);

  // Ekstre Çıktısı İçin (Kronolojik)
  const filtrelenmisVeYuruyenHareketler = useMemo(() => {
    if (!hareketler.length) return [];
    const sirali = [...hareketler].sort((a, b) => new Date(a.IslemTarihi).getTime() - new Date(b.IslemTarihi).getTime());
    let bakiyeAkk = 0;
    
    const bakiyeHesapli = sirali.map(h => {
      if (h.Yon === 'B') bakiyeAkk += h.IslemTutari;
      else bakiyeAkk -= h.IslemTutari;
      return { ...h, YuruyenBakiye: bakiyeAkk };
    });

    return bakiyeHesapli.filter(h => {
      const islemTarihi = h.IslemTarihi.split('T')[0];
      return islemTarihi >= startDate && islemTarihi <= endDate;
    });
  }, [hareketler, startDate, endDate]);

  const panelEkranListesi = useMemo(() => {
    return [...filtrelenmisVeYuruyenHareketler].reverse();
  }, [filtrelenmisVeYuruyenHareketler]);

  // Dinamik Genel Özet
  const genelOzet = useMemo(() => {
    let toplamMusteriAlacak = 0;
    let toplamTedarikciBorc = 0;
    let toplamGiderTutar = 0;
    let trendyolCariSayisi = 0;
    let riskliCariSayisi = 0;

    let guncelTutar = 0;
    let dikkatTutar = 0;
    let kritikTutar = 0;
    let yuksekRiskTutar = 0;

    for (const c of cariler) {
      const bakiye = c.NetBakiyeTL || 0;
      const isGider = (c.kodu || '').startsWith('770');

      if (isGider) {
        toplamGiderTutar += Math.abs(bakiye);
      } else {
        if (bakiye > 0) {
          toplamMusteriAlacak += bakiye;
          if (c.GecikmeGunSayisi > 30) riskliCariSayisi++;

          if (c.riskSeviyesi === 'GUNCEL') guncelTutar += bakiye;
          else if (c.riskSeviyesi === 'DIKKAT') dikkatTutar += bakiye;
          else if (c.riskSeviyesi === 'KRITIK') kritikTutar += bakiye;
          else yuksekRiskTutar += bakiye;
        } else if (bakiye < 0) {
          toplamTedarikciBorc += Math.abs(bakiye);
        }
      }

      if ((c.Kanali || '') === 'Trendyol' || (c.firma || '').toLowerCase().includes('trendyol')) {
        trendyolCariSayisi++;
      }
    }

    return {
      toplamMusteriAlacak,
      toplamTedarikciBorc,
      toplamGiderTutar,
      trendyolCariSayisi,
      riskliCariSayisi,
      guncelTutar,
      dikkatTutar,
      kritikTutar,
      yuksekRiskTutar,
      toplamCari: cariler.length,
      borcluCariSayisi: cariler.filter(c => !(c.kodu || '').startsWith('770') && c.NetBakiyeTL > 0).length
    };
  }, [cariler]);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
          .screen-view-area { display: none !important; }
          .print-view-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          @page { size: A4; margin: 12mm 15mm; }
          .print-row { page-break-inside: avoid !important; }
        }
      `}} />

      {/* ========================================================================= */}
      {/* EKRAN ARAYÜZÜ */}
      {/* ========================================================================= */}
      <div className="screen-view-area p-4 md:p-8 bg-slate-50 min-h-screen font-sans antialiased space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ÜST BAŞLIK & SEKME GEÇİŞİ */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={28} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                    Cari Yönetim Merkezi
                  </h1>
                  <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                    Tüm hesaplar, hesap ekstresi, borç yaşlandırma ve cari kart düzenleme
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button 
                onClick={loadCariler} 
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 font-bold transition-colors shadow-xs text-xs"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
                <span>Yenile</span>
              </button>
            </div>
          </div>

          {/* SEKME DÜĞMELERİ (TABS) */}
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('liste')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                activeTab === 'liste'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={16} />
              <span>Cari Listesi & Ekstre ({cariler.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('yaslandirma')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                activeTab === 'yaslandirma'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={16} className="text-amber-600" />
              <span>Borç Yaşlandırma & Risk ({genelOzet.borcluCariSayisi})</span>
            </button>
          </div>

          {bilgiMesaj && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in">
              <Check size={18} className="text-emerald-600 shrink-0" />
              <span>{bilgiMesaj}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEKME 1: TÜM CARİLER & EKSTRE PANELİ                                     */}
          {/* ========================================================================= */}
          {activeTab === 'liste' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* KPI Kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Toplam Alacak</p>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowDownLeft size={16}/></div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-lg font-black text-emerald-600 font-mono">{formatTRY(genelOzet.toplamMusteriAlacak)}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Bakiyesi pozitif cariler</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Toplam Borç</p>
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowUpRight size={16}/></div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-lg font-black text-rose-600 font-mono">{formatTRY(genelOzet.toplamTedarikciBorc)}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Bakiyesi negatif cariler</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Dönem Gideri</p>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={16}/></div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-lg font-black text-indigo-700 font-mono">{formatTRY(genelOzet.toplamGiderTutar)}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">770 kodlu işletme giderleri</p>
                  </div>
                </div>

                <div 
                  onClick={() => setOnlyGecikenler(!onlyGecikenler)}
                  className={`p-4 rounded-2xl shadow-xs border flex flex-col justify-between cursor-pointer transition-all select-none ${
                    onlyGecikenler 
                      ? 'bg-amber-500 border-amber-600 text-white shadow-md ring-2 ring-amber-500/20' 
                      : 'bg-white border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${onlyGecikenler ? 'text-white/90' : 'text-slate-400'}`}>Takipteki Alacaklar</p>
                    <div className={`p-2 rounded-lg ${onlyGecikenler ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
                      <AlertTriangle size={16}/>
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className={`text-lg font-black ${onlyGecikenler ? 'text-white' : 'text-amber-600'}`}>{genelOzet.riskliCariSayisi} Hesap</h3>
                    <p className={`text-[10px] mt-0.5 ${onlyGecikenler ? 'text-white/80' : 'text-slate-400'}`}>
                      {onlyGecikenler ? 'Filtre Aktif (Kapat)' : '30 günü geçen alacaklar'}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pazaryeri Dağılımı</p>
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><ShoppingBag size={16}/></div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-lg font-black text-slate-800">{genelOzet.trendyolCariSayisi} <span className="text-xs font-normal text-slate-400">/ {cariler.length}</span></h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Trendyol Carisi</p>
                  </div>
                </div>
              </div>

              {/* Filtreleme Çubuğu */}
              <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3 items-center">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Firma adı, kod, telefon veya şehir ara..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-700" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                </div>
                
                <select 
                  className="w-full md:w-auto bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 focus:outline-none" 
                  value={selectedTip} 
                  onChange={e => setSelectedTip(e.target.value)}
                >
                  <option value="">Tüm Sınıflar</option>
                  <option value="musteri">Müşteriler (120)</option>
                  <option value="tedarikci">Tedarikçiler (320)</option>
                  <option value="trendyol">Sadece Trendyol (TY)</option>
                  <option value="gider">Giderler (770)</option>
                </select>

                <select 
                  className="w-full md:w-auto bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 focus:outline-none" 
                  value={selectedSehir} 
                  onChange={e => setSelectedSehir(e.target.value)}
                >
                  <option value="">Tüm Şehirler</option>
                  <option value="Isparta">Isparta</option>
                  {sehirListesi.filter(s => s !== 'Isparta').map(sehir => (
                    <option key={sehir} value={sehir}>{sehir}</option>
                  ))}
                </select>
              </div>

              {/* Cari Tablosu */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                {loading ? (
                  <div className="p-20 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                    <p className="text-slate-400 text-xs font-semibold">Cari hesaplar yükleniyor...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-4">Hesap Kodu</th>
                          <th className="p-4">Firma / Ünvan</th>
                          <th className="p-4">İletişim</th>
                          <th className="p-4">Şehir</th>
                          <th className="p-4">Sınıfı</th>
                          <th className="p-4 text-right">Net Bakiye</th>
                          <th className="p-4 text-center">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredCariler.length > 0 ? (
                          filteredCariler.map(cari => {
                            const riskli = !(cari.kodu || '').startsWith('770') && (cari.NetBakiyeTL || 0) > 0 && Number(cari.GecikmeGunSayisi || 0) > 30;
                            
                            return (
                              <tr 
                                key={cari.id} 
                                onClick={() => handleCariSelect(cari)} 
                                className={`hover:bg-indigo-50/40 transition-colors cursor-pointer group ${riskli ? 'bg-amber-50/20' : ''}`}
                              >
                                <td className="p-4 font-mono font-bold text-slate-400">{cari.kodu}</td>
                                
                                <td className="p-4 font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span>{cari.firma}</span>
                                      {riskli && (
                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                          <AlertTriangle size={10} /> {cari.GecikmeGunSayisi} Gün Gecikme
                                        </span>
                                      )}
                                    </div>
                                    {cari.yetkili && (
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        Yetkili: {cari.yetkili}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-4 font-mono text-xs text-slate-600">
                                  {cari.tel1 || cari.tel2 ? (
                                    <span className="flex items-center gap-1">
                                      <Phone size={12} className="text-slate-400" />
                                      {cari.tel1 || cari.tel2}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 italic">Yok</span>
                                  )}
                                </td>

                                <td className="p-4 text-slate-500 font-medium">
                                  <span className="flex items-center gap-1"><MapPin size={13}/> {cari.sehir || 'BELİRTİLMEMİŞ'}</span>
                                </td>

                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wide ${cari.kodu?.startsWith('120') ? 'bg-blue-50 text-blue-700 border-blue-200' : cari.kodu?.startsWith('770') ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                    {cari.kodu?.startsWith('120') ? 'Müşteri' : cari.kodu?.startsWith('770') ? 'Gider' : 'Tedarikçi'}
                                  </span>
                                </td>

                                <td className={`p-4 text-right font-black font-mono text-sm ${cari.NetBakiyeTL > 0 && !cari.kodu?.startsWith('770') ? 'text-emerald-600' : cari.NetBakiyeTL < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {formatTRY(cari.NetBakiyeTL)}
                                </td>

                                <td className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    <button 
                                      onClick={() => handleCariSelect(cari)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                                      title="Ekstre Görüntüle"
                                    >
                                      <Eye size={15} />
                                    </button>

                                    <button
                                      onClick={(e) => handleOpenDuzenle(cari, e)}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                                      title="Cari Bilgilerini Düzenle"
                                    >
                                      <Edit3 size={15} />
                                    </button>

                                    {cari.NetBakiyeTL > 0 && !cari.kodu?.startsWith('770') && (
                                      <button
                                        onClick={(e) => handleOpenTahsilat(cari, e)}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                                        title="Tahsilat Al"
                                      >
                                        <PlusCircle size={15} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic text-xs">Cari hesap kaydı bulunamadı.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEKME 2: BORÇ YAŞLANDIRMA & RİSK TAKİBİ                                   */}
          {/* ========================================================================= */}
          {activeTab === 'yaslandirma' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Yaşlandırma KPI Kartları */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Toplam Borçlu Alacak</span>
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {formatTRY(genelOzet.toplamMusteriAlacak)}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      {genelOzet.borcluCariSayisi} Borçlu Müşteri
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setRiskFiltresi(riskFiltresi === 'GUNCEL' ? 'ALL' : 'GUNCEL')}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${riskFiltresi === 'GUNCEL' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : 'bg-white hover:border-emerald-300'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">0 - 30 Gün (Güncel)</span>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight">
                      {formatTRY(genelOzet.guncelTutar)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Normal Vade</div>
                  </div>
                </div>

                <div 
                  onClick={() => setRiskFiltresi(riskFiltresi === 'DIKKAT' ? 'ALL' : 'DIKKAT')}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${riskFiltresi === 'DIKKAT' ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white hover:border-blue-300'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">31 - 60 Gün (Dikkat)</span>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-blue-600 tracking-tight">
                      {formatTRY(genelOzet.dikkatTutar)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Vadesi Geçmiş</div>
                  </div>
                </div>

                <div 
                  onClick={() => setRiskFiltresi(riskFiltresi === 'KRITIK' ? 'ALL' : 'KRITIK')}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${riskFiltresi === 'KRITIK' ? 'ring-2 ring-amber-500 bg-amber-50/50' : 'bg-white hover:border-amber-300'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">61 - 90 Gün (Kritik)</span>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-amber-600 tracking-tight">
                      {formatTRY(genelOzet.kritikTutar)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Acil Tahsilat</div>
                  </div>
                </div>

                <div 
                  onClick={() => setRiskFiltresi(riskFiltresi === 'YUKSEK_RISK' ? 'ALL' : 'YUKSEK_RISK')}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between col-span-2 sm:col-span-1 ${riskFiltresi === 'YUKSEK_RISK' ? 'ring-2 ring-rose-500 bg-rose-50/50' : 'bg-white hover:border-rose-300'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">90+ Gün (Yüksek Risk)</span>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-rose-600 tracking-tight">
                      {formatTRY(genelOzet.yuksekRiskTutar)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Şüpheli Alacak</div>
                  </div>
                </div>
              </div>

              {/* Arama ve Filtre */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Borçlu cari adı, telefon veya şehir ara..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={riskFiltresi}
                  onChange={e => setRiskFiltresi(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 w-full sm:w-auto"
                >
                  <option value="ALL">Vade Durumu: Tümü ({borcluCariler.length})</option>
                  <option value="GUNCEL">0 - 30 Gün (Güncel)</option>
                  <option value="DIKKAT">31 - 60 Gün (Dikkat)</option>
                  <option value="KRITIK">61 - 90 Gün (Kritik)</option>
                  <option value="YUKSEK_RISK">90+ Gün (Yüksek Risk)</option>
                </select>
              </div>

              {/* Yaşlandırma Tablosu */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Cari / Müşteri</th>
                        <th className="py-3 px-3">İletişim</th>
                        <th className="py-3 px-3 text-right">Borç Tutarı</th>
                        <th className="py-3 px-3 text-center">Son İşlem</th>
                        <th className="py-3 px-3 text-center">Gecikme</th>
                        <th className="py-3 px-3 text-center">Risk</th>
                        <th className="py-3 px-4 text-center">Eylemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {borcluCariler.map(item => {
                        let riskBadge = 'bg-slate-100 text-slate-700';
                        if (item.riskSeviyesi === 'GUNCEL') riskBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        else if (item.riskSeviyesi === 'DIKKAT') riskBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                        else if (item.riskSeviyesi === 'KRITIK') riskBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                        else riskBadge = 'bg-rose-50 text-rose-700 border-rose-200';

                        const isCopied = kopyalandiId === item.id;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800 leading-tight">{item.firma}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                  {item.kodu}
                                </span>
                                {item.sehir && (
                                  <span className="text-[10px] font-semibold text-slate-400">{item.sehir}</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-xs text-slate-600">
                              {item.tel1 || item.tel2 || <span className="text-slate-300 italic">Kayıtlı Değil</span>}
                            </td>

                            <td className="py-3 px-3 text-right font-black text-rose-600 font-mono text-sm whitespace-nowrap">
                              {formatTRY(item.NetBakiyeTL)}
                            </td>

                            <td className="py-3 px-3 text-center font-mono text-xs text-slate-500 whitespace-nowrap">
                              {item.SonIslemTarihi || '-'}
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="font-bold text-slate-800">{item.GecikmeGunSayisi}</span>{' '}
                              <span className="text-[10px] text-slate-400">gün</span>
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${riskBadge}`}>
                                {item.riskSeviyesi === 'GUNCEL' && 'Güncel'}
                                {item.riskSeviyesi === 'DIKKAT' && 'Dikkat'}
                                {item.riskSeviyesi === 'KRITIK' && 'Kritik'}
                                {item.riskSeviyesi === 'YUKSEK_RISK' && 'Yüksek Risk'}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* WhatsApp */}
                                <button
                                  onClick={(e) => handleOpenWhatsApp(item, e)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                  title="WhatsApp Hatırlatma Mesajı Gönder"
                                >
                                  <MessageSquare size={14} />
                                  <span className="hidden md:inline">WhatsApp</span>
                                </button>

                                {/* Kopyala */}
                                <button
                                  onClick={(e) => handleCopyMessage(item, e)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                  title="Mesaj metnini panoya kopyala"
                                >
                                  {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                </button>

                                {/* Hızlı Tahsilat */}
                                <button
                                  onClick={(e) => handleOpenTahsilat(item, e)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                  title="Bu cariden tahsilat al"
                                >
                                  <PlusCircle size={14} />
                                  <span className="hidden md:inline">Tahsilat</span>
                                </button>

                                {/* Ekstre */}
                                <button
                                  onClick={() => handleCariSelect(item)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                  title="Ekstre İncele"
                                >
                                  <Eye size={14} />
                                </button>

                                {/* Düzenle */}
                                <button
                                  onClick={(e) => handleOpenDuzenle(item, e)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg"
                                  title="İletişim / Cari Bilgilerini Güncelle"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-500 flex items-center justify-between">
                  <span>Listelenen Borçlu Cari: {borcluCariler.length}</span>
                  <span>Ezm Oto Cari Risk Motoru</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SAĞDAN AÇILIR EKSTRE ÇEKMECESİ                                            */}
          {/* ========================================================================= */}
          {selectedCari && (
            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
              <div className="absolute inset-0" onClick={() => setSelectedCari(null)} />
              
              <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <span className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">{selectedCari.kodu}</span>
                    <h2 className="text-lg font-black text-slate-800 mt-1">{selectedCari.firma}</h2>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin size={12} /> {selectedCari.sehir || 'BELİRTİLMEMİŞ'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => window.print()} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      <FileText size={14} /> Ekstre Yazdır
                    </button>
                    <button onClick={() => setSelectedCari(null)} className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Başlangıç ve Bitiş Tarih Seçicileri */}
                <div className="p-4 bg-slate-100/60 border-b border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Başlangıç Tarihi</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Bitiş Tarihi</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30">
                  {detailLoading ? (
                    <div className="h-40 flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-600 mb-2" size={24} />
                      <p className="text-slate-400 text-xs">Mali kayıtlar okunuyor...</p>
                    </div>
                  ) : panelEkranListesi.length > 0 ? (
                    panelEkranListesi.map((h, index) => (
                      <div key={`${h.IslemNo}-${index}`} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="p-4 flex justify-between items-center">
                          <div onClick={() => toggleIslemDetay(h.IslemNo)} className="flex items-center gap-3 cursor-pointer flex-1 py-1">
                            <div className={`p-2 rounded-lg ${h.Yon === 'B' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-700">{h.IslemTipi} (No: {h.BelgeNo})</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(h.IslemTarihi).toLocaleDateString('tr-TR')} <span className="font-bold ml-1 text-slate-500">[{h.Yon === 'B' ? 'BORÇ' : 'ALACAK'}]</span></p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-2">
                            <span className={`text-sm font-mono font-black ${h.Yon === 'A' ? 'text-emerald-600' : 'text-slate-800'}`}>
                              {h.Yon === 'A' ? `- ${formatTRY(h.IslemTutari)}` : formatTRY(h.IslemTutari)}
                            </span>
                            <Link href={`/fatura/${h.IslemNo}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 rounded">
                              <ExternalLink size={14} />
                            </Link>
                            <button onClick={() => toggleIslemDetay(h.IslemNo)} className="p-1 text-slate-400 hover:text-slate-600">
                              {expandedIslem === h.IslemNo ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                            </button>
                          </div>
                        </div>

                        {expandedIslem === h.IslemNo && (
                          <div className="bg-slate-50/50 px-4 py-2 divide-y divide-slate-100 text-xs border-t">
                            {urunLoading ? (
                              <div className="py-4 text-center text-slate-400">
                                <Loader2 size={14} className="animate-spin inline mr-2"/> Detaylar getiriliyor...
                              </div>
                            ) : urunler.length > 0 ? (
                              urunler.map((u) => (
                                <div key={u.satirId} className="py-2.5 flex justify-between items-start gap-2">
                                  <div>
                                    <p className="font-bold text-slate-800">{u.urunAdi}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Kod: {u.stokKodu} | {u.miktar} {u.birim} x {formatTRY(u.birimFiyat)}</p>
                                  </div>
                                  <span className="font-mono font-bold text-slate-600 bg-white px-2 py-0.5 border border-slate-100 rounded">
                                    {formatTRY(u.satirTutari)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="py-4 text-center text-slate-400 italic">Alt hareket kaydı bulunamadı.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-slate-400 italic text-xs">Seçili tarih aralığında hareket kaydı bulunamadı.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CARİ DÜZENLEME MODALI                                                     */}
          {/* ========================================================================= */}
          {duzenleModalOpen && duzenlenecekCari && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Cari Kart Bilgileri</span>
                    <h3 className="text-sm font-black text-slate-800">{duzenlenecekCari.firma}</h3>
                  </div>
                  <button 
                    onClick={() => setDuzenleModalOpen(false)}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveCari} className="p-5 space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Yetkili Kişi
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.yetkili}
                        onChange={e => setDuzenleForm({ ...duzenleForm, yetkili: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="Örn: Ahmet Yılmaz"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Şehir
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.sehir}
                        onChange={e => setDuzenleForm({ ...duzenleForm, sehir: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="Örn: Isparta"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Telefon 1 (WhatsApp)
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.tel1}
                        onChange={e => setDuzenleForm({ ...duzenleForm, tel1: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="0532..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Telefon 2
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.tel2}
                        onChange={e => setDuzenleForm({ ...duzenleForm, tel2: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="0246..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      E-Posta Adresi
                    </label>
                    <input
                      type="email"
                      value={duzenleForm.email}
                      onChange={e => setDuzenleForm({ ...duzenleForm, email: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                      placeholder="ornek@firma.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Vergi Dairesi
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.vergidairesi}
                        onChange={e => setDuzenleForm({ ...duzenleForm, vergidairesi: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Vergi No / TC
                      </label>
                      <input
                        type="text"
                        value={duzenleForm.vergino}
                        onChange={e => setDuzenleForm({ ...duzenleForm, vergino: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Açık Adres
                    </label>
                    <textarea
                      rows={2}
                      value={duzenleForm.adresi}
                      onChange={e => setDuzenleForm({ ...duzenleForm, adresi: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500"
                      placeholder="Cadde, sokak, mahalle..."
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDuzenleModalOpen(false)}
                      className="flex-1 p-2.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 rounded-xl uppercase tracking-wider"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCari}
                      className="flex-1 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-black text-white rounded-xl uppercase tracking-wider shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} />
                      <span>{isSavingCari ? 'Kaydediliyor...' : 'Onelee’ye Kaydet'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HIZLI TAHSİLAT MODALI                                                     */}
          {/* ========================================================================= */}
          {tahsilatModalOpen && tahsilatCari && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Hızlı Tahsilat</span>
                    <h3 className="text-sm font-black text-slate-800">{tahsilatCari.firma}</h3>
                  </div>
                  <button 
                    onClick={() => setTahsilatModalOpen(false)}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleTahsilatKaydet} className="p-5 space-y-4 text-xs">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Toplam Açık Borç</span>
                    <span className="text-base font-black text-rose-600 font-mono">
                      {formatTRY(tahsilatCari.NetBakiyeTL)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Tahsilat Yapılan Kasa / POS
                    </label>
                    <select
                      value={tahsilatKasaId}
                      onChange={e => setTahsilatKasaId(parseInt(e.target.value))}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500 bg-white"
                    >
                      {kasalar.map(k => (
                        <option key={k.kasaid} value={k.kasaid}>
                          {k.kasa_ack} ({formatTRY(k.BK_TL)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Tahsil Edilen Tutar (TL)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tahsilatTutar}
                      onChange={e => setTahsilatTutar(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-sm"
                      required
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTahsilatModalOpen(false)}
                      disabled={tahsilatIslemde}
                      className="flex-1 p-2.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 rounded-xl uppercase tracking-wider"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={tahsilatIslemde}
                      className="flex-1 p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-black text-white rounded-xl uppercase tracking-wider shadow-xs"
                    >
                      {tahsilatIslemde ? 'İşleniyor...' : 'Tahsilatı Onayla'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* YAZICI EKSTRE ŞABLONU (A4 PRINT)                                          */}
      {/* ========================================================================= */}
      {selectedCari && (
        <div className="print-view-area hidden w-full text-black bg-white p-0 m-0 font-sans">
          <div className="border border-slate-400 rounded p-3 mb-3 bg-white text-[10px]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-slate-400 uppercase tracking-wider font-bold text-[8px]">Cari Hesap Bilgileri</div>
                <div className="text-sm font-black text-slate-950 leading-tight">{selectedCari.firma}</div>
                <div className="flex gap-4 text-slate-700 mt-1">
                  <div><span className="font-semibold text-slate-500">Hesap Kodu:</span> <span className="font-mono font-bold">{selectedCari.kodu}</span></div>
                  <div><span className="font-semibold text-slate-500">Şehir:</span> <span className="font-bold uppercase">{selectedCari.sehir || 'BELİRTİLMEMİŞ'}</span></div>
                </div>
              </div>

              <div className="flex flex-col justify-between items-end text-right">
                <div>
                  <div className="text-slate-400 uppercase tracking-wider font-bold text-[8px]">Rapor Detayları</div>
                  <div className="font-bold text-slate-950 mt-0.5">CARİ HESAP EKSTRESİ</div>
                </div>
                <div className="text-[9px] text-slate-700 space-y-0.5">
                  <div><span className="text-slate-500 font-medium">Ekstre Dönemi:</span> <span className="font-mono font-bold">{formatDateString(startDate)} - {formatDateString(endDate)}</span></div>
                  <div><span className="text-slate-500 font-medium">Oluşturma Tarihi:</span> <span className="font-mono font-medium">{new Date().toLocaleDateString('tr-TR')}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-400 bg-slate-50 px-3 py-1.5 rounded mb-3 flex justify-between items-center text-[10px]">
            <span className="font-black text-slate-800 uppercase tracking-wide">MEVCUT GÜNCEL NET BAKİYE:</span>
            <span className="text-sm font-sans font-black text-slate-950 tracking-tight">
              {formatTRY(selectedCari.NetBakiyeTL)}
            </span>
          </div>

          <div className="border border-slate-400 rounded overflow-hidden">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 text-slate-800 font-bold">
                  <th className="p-1.5 w-20 border-r border-slate-300">İşlem Tarihi</th>
                  <th className="p-1.5 border-r border-slate-300">İşlem Tipi / Belge No</th>
                  <th className="p-1.5 text-right w-24 border-r border-slate-300">Borç (B)</th>
                  <th className="p-1.5 text-right w-24 border-r border-slate-300">Alacak (A)</th>
                  <th className="p-1.5 text-right w-26">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filtrelenmisVeYuruyenHareketler.map((h, index) => (
                  <tr key={`print-row-${index}`} className="bg-white print-row">
                    <td className="p-1.5 font-mono text-slate-700 border-r border-slate-200">
                      {new Date(h.IslemTarihi).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="p-1.5 font-semibold text-slate-950 border-r border-slate-200">
                      {h.IslemTipi} <span className="text-slate-500 font-normal text-[9px]">(No: {h.BelgeNo})</span>
                    </td>
                    <td className="p-1.5 text-right font-sans text-slate-950 border-r border-slate-200">
                      {h.Yon === 'B' ? formatTRY(h.IslemTutari) : '0,00 ₺'}
                    </td>
                    <td className="p-1.5 text-right font-sans text-slate-950 border-r border-slate-200">
                      {h.Yon === 'A' ? formatTRY(h.IslemTutari) : '0,00 ₺'}
                    </td>
                    <td className={`p-1.5 text-right font-sans font-bold tracking-wide whitespace-nowrap ${h.YuruyenBakiye > 0 ? 'text-blue-800' : h.YuruyenBakiye < 0 ? 'text-rose-800' : 'text-slate-950'}`}>
                      {formatTRY(h.YuruyenBakiye)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center text-[8px] text-slate-400 mt-5 border-t border-slate-300 pt-1.5">
            Bu ekstre cari hesap bilgilendirme amaçlı sistem üzerinden otomatik üretilmiştir. Mali değeri yoktur.
          </div>
        </div>
      )}
    </>
  );
}

export default function CariYonetimMerkezi() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="font-medium text-slate-300">Cari Yönetim Merkezi yükleniyor...</span>
        </div>
      }
    >
      <CariYonetimMerkeziContent />
    </Suspense>
  );
}