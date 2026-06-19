'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, AlertTriangle, ShoppingBag, MapPin, 
  ArrowUpRight, ArrowDownLeft, Search, Loader2, RefreshCw, X, Eye, FileText, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

interface ViewCari {
  id: number;
  kodu: string;
  firma: string;
  sehir: string;
  odemesekli: string;
  vade: number;
  CariTipi: string;
  NetBakiyeTL: number;
  BakiyeDurumu: string;
  KayitTarihi: string;
  SonIslemTarihi: string;
  Kanali: string;
  GecikmeGunSayisi: number;
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

export default function CariRaporPaneli() {
  const [cariler, setCariler] = useState<ViewCari[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTip, setSelectedTip] = useState('');
  const [selectedSehir, setSelectedSehir] = useState('');
  const [onlyGecikenler, setOnlyGecikenler] = useState(false);
  
// Tarihleri YYYY-MM-DD formatına çeviren küçük bir yardımcı fonksiyon
const getFormattedDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Statik değerler yerine hafızada dinamik olarak hesaplanan tarihler
const bugun = new Date(); // 2026-06-18
const ayinIlkGunu = new Date(bugun.getFullYear(), bugun.getMonth(), 1); // 2026-06-01
let gecikengun = 30; //Geciken gün limiti
// State Yapısı (Artık Tamamen Dinamik)
const [startDate, setStartDate] = useState(getFormattedDate(ayinIlkGunu));
const [endDate, setEndDate] = useState(getFormattedDate(bugun));

  // Detay & Akordeon State Yönetimi
  const [selectedCari, setSelectedCari] = useState<ViewCari | null>(null);
  const [hareketler, setHareketler] = useState<CariHareket[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedIslem, setExpandedIslem] = useState<number | null>(null);
  const [urunler, setUrunler] = useState<any[]>([]);
  const [urunLoading, setUrunLoading] = useState(false);

  const loadCariAnaliz = () => {
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
    loadCariAnaliz();
  }, [selectedTip]);

  useEffect(() => {
    document.body.style.overflow = selectedCari ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedCari]);

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

  const formatTRY = (value: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  const sehirListesi = useMemo(() => {
    return Array.from(new Set(cariler.map(c => c.sehir?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [cariler]);

  const filteredCariler = useMemo(() => {
    const sTerm = searchTerm.toLowerCase().trim();
    return cariler.filter(c => {
      const isCariRiskli = !(c.kodu || '').startsWith('770') && (c.NetBakiyeTL || 0) > 0 && Number(c.GecikmeGunSayisi || 0) > gecikengun;
      const aramaRiskliTetiklendi = (sTerm === 'risk' || sTerm === 'geciken' || sTerm === 'vade') && isCariRiskli;

      const matchesSearch = !sTerm || (
        (c.firma?.toLowerCase() || '').includes(sTerm) ||
        (c.kodu || '').toLowerCase().includes(sTerm) ||
        (sTerm === 'trendyol' && c.Kanali?.toLowerCase() === 'trendyol') ||
        aramaRiskliTetiklendi
      );
      
      const matchesSehir = !selectedSehir || c.sehir === selectedSehir;
      const matchesGecikme = !onlyGecikenler || isCariRiskli;

      return matchesSearch && matchesSehir && matchesGecikme;
    });
  }, [cariler, searchTerm, selectedSehir, onlyGecikenler]);

  // ÇIKTI İÇİN: Eskiden Yeniye (Kronolojik Bakiye Hesabı)
  const filtrelenmisVeYuruyenHareketler = useMemo(() => {
    if (!hareketler.length) return [];

    const sirali = [...hareketler].sort((a, b) => new Date(a.IslemTarihi).getTime() - new Date(b.IslemTarihi).getTime());

    let bakiyeAkk = 0;
    
    const bakiyeHesapli = sirali.map(h => {
      if (h.Yon === 'B') {
        bakiyeAkk += h.IslemTutari;
      } else {
        bakiyeAkk -= h.IslemTutari;
      }
      return { ...h, YuruyenBakiye: bakiyeAkk };
    });

    return bakiyeHesapli.filter(h => {
      const islemTarihi = h.IslemTarihi.split('T')[0];
      return islemTarihi >= startDate && islemTarihi <= endDate;
    });
  }, [hareketler, startDate, endDate]);

  // PANEL EKRANI İÇİN: Yeniden Eskiye Sıralama (En son işlem en üstte)
  const panelEkranListesi = useMemo(() => {
    return [...filtrelenmisVeYuruyenHareketler].reverse();
  }, [filtrelenmisVeYuruyenHareketler]);

  const dinamikOzet = useMemo(() => {
    let toplamMusteriAlacak = 0;
    let toplamTedarikciBorc = 0;
    let toplamGiderTutar = 0;
    let trendyolCariSayisi = 0;
    let riskliCariSayisi = 0;


    for (let i = 0; i < filteredCariler.length; i++) {
      const c = filteredCariler[i];
      const bakiye = c.NetBakiyeTL || 0;
      const kod = c.kodu || '';
      const isGider = kod.startsWith('770');

      if (isGider) {
        toplamGiderTutar += Math.abs(bakiye);
      } else {
        if (bakiye > 0) {
          toplamMusteriAlacak += bakiye;
          if (Number(c.GecikmeGunSayisi || 0) > gecikengun) {
            riskliCariSayisi++;
          }
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
      toplamCariKayıt: filteredCariler.length
    };
  }, [filteredCariler]);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
          .screen-view-area {
            display: none !important;
          }
          .print-view-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          .print-row {
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* ========================================================================= */}
      {/* 1. BÖLÜM: EKRAN ARAYÜZÜ */}
      {/* ========================================================================= */}
      <div className="screen-view-area p-4 md:p-8 bg-slate-50 min-h-screen font-sans antialiased">
        <div className="max-w-7xl mx-auto">
          
          {/* Üst Başlık */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                <Users className="text-indigo-600" size={32} />
                Cari İşlem & Rapor Merkezi
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">İşlem Bazlı Listeleme ve Dinamik Fatura Detay Mimarisi</p>
            </div>
            <button onClick={loadCariAnaliz} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold transition-colors shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <RefreshCw size={16} /> Güncelle
            </button>
          </div>

          {/* KPI Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Toplam Alacak</p>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowDownLeft size={16}/></div>
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-black text-emerald-600 font-mono">{formatTRY(dinamikOzet.toplamMusteriAlacak)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Bakiyesi pozitif olan tüm cariler</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Toplam Borç</p>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowUpRight size={16}/></div>
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-black text-rose-600 font-mono">{formatTRY(dinamikOzet.toplamTedarikciBorc)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Bakiyesi negatif olan tüm cariler</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between bg-gradient-to-b from-white to-slate-50/50">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Toplam Dönem Gideri</p>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={16}/></div>
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-black text-indigo-700 font-mono">{formatTRY(dinamikOzet.toplamGiderTutar)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">770 kodlu işletme harcamaları</p>
              </div>
            </div>

            <div 
              onClick={() => setOnlyGecikenler(!onlyGecikenler)}
              className={`p-4 rounded-xl shadow-sm border flex flex-col justify-between cursor-pointer transition-all select-none ${
                onlyGecikenler 
                  ? 'bg-amber-500 border-amber-600 text-white shadow-md ring-2 ring-amber-500/20 scale-[1.02]' 
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
                <h3 className={`text-lg font-black ${onlyGecikenler ? 'text-white' : 'text-amber-600'}`}>{dinamikOzet.riskliCariSayisi} Hesap</h3>
                <p className={`text-[10px] mt-0.5 ${onlyGecikenler ? 'text-white/80' : 'text-slate-400'}`}>
                  {onlyGecikenler ? 'Filtre Aktif (Kapat)' : 'Gecikmesi 30 günü geçenler'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pazaryeri Dağılımı</p>
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><ShoppingBag size={16}/></div>
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-black text-slate-800">{dinamikOzet.trendyolCariSayisi} <span className="text-xs font-normal text-slate-400">/ {filteredCariler.length}</span></h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Trendyol / Filtrelenmiş</p>
              </div>
            </div>
          </div>

          {/* Filtreleme Alanı */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input type="text" placeholder="Firma adı, hesap kodu veya 'trendyol' ile filtrele..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
            <select className="w-full md:w-auto bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-600 focus:outline-none" value={selectedTip} onChange={e => setSelectedTip(e.target.value)}>
              <option value="">Tüm Sınıflar</option>
              <option value="musteri">Müşteriler (120)</option>
              <option value="tedarikci">Tedarikçiler (320)</option>
              <option value="trendyol">Sadece Trendyol (TY)</option>
              <option value="gider">Giderler (770)</option>
            </select>

            <select className="w-full md:w-auto bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-600 focus:outline-none" value={selectedSehir} onChange={e => setSelectedSehir(e.target.value)}>
              <option value="">Tüm Şehirler</option>
              <option value="Isparta">Isparta</option>
              {sehirListesi.filter(s => s !== 'Isparta').map(sehir => (
                <option key={sehir} value={sehir}>{sehir}</option>
              ))}
            </select>
          </div>

          {/* Data Tablosu */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                <p className="text-slate-400 text-xs font-semibold">Veriler yükleniyor...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Hesap Kodu</th>
                      <th className="p-4">Firma / Ünvan</th>
                      <th className="p-4">Şehir</th>
                      <th className="p-4">Sınıfı</th>
                      <th className="p-4 text-right">Net Bakiye</th>
                      <th className="p-4 text-center">İncele</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredCariler.length > 0 ? (
                      filteredCariler.map(cari => {
                        const riskli = !(cari.kodu || '').startsWith('770') && (cari.NetBakiyeTL || 0) > 0 && Number(cari.GecikmeGunSayisi || 0) > gecikengun;
                        
                        return (
                          <tr key={cari.id} onClick={() => handleCariSelect(cari)} className={`hover:bg-indigo-50/40 transition-colors cursor-pointer group ${riskli ? 'bg-amber-50/20' : ''}`}>
                            <td className="p-4 font-mono text-xs text-slate-400 font-bold">{cari.kodu}</td>
                            <td className="p-4 font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{cari.firma}</span>
                                  {riskli && (
                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      <AlertTriangle size={10} /> Geciken Tahsilat ({cari.GecikmeGunSayisi} Gün)
                                    </span>
                                  )}
                                </div>
                                {(cari.Kanali === 'Trendyol' || cari.firma?.toLowerCase().includes('trendyol')) && (
                                  <span className="w-fit bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Trendyol Pazaryeri
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-xs text-slate-500 font-medium">
                              <span className="flex items-center gap-1"><MapPin size={13}/> {cari.sehir || 'BELİRTİLMEMİŞ'}</span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wide ${cari.kodu?.startsWith('120') ? 'bg-blue-50 text-blue-700 border-blue-200' : cari.kodu?.startsWith('770') ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                {cari.kodu?.startsWith('120') ? 'Müşteri' : cari.kodu?.startsWith('770') ? 'Gider' : 'Tedarikçi'}
                              </span>
                            </td>
                            <td className={`p-4 text-right font-black font-mono ${cari.NetBakiyeTL > 0 && !cari.kodu?.startsWith('770') ? 'text-emerald-600' : cari.NetBakiyeTL < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                              {formatTRY(cari.NetBakiyeTL)}
                            </td>
                            <td className="p-4 text-center">
                              <button className="p-1 text-slate-400 group-hover:text-indigo-600 hover:bg-white rounded border border-transparent group-hover:border-slate-200 transition-all">
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic text-xs">Cari hesap kaydı bulunamadı.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sağdan Açılır Panel */}
          {selectedCari && (
            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => setSelectedCari(null)} />
              
              <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10">
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
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
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

        </div>
      </div>


      {/* ========================================================================= */}
      {/* 2. BÖLÜM: YAZICI AREA (YENİLENMİŞ VE DERLİ TOPLU ÜST BAŞLIK)             */}
      {/* ========================================================================= */}
      {selectedCari && (
        <div className="print-view-area hidden w-full text-black bg-white p-0 m-0 font-sans">
          
          {/* Kurumsal ve Derli Toplu Üst Bilgi Izgarası */}
          <div className="border border-slate-400 rounded p-3 mb-3 bg-white text-[10px]">
            <div className="grid grid-cols-2 gap-4">
              {/* Sol Taraf: Cari Hesap Kartı Bilgileri */}
              <div className="space-y-1">
                <div className="text-slate-400 uppercase tracking-wider font-bold text-[8px]">Cari Hesap Bilgileri</div>
                <div className="text-sm font-black text-slate-950 leading-tight">{selectedCari.firma}</div>
                <div className="flex gap-4 text-slate-700 mt-1">
                  <div><span className="font-semibold text-slate-500">Hesap Kodu:</span> <span className="font-mono font-bold">{selectedCari.kodu}</span></div>
                  <div><span className="font-semibold text-slate-500">Şehir:</span> <span className="font-bold uppercase">{selectedCari.sehir || 'BELİRTİLMEMİŞ'}</span></div>
                </div>
              </div>

              {/* Sağ Taraf: Belge Mali Parametreleri */}
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

          {/* Güncel Net Bakiye Bilgisi */}
          <div className="border border-slate-400 bg-slate-50 px-3 py-1.5 rounded mb-3 flex justify-between items-center text-[10px]">
            <span className="font-black text-slate-800 uppercase tracking-wide">MEVCUT GÜNCEL NET BAKİYE:</span>
            <span className="text-sm font-sans font-black text-slate-950 tracking-tight">
              {formatTRY(selectedCari.NetBakiyeTL)}
            </span>
          </div>

          {/* Hareket Tablosu (Kronolojik Akış Korundu) */}
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

          {/* Alt Bilgi */}
          <div className="text-center text-[8px] text-slate-400 mt-5 border-t border-slate-300 pt-1.5">
            Bu ekstre cari hesap bilgilendirme amaçlı sistem üzerinden otomatik üretilmiştir. Mali değeri yoktur.
          </div>

        </div>
      )}
    </>
  );
}