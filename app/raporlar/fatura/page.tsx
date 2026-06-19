'use client';
import { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { 
  ChevronDown, ChevronUp, Loader2, FileText, 
  ArrowLeftRight, Package, Calendar, Search, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

interface Fatura {
  Id: string;
  IslemNo: number;
  CariAdi: string;
  IslemTipi: string;
  Tarih: string;
  ToplamTutar: number;
  IslemNotu: string;
  BelgeNo: string;
}

interface FaturaDetay {
  satirId: number;
  urunAdi: string;
  stokKodu: string;
  miktar: number;
  birimFiyat: number;
  kdvOrani: number;
  kdvTutari: number;
  kdvDahilBirimFiyat: number;
  satirTutari: number;
  birim: string;
  isErrorRow?: boolean;
}

// Tarih ve Para Birimi Formatlayıcıları
const currencyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return dateStr; }
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const distanceFromMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceFromMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

export default function FaturaPaneli() {
  const weekRange = useMemo(() => getCurrentWeekRange(), []);

  const [faturalar, setFaturalar] = useState<Fatura[]>([]);
  const [detaylar, setDetaylar] = useState<Record<string, FaturaDetay[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detayLoading, setDetayLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>(weekRange.start);
  const [endDate, setEndDate] = useState<string>(weekRange.end);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const fetchData = (start?: string, end?: string) => {
    setLoading(true);
    setError(null);
    // NOT: Ana fatura listesini çektiğin API endpoint'inin doğruluğundan emin ol.
    let url = '/api/faturalar'; 
    const params = new URLSearchParams();
    
    if (start) params.append('baslangic', start);
    if (end) params.append('bitis', end);
    if (params.toString()) url += `?${params.toString()}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Sunucu hatası oluştu.');
        return res.json();
      })
      .then(data => {
        setFaturalar(Array.isArray(data) ? data : (data.cariler || []));
        setLoading(false);
      })
      .catch(() => {
        setError('Faturalar yüklenemedi. Veritabanı bağlantısını veya API servislerini kontrol edin.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData(weekRange.start, weekRange.end);
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => controller.abort());
    };
  }, [weekRange]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(startDate, endDate);
  };

  const handleResetFilters = () => {
    const freshWeek = getCurrentWeekRange();
    setStartDate(freshWeek.start);
    setEndDate(freshWeek.end);
    setSearchTerm('');
    fetchData(freshWeek.start, freshWeek.end);
  };

  const toggleDetay = async (uniqueId: string, islemNo: number, islemTipi: string) => {
    if (expandedId === uniqueId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(uniqueId);

    if (abortControllersRef.current[uniqueId]) {
      abortControllersRef.current[uniqueId].abort();
    }

    const controller = new AbortController();
    abortControllersRef.current[uniqueId] = controller;

    if (!detaylar[uniqueId] || detaylar[uniqueId][0]?.isErrorRow) {
      setDetayLoading(prev => ({ ...prev, [uniqueId]: true }));
      try {
        // 🌟 DÜZELTME: API rotasına doğru islemNo query parametresi gönderiliyor
        const res = await fetch(`/api/cariler?islemNo=${islemNo}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`API Hatası (Durum: ${res.status})`);
        const result = await res.json();
        
        // 🌟 DÜZELTME: API'den dönen { success: true, data: { satirlar: [...] } } yapısı çözümleniyor
        if (result.success && result.data && Array.isArray(result.data.satirlar)) {
          setDetaylar(prev => ({ ...prev, [uniqueId]: result.data.satirlar }));
        } else {
          setDetaylar(prev => ({ ...prev, [uniqueId]: [] }));
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; 
        
        setDetaylar(prev => ({ 
          ...prev, 
          [uniqueId]: [{
            satirId: 0,
            urunAdi: 'SQL Sorgu veya Bağlantı Hatası! Backend terminal loglarını kontrol edin.',
            stokKodu: 'HATA_500', miktar: 0, birimFiyat: 0, kdvOrani: 0, kdvTutari: 0, kdvDahilBirimFiyat: 0, satirTutari: 0, birim: '-', isErrorRow: true
          }] 
        }));
      } finally {
        setDetayLoading(prev => ({ ...prev, [uniqueId]: false }));
        delete abortControllersRef.current[uniqueId];
      }
    }
  };

  const filteredFaturalar = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return faturalar;

    return faturalar.filter(fatura => 
      fatura.CariAdi?.toLowerCase().includes(searchLower) ||
      fatura.BelgeNo?.toLowerCase().includes(searchLower) ||
      fatura.IslemNo?.toString().includes(searchLower) ||
      fatura.IslemTipi?.toLowerCase().includes(searchLower)
    );
  }, [faturalar, searchTerm]);

  const maliOzet = useMemo(() => {
    let nakitGiris = 0;
    let nakitCikis = 0;
    let satisCirosu = 0;
    let alimYuku = 0;
    let faturaAdet = 0;
    let kasaAdet = 0;

    filteredFaturalar.forEach(f => {
      const tip = f.IslemTipi?.toLocaleUpperCase('tr-TR').trim() || '';
      const tutar = Number(f.ToplamTutar || 0);

      if (['SF', 'PS', 'WBS', 'SÖSA'].includes(tip) || tip.includes('SATIŞ') || tip.includes('SATIS')) {
        satisCirosu += tutar;
        faturaAdet++;
      }
      else if (['PSI', 'MTAİ'].includes(tip) || tip.includes('İADE') || tip.includes('IADE')) {
        satisCirosu -= tutar; 
        faturaAdet++;
      }
      else if (['AF', 'MG'].includes(tip) || tip.includes('ALIM')) {
        alimYuku += tutar;
        faturaAdet++;
      }
      else if (['NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT'].includes(tip) || tip.includes('TAHSİLAT') || tip.includes('TAHSILAT')) {
        nakitGiris += tutar;
        kasaAdet++;
      }
      else if (['NÖ', 'GIDHE', 'KKO', 'MTEİ', 'BTE', 'KKTED', 'KÖ'].includes(tip) || tip.includes('ÖDEME') || tip.includes('ODEME') || tip.includes('TEDİYE')) {
        nakitCikis += tutar;
        kasaAdet++;
      }
      else if (['VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC'].includes(tip) || tip.includes('VİRMAN') || tip.includes('VIRMAN')) {
        kasaAdet++;
      }
    });

    return { 
      nakitGiris, 
      nakitCikis, 
      netKasa: nakitGiris - nakitCikis,
      satisCirosu,
      alimYuku,
      ticariBakiye: satisCirosu - alimYuku,
      faturaAdet,
      kasaAdet
    };
  }, [filteredFaturalar]);

  const getBadgeStyle = (islemTipi: string) => {
    const tip = islemTipi?.toLocaleUpperCase('tr-TR').trim() || '';
    if (['SF', 'PS', 'WBS', 'SÖSA'].includes(tip) || tip.includes('SATIŞ')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (['NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT'].includes(tip) || tip.includes('TAHSİLAT')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (['AF', 'MG'].includes(tip) || (tip.includes('ALIM') && !tip.includes('İADE'))) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (['NÖ', 'GIDHE', 'KKO', 'BTE', 'KKTED', 'KÖ', 'MTEİ'].includes(tip) || tip.includes('ÖDEME') || tip.includes('TEDİYE')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (['PSI', 'MTAİ'].includes(tip) || tip.includes('İADE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (['VRM', 'VRMC', 'BÇ', 'BY', 'MSF', 'DG', 'DC'].includes(tip) || tip.includes('VİRMAN')) return 'bg-slate-100 text-slate-700 border-slate-300';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getTutarColorClass = (islemTipi: string) => {
    const tip = islemTipi?.toLocaleUpperCase('tr-TR').trim() || '';
    if (['AF', 'MG'].includes(tip) || tip.includes('ALIM') || ['NÖ', 'GIDHE', 'KKO', 'BTE', 'KKTED', 'KÖ', 'MTEİ'].includes(tip) || tip.includes('ÖDEME') || tip.includes('TEDİYE')) {
      return 'text-rose-600';
    }
    if (['SF', 'PS', 'WBS', 'SÖSA'].includes(tip) || tip.includes('SATIŞ') || ['NT', 'GELHE', 'KKT', 'BTA', 'TT', 'KT'].includes(tip) || tip.includes('TAHSİLAT')) {
      return 'text-emerald-600';
    }
    return 'text-slate-900';
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Üst Başlık */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <FileText className="text-blue-600" size={32} />
              Fatura ve Finans Yönetim Paneli
            </h1>
            <p className="text-slate-500 text-sm mt-1">İşlem ve Stok Hareketleri Akıllı Raporlama Ekranı</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-medium">
            <span className="shrink-0 bg-rose-100 p-1.5 rounded-md">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${maliOzet.netKasa >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <DollarSign size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Net Kasa Durumu</p>
                <h3 className={`text-lg font-black ${maliOzet.netKasa >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(maliOzet.netKasa)}
                </h3>
              </div>
            </div>
            <div className="border-t border-slate-100 mt-3 pt-2 flex justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-0.5 text-emerald-600"><ArrowDownLeft size={12}/> Giriş: {formatCurrency(maliOzet.nakitGiris)}</span>
              <span className="flex items-center gap-0.5 text-rose-600"><ArrowUpRight size={12}/> Çıkış: {formatCurrency(maliOzet.nakitCikis)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Toplam Satış Cirosu</p>
                <h3 className="text-lg font-bold text-blue-700">{formatCurrency(maliOzet.satisCirosu)}</h3>
              </div>
            </div>
            <div className="border-t border-slate-100 mt-3 pt-2 text-[11px] text-slate-400 font-normal">
              Faturalandırılmış net ticari teslimatlar
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <TrendingDown size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Mal / Stok Alımları</p>
                <h3 className="text-lg font-bold text-slate-800">{formatCurrency(maliOzet.alimYuku)}</h3>
              </div>
            </div>
            <div className="border-t border-slate-100 mt-3 pt-2 text-[11px] text-slate-400 font-normal flex justify-between">
              <span>Tedarikçi borç yükü</span>
              <span className={`font-mono font-bold ${maliOzet.ticariBakiye >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Denge: {formatCurrency(maliOzet.ticariBakiye)}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                <FileText size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">İşlem Trafiği</p>
                <h3 className="text-lg font-bold text-slate-900">{filteredFaturalar.length} Kayıt</h3>
              </div>
            </div>
            <div className="border-t border-slate-100 mt-3 pt-2 flex justify-between text-[11px] text-slate-500 font-medium">
              <span>{maliOzet.faturaAdet} Fatura Belgesi</span>
              <span>{maliOzet.kasaAdet} Kasa/Virman</span>
            </div>
          </div>
        </div>

        {/* Filtreleme ve Arama Modülü */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
          <form onSubmit={handleFilterSubmit} className="flex flex-col lg:flex-row items-end gap-3">
            <div className="w-full lg:flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                <Search size={12} /> Akıllı Arama
              </label>
              <input 
                type="text"
                placeholder="Cari ünvanı, belge numarası veya işlem tipi yazın..."
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> Başlangıç
              </label>
              <input 
                type="date"
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> Bitiş
              </label>
              <input 
                type="date"
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <button type="submit" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors shadow-sm">
                Sorgula
              </button>
              <button type="button" onClick={handleResetFilters} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-sm px-4 py-2 rounded-lg transition-colors">
                Temizle
              </button>
            </div>
          </form>
        </div>

        {/* Ana Fatura Tablosu */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20">
              <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
              <p className="text-slate-400 text-xs font-medium">Finansal kayıtlar işleniyor...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="p-4 w-12 text-center"></th>
                    <th className="p-4 w-24">İşlem No</th>
                    <th className="p-4 w-40">Fatura/Belge No</th>
                    <th className="p-4">Cari Ünvanı / Açıklama</th>
                    <th className="p-4 w-44">İşlem Tipi</th>
                    <th className="p-4 w-44">Tarih</th>
                    <th className="p-4 text-right w-40">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFaturalar.length > 0 ? (
                    filteredFaturalar.map((fatura) => {
                      const isExpanded = expandedId === fatura.Id;
                      const mevcutDetaylar = detaylar[fatura.Id];
                      const hasDetails = mevcutDetaylar && mevcutDetaylar.length > 0;
                      const isErrorRow = mevcutDetaylar?.[0]?.isErrorRow;

                      return (
                        <Fragment key={fatura.Id}>
                          <tr 
                            onClick={() => toggleDetay(fatura.Id, fatura.IslemNo, fatura.IslemTipi)}
                            className={`group hover:bg-blue-50/20 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/40' : ''}`}
                          >
                            <td className="p-4 text-center">
                              {isExpanded ? <ChevronUp size={16} className="text-slate-400 group-hover:text-blue-500" /> : <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-500" />}
                            </td>
                            <td className="p-4 font-mono text-xs text-slate-400">#{fatura.IslemNo}</td>
                            <td className="p-4 font-mono text-xs font-semibold text-slate-600">
                              {fatura.BelgeNo && fatura.BelgeNo !== '-' ? fatura.BelgeNo : <span className="text-slate-300 font-normal italic">Yok</span>}
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-slate-900 truncate max-w-xs md:max-w-md group-hover:text-blue-600 transition-colors">
                                {fatura.CariAdi}
                              </div>
                              {fatura.IslemNotu && fatura.IslemNotu !== 'İçerik detayları için tıklayın' && (
                                <div className="text-[11px] text-slate-400 font-normal mt-0.5 truncate max-w-md">
                                  {fatura.IslemNotu}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase ${getBadgeStyle(fatura.IslemTipi)}`}>
                                <ArrowLeftRight size={10} />
                                {fatura.IslemTipi}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 text-xs font-medium">{formatDate(fatura.Tarih)}</td>
                            <td className={`p-4 text-right font-extrabold text-sm ${getTutarColorClass(fatura.IslemTipi)}`}>
                              {formatCurrency(fatura.ToplamTutar)}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/40">
                              <td colSpan={7} className="p-5 border-t border-b border-slate-200/30">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Package size={14} className="text-blue-500" />
                                    <span>Fatura İçeriği & Parça Dağılım Listesi</span>
                                  </h4>

                                  {detayLoading[fatura.Id] ? (
                                    <div className="flex items-center gap-2 p-6 text-xs text-slate-500 justify-center">
                                      <Loader2 className="animate-spin text-blue-500" size={16} />
                                      <span>Detaylar yükleniyor...</span>
                                    </div>
                                  ) : hasDetails && !isErrorRow ? (
                                    <div className="space-y-4">
                                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                              <th className="p-3 w-10 text-center">#</th>
                                              <th className="p-3 w-32">Stok Kodu</th>
                                              <th className="p-3">Ürün / Parça Adı</th>
                                              <th className="p-3 w-20 text-center">Miktar</th>
                                              <th className="p-3 w-28 text-right">Birim Fiyat (Matrah)</th>
                                              <th className="p-3 w-16 text-center">KDV</th>
                                              <th className="p-3 w-28 text-right">Birim (KDV Dahil)</th>
                                              <th className="p-3 w-32 text-right">Toplam Satır Tutarı</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {mevcutDetaylar.map((detay, idx) => (
                                              <tr key={`${detay.stokKodu || 'stok'}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                                                <td className="p-3 font-mono font-medium text-slate-500">{detay.stokKodu || '-'}</td>
                                                <td className="p-3 font-semibold text-slate-900">{detay.urunAdi}</td>
                                                <td className="p-3 text-center font-bold text-slate-600">
                                                  {detay.miktar} {detay.birim || 'ADET'}
                                                </td>
                                                <td className="p-3 text-right text-slate-500 font-mono">
                                                  {formatCurrency(detay.birimFiyat)}
                                                </td>
                                                <td className="p-3 text-center">
                                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    %{detay.kdvOrani ?? 0}
                                                  </span>
                                                </td>
                                                <td className="p-3 text-right text-slate-600 font-medium font-mono">
                                                  {formatCurrency(detay.kdvDahilBirimFiyat ?? detay.birimFiyat)}
                                                </td>
                                                <td className="p-3 text-right font-extrabold text-slate-900 font-mono">
                                                  {formatCurrency(detay.satirTutari ?? 0)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {(() => {
                                        const totalSatir = mevcutDetaylar.reduce((acc, curr) => acc + (curr.satirTutari ?? 0), 0);
                                        const totalKdv = mevcutDetaylar.reduce((acc, curr) => acc + (curr.kdvTutari ?? 0), 0);
                                        const matrah = Math.max(0, totalSatir - totalKdv);

                                        return (
                                          <div className="flex justify-end">
                                            <div className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 shadow-inner">
                                              <div className="flex justify-between text-slate-500">
                                                <span>Ara Toplam (KDV Hariç):</span>
                                                <span className="font-mono font-semibold text-slate-700">{formatCurrency(matrah)}</span>
                                              </div>
                                              <div className="flex justify-between text-slate-500 border-b border-slate-200 pb-2">
                                                <span>Hesaplanan Toplam KDV:</span>
                                                <span className="font-mono font-semibold text-amber-700">+{formatCurrency(totalKdv)}</span>
                                              </div>
                                              <div className="flex justify-between text-slate-900 font-black text-sm pt-1">
                                                <span>Fatura Genel Total:</span>
                                                <span className="text-emerald-600 font-mono text-base">
                                                  {formatCurrency(fatura.ToplamTutar ?? totalSatir)}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : isErrorRow ? (
                                    <div className="text-xs text-rose-600 bg-rose-50 p-4 rounded-lg border border-dashed border-rose-200 text-center font-medium">
                                      {mevcutDetaylar[0].urunAdi}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200 text-center italic">
                                      Bu işleme ait stok hareket kalemi bulunamadı.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 italic text-xs">
                        Aradığınız kriterlere uygun finansal kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}