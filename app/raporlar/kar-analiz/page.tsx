'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  TrendingUp, DollarSign, Package, 
  Calendar, Search, ArrowUpDown, ChevronDown, ChevronUp, 
  RefreshCw, FileText, AlertTriangle, PieChart, Layers
} from 'lucide-react';

interface UrunKarAnalizi {
  stokKodu: string;
  urunAdi: string;
  grubu: string;
  kategori: string;
  birim: string;
  satilanMiktar: number;
  toplamSatisTutari: number;
  ortalamaSatisFiyati: number;
  birimMaliyet: number;
  toplamMaliyet: number;
  netKar: number;
  karMarjiYuzde: number;
}

interface SatisHareketi {
  islemid: number;
  cariAdi: string;
  belgeNo: string;
  tarih: string;
  saat: string;
  miktar: number;
  birimFiyat: number;
  satisTutari: number;
}

interface OzetVeri {
  toplamCiro: number;
  toplamMaliyet: number;
  toplamNetKar: number;
  toplamSatilanAdet: number;
  toplamUrunCesidi: number;
  ortalamaKarMarji: number;
}

// Para birimi ve sayı formatlayıcıları
const currencyFormatter = new Intl.NumberFormat('tr-TR', { 
  style: 'currency', 
  currency: 'TRY', 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
});
const formatCurrency = (val: number) => currencyFormatter.format(val || 0);

const numberFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const formatNumber = (val: number) => numberFormatter.format(val || 0);

type KarSegmenti = 'all' | 'high' | 'normal' | 'low' | 'loss';
type SiralamaAlani = 'netKar' | 'ciro' | 'miktar' | 'marj';

export default function KarAnalizSayfasi() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [urunler, setUrunler] = useState<UrunKarAnalizi[]>([]);
  const [ozet, setOzet] = useState<OzetVeri>({
    toplamCiro: 0,
    toplamMaliyet: 0,
    toplamNetKar: 0,
    toplamSatilanAdet: 0,
    toplamUrunCesidi: 0,
    ortalamaKarMarji: 0
  });

  // Filtreler
  const [muhtelifDahil, setMuhtelifDahil] = useState<boolean>(false);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [karFiltresi, setKarFiltresi] = useState<KarSegmenti>('all');
  const [sortBy, setSortBy] = useState<SiralamaAlani>('netKar');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detay açma/kapatma (Akordiyon)
  const [expandedStokKodu, setExpandedStokKodu] = useState<string | null>(null);
  const [hareketler, setHareketler] = useState<Record<string, SatisHareketi[]>>({});
  const [hareketLoading, setHareketLoading] = useState<Record<string, boolean>>({});

  // Tarih Preset Değişimi
  const applyDatePreset = (preset: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'thisWeek') {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Pazartesi
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
      return;
    }

    if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
      return;
    }
  };

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let ignore = false;

    const fetchKar = async () => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('baslangic', startDate);
        if (endDate) params.append('bitis', endDate);
        if (muhtelifDahil) params.append('muhtelifDahil', 'true');

        const res = await fetch(`/api/analiz/kar?${params.toString()}`);
        if (!res.ok) throw new Error('Sunucudan kâr analizi verisi alınamadı.');

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Bilinmeyen bir hata oluştu.');

        if (!ignore) {
          setError(null);
          setUrunler(data.urunler || []);
          setOzet(data.ozet || {
            toplamCiro: 0,
            toplamMaliyet: 0,
            toplamNetKar: 0,
            toplamSatilanAdet: 0,
            toplamUrunCesidi: 0,
            ortalamaKarMarji: 0
          });
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu.';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchKar();

    return () => {
      ignore = true;
    };
  }, [startDate, endDate, muhtelifDahil, refreshTrigger]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  // Tek ürünün satış detaylarını çekme
  const toggleDetail = async (kod: string) => {
    if (expandedStokKodu === kod) {
      setExpandedStokKodu(null);
      return;
    }

    setExpandedStokKodu(kod);

    if (!hareketler[kod]) {
      setHareketLoading(prev => ({ ...prev, [kod]: true }));
      try {
        const params = new URLSearchParams();
        params.append('stokKodu', kod);
        if (startDate) params.append('baslangic', startDate);
        if (endDate) params.append('bitis', endDate);

        const res = await fetch(`/api/analiz/kar?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setHareketler(prev => ({ ...prev, [kod]: data.hareketler || [] }));
        }
      } catch (err: unknown) {
        console.error('Hareket yüklenemedi:', err);
      } finally {
        setHareketLoading(prev => ({ ...prev, [kod]: false }));
      }
    }
  };

  // Filtreleme ve Sıralama
  const filteredAndSortedList = useMemo(() => {
    return urunler
      .filter(item => {
        // Arama filtresi
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchKod = item.stokKodu?.toLowerCase().includes(q);
          const matchAd = item.urunAdi?.toLowerCase().includes(q);
          const matchGrup = item.grubu?.toLowerCase().includes(q);
          if (!matchKod && !matchAd && !matchGrup) return false;
        }

        // Kâr marjı segment filtresi
        if (karFiltresi === 'high' && item.karMarjiYuzde < 40) return false;
        if (karFiltresi === 'normal' && (item.karMarjiYuzde < 15 || item.karMarjiYuzde >= 40)) return false;
        if (karFiltresi === 'low' && (item.karMarjiYuzde < 0 || item.karMarjiYuzde >= 15)) return false;
        if (karFiltresi === 'loss' && item.karMarjiYuzde >= 0) return false;

        return true;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (sortBy === 'netKar') {
          valA = a.netKar;
          valB = b.netKar;
        } else if (sortBy === 'ciro') {
          valA = a.toplamSatisTutari;
          valB = b.toplamSatisTutari;
        } else if (sortBy === 'miktar') {
          valA = a.satilanMiktar;
          valB = b.satilanMiktar;
        } else if (sortBy === 'marj') {
          valA = a.karMarjiYuzde;
          valB = b.karMarjiYuzde;
        }

        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [urunler, searchTerm, karFiltresi, sortBy, sortOrder]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* BAŞLIK & TARİH SEÇİCİ BÖLÜMÜ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Ürün Bazlı Kâr Analizi
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Satılan ürünlerin maliyet, ciro, net kâr ve marj durumu
              </p>
            </div>
          </div>
        </div>

        {/* FİLTRE VE SEÇİCİ BÖLÜMÜ */}
        <div className="flex flex-wrap items-center gap-2">
          {/* FİZİKSEL PARÇA VS RESMİ/MUHTELİF BUTONLARI */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => {
                if (muhtelifDahil) {
                  setLoading(true);
                  setMuhtelifDahil(false);
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                !muhtelifDahil
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'hover:text-slate-900 text-slate-600'
              }`}
            >
              <Package size={14} />
              <span>Fiziksel Parçalar (Gerçek Kâr)</span>
            </button>
            <button
              onClick={() => {
                if (!muhtelifDahil) {
                  setLoading(true);
                  setMuhtelifDahil(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                muhtelifDahil
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'hover:text-slate-900 text-slate-600'
              }`}
            >
              <FileText size={14} />
              <span>Resmi / Muhtelif Dahil</span>
            </button>
          </div>

          {/* TARİH HIZLI BUTONLARI */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => {
                setLoading(true);
                applyDatePreset('all');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'all' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
            >
              Tüm Zamanlar
            </button>
            <button
              onClick={() => {
                setLoading(true);
                applyDatePreset('thisMonth');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'thisMonth' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => {
                setLoading(true);
                applyDatePreset('thisWeek');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'thisWeek' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
            >
              Bu Hafta
            </button>
            <button
              onClick={() => {
                setLoading(true);
                applyDatePreset('today');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'today' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
            >
              Bugün
            </button>
          </div>

          {/* ÖZEL TARİH GİRİŞLERİ */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setLoading(true);
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setLoading(true);
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs"
            />
          </div>

          <button
            onClick={handleManualRefresh}
            title="Yenile"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* MOD BİLGİLENDİRME BANDI */}
      {!muhtelifDahil ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs font-semibold text-emerald-800 shadow-xs">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>
            <strong>Fiziksel Parçalar Modu:</strong> Raftaki gerçek oto yedek parçaların kârlılığı hesaplanıyor. Resmi ve sanal fatura kayıtları (0001 - Muhtelif) genel marjı bozmaması için filtrelendi.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs font-semibold text-amber-800 shadow-xs">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>
            <strong>Tüm Faturalar Modu:</strong> Resmi ve sanal muhtelif fatura kayıtları dahil edildi. Sanal maliyetler genel kâr marjını eksiye çekebilir.
          </span>
        </div>
      )}

      {/* KPI KARTLARI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* TOPLAM CİRO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Ciro</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatCurrency(ozet.toplamCiro)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Toplam Satış Geliri
            </div>
          </div>
        </div>

        {/* TOPLAM MALİYET */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Maliyet</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Package size={16} />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatCurrency(ozet.toplamMaliyet)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Ürün Alış Maliyetleri
            </div>
          </div>
        </div>

        {/* NET KÂR */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Net Kâr</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black text-emerald-600 tracking-tight">
              {formatCurrency(ozet.toplamNetKar)}
            </div>
            <div className="text-[11px] font-semibold text-emerald-700/80 mt-0.5">
              Ciro - Maliyet Farkı
            </div>
          </div>
        </div>

        {/* ORTALAMA KÂR MARJI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Kâr Marjı</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <PieChart size={16} />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight flex items-baseline gap-1">
              %{formatNumber(ozet.ortalamaKarMarji)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Toplam Net Kâr / Ciro
            </div>
          </div>
        </div>

        {/* SATILAN MİKTAR / KALEM */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Satış Hacmi</span>
            <div className="p-1.5 bg-indigo-600/10 text-indigo-600 rounded-lg">
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatNumber(ozet.toplamSatilanAdet)} <span className="text-xs font-bold text-slate-400">Adet</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              {ozet.toplamUrunCesidi} Farklı Ürün Kalemi
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELEME VE ARAMA BÖLÜMÜ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Arama Kutusu */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ürün adı, stok kodu veya kategori ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Segment ve Sıralama Kontrolleri */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Kâr Segmenti Filtresi */}
          <select
            value={karFiltresi}
            onChange={(e) => setKarFiltresi(e.target.value as KarSegmenti)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Kâr Marjı: Tümü</option>
            <option value="high">Yüksek Kâr (&gt; %40)</option>
            <option value="normal">Standart Kâr (%15 - %40)</option>
            <option value="low">Düşük Kâr (&lt; %15)</option>
            <option value="loss">Zarar / Sıfır Altı</option>
          </select>

          {/* Sıralama Ölçütü */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SiralamaAlani)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="netKar">Sırala: Net Kâr (TL)</option>
            <option value="ciro">Sırala: Ciro (Toplam Satış)</option>
            <option value="miktar">Sırala: Satılan Adet</option>
            <option value="marj">Sırala: Kâr Marjı (%)</option>
          </select>

          {/* Sıralama Yönü (Artan/Azalan) */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            title={sortOrder === 'desc' ? 'Azalan Sıralama' : 'Artan Sıralama'}
            className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <ArrowUpDown size={14} />
            <span>{sortOrder === 'desc' ? 'Yüksekten Düşüğe' : 'Düşükten Yükseğe'}</span>
          </button>
        </div>
      </div>

      {/* HATA MESAJI */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-semibold">
          <AlertTriangle size={20} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* YÜKLENİYOR DURUMU */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600">Kâr analiz verileri hesaplanıyor...</p>
        </div>
      ) : filteredAndSortedList.length === 0 ? (
        /* BOŞ TABLO DURUMU */
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <Package size={36} className="text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-700">Seçili kriterlere uygun satış kaydı bulunamadı.</p>
          <p className="text-xs text-slate-400">Tarih filtresini değiştirmeyi veya arama terimini temizlemeyi deneyin.</p>
        </div>
      ) : (
        /* KÂR ANALİZ TABLOSU */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Ürün / Stok</th>
                  <th className="py-3 px-3 text-right">Satış Adedi</th>
                  <th className="py-3 px-3 text-right">Ort. Satış Fiyatı</th>
                  <th className="py-3 px-3 text-right">Toplam Ciro</th>
                  <th className="py-3 px-3 text-right">Birim Maliyet</th>
                  <th className="py-3 px-3 text-right">Toplam Maliyet</th>
                  <th className="py-3 px-3 text-right">Net Kâr</th>
                  <th className="py-3 px-4 text-center">Kâr Marjı</th>
                  <th className="py-3 px-3 text-center">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAndSortedList.map((item) => {
                  const isExpanded = expandedStokKodu === item.stokKodu;
                  const itemHareketler = hareketler[item.stokKodu] || [];
                  const isHareketLoading = hareketLoading[item.stokKodu];

                  // Marj renk badge mantığı
                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (item.karMarjiYuzde >= 40) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (item.karMarjiYuzde >= 15) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  else if (item.karMarjiYuzde >= 0) badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  else badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <Fragment key={item.stokKodu}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Ürün & Stok Kodu */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 leading-tight">
                            {item.urunAdi}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {item.stokKodu}
                            </span>
                            {item.grubu && (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.grubu}
                              </span>
                            )}
                            {(item.stokKodu === '0001' || item.urunAdi?.includes('MUHTELİF')) && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                Resmi / Sanal Fatura
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Satış Adedi */}
                        <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          {formatNumber(item.satilanMiktar)} <span className="text-[11px] font-normal text-slate-400">{item.birim}</span>
                        </td>

                        {/* Ortalama Satış Fiyatı */}
                        <td className="py-3 px-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                          {formatCurrency(item.ortalamaSatisFiyati)}
                        </td>

                        {/* Toplam Ciro */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(item.toplamSatisTutari)}
                        </td>

                        {/* Birim Maliyet */}
                        <td className="py-3 px-3 text-right font-semibold text-slate-500 whitespace-nowrap">
                          {formatCurrency(item.birimMaliyet)}
                        </td>

                        {/* Toplam Maliyet */}
                        <td className="py-3 px-3 text-right font-semibold text-slate-500 whitespace-nowrap">
                          {formatCurrency(item.toplamMaliyet)}
                        </td>

                        {/* Net Kâr */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={`font-black ${item.netKar >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(item.netKar)}
                          </span>
                        </td>

                        {/* Kâr Marjı (%) */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${badgeColor}`}>
                            %{formatNumber(item.karMarjiYuzde)}
                          </span>
                        </td>

                        {/* Detay Aç/Kapat Butonu */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleDetail(item.stokKodu)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                            title="Satış hareketlerini incele"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* AÇILIR DETAY ALANI (SATIŞ HAREKETLERİ) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={9} className="p-4 border-y border-slate-200">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText size={14} className="text-indigo-600" />
                                  <span>{item.urunAdi} - Gerçekleşen Satış Belgeleri</span>
                                </h3>
                                <span className="text-[11px] font-bold text-slate-400">
                                  {itemHareketler.length} Satış Kaydı
                                </span>
                              </div>

                              {isHareketLoading ? (
                                <div className="p-6 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                                  <RefreshCw size={14} className="animate-spin text-indigo-600" />
                                  <span>Hareketler getiriliyor...</span>
                                </div>
                              ) : itemHareketler.length === 0 ? (
                                <div className="p-4 text-center text-xs font-medium text-slate-400">
                                  Bu ürüne ait seçili aralıkta detay kayıt bulunamadı.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                                      <tr>
                                        <th className="py-2 px-3 text-left">Tarih</th>
                                        <th className="py-2 px-3 text-left">Müşteri / Cari</th>
                                        <th className="py-2 px-3 text-left">Belge No</th>
                                        <th className="py-2 px-3 text-right">Adet</th>
                                        <th className="py-2 px-3 text-right">Birim Satış</th>
                                        <th className="py-2 px-3 text-right">Toplam Tutar</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                      {itemHareketler.map((h) => (
                                        <tr key={h.islemid} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 font-mono">{h.tarih}</td>
                                          <td className="py-2 px-3 font-semibold text-slate-800">{h.cariAdi}</td>
                                          <td className="py-2 px-3 font-mono">{h.belgeNo}</td>
                                          <td className="py-2 px-3 text-right font-bold">{formatNumber(h.miktar)}</td>
                                          <td className="py-2 px-3 text-right">{formatCurrency(h.birimFiyat)}</td>
                                          <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCurrency(h.satisTutari)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TABLO ALT BİLGİ */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Listelenen Ürün Sayısı: {filteredAndSortedList.length}</span>
            <span>MNX ERP Kâr & Maliyet Analiz Motoru</span>
          </div>
        </div>
      )}

    </div>
  );
}
