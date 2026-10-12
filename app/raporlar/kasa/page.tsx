'use client';

import { useState, useEffect, Fragment } from 'react';
import { 
  Wallet, DollarSign, CreditCard, ArrowUpRight, ArrowDownLeft, 
  RefreshCw, PlusCircle, AlertCircle, ShoppingBag, ShieldCheck, 
  Building2, Check
} from 'lucide-react';

interface Kasa {
  kasaid: number;
  kodu: string;
  ad: string;
  bakiye: number;
  tip: 'NAKIT' | 'POS' | 'TRENDYOL' | 'KREDI_KARTI' | 'DIGER';
}

interface SonHareket {
  islemid: number;
  islemNo: number;
  cariAdi: string;
  belgeNo: string;
  islemTipi: string;
  kasaAdi: string;
  tarih: string;
  tutar: number;
  yon: 'GIRIS' | 'CIKIS';
}

interface Ozet {
  toplamVarliklar: number;
  toplamNakit: number;
  toplamPos: number;
  toplamPazaryeri: number;
  toplamKrediKartiBorcu: number;
  netLikidite: number;
  kasaAdedi: number;
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', { 
  style: 'currency', 
  currency: 'TRY', 
  minimumFractionDigits: 2 
});
const formatCurrency = (val: number) => currencyFormatter.format(val || 0);

export default function KasaFinansPaneli() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kasalar, setKasalar] = useState<Kasa[]>([]);
  const [hareketler, setHareketler] = useState<SonHareket[]>([]);
  const [ozet, setOzet] = useState<Ozet>({
    toplamVarliklar: 0,
    toplamNakit: 0,
    toplamPos: 0,
    toplamPazaryeri: 0,
    toplamKrediKartiBorcu: 0,
    netLikidite: 0,
    kasaAdedi: 0
  });

  // Tahsilat Modal State'i
  const [modalOpen, setModalOpen] = useState(false);
  const [seciliKasaId, setSeciliKasaId] = useState<number>(1);
  const [cariArama, setCariArama] = useState('');
  const [bulunanCariler, setBulunanCariler] = useState<{ id: number; id_name: string }[]>([]);
  const [seciliCari, setSeciliCari] = useState<{ id: number; id_name: string } | null>(null);
  const [tahsilatTutar, setTahsilatTutar] = useState<string>('');
  const [tahsilatAciklama, setTahsilatAciklama] = useState('HIZLI TAHSİLAT');
  const [tahsilatTipi, setTahsilatTipi] = useState('NAKİT TAHSİLAT');
  const [islemde, setIslemde] = useState(false);
  const [basariliMesaj, setBasariliMesaj] = useState<string | null>(null);

  const fetchKasaData = async () => {
    try {
      const res = await fetch('/api/finans/kasa');
      if (!res.ok) throw new Error('Kasa verileri alınamadı.');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setKasalar(data.kasalar || []);
      setOzet(data.ozet || {
        toplamVarliklar: 0,
        toplamNakit: 0,
        toplamPos: 0,
        toplamPazaryeri: 0,
        toplamKrediKartiBorcu: 0,
        netLikidite: 0,
        kasaAdedi: 0
      });
      setHareketler(data.sonHareketler || []);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Veriler yüklenirken hata oluştu.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKasaData();
  }, []);

  // Cari Arama Debounce
  useEffect(() => {
    if (cariArama.trim().length < 2) {
      setBulunanCariler([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cariler?search=${encodeURIComponent(cariArama)}`);
        const data = await res.json();
        if (data.success) setBulunanCariler(data.data || []);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cariArama]);

  const handleTahsilatKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliCari) {
      alert('Lütfen bir müşteri / cari seçin.');
      return;
    }
    const tutarNum = parseFloat(tahsilatTutar.replace(',', '.'));
    if (isNaN(tutarNum) || tutarNum <= 0) {
      alert('Geçerli bir tahsilat tutarı girin.');
      return;
    }

    setIslemde(true);
    try {
      const res = await fetch('/api/finans/tahsilat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cariId: seciliCari.id,
          cariAdi: seciliCari.id_name,
          kasaId: seciliKasaId,
          tutar: tutarNum,
          aciklama: tahsilatAciklama,
          islemTipi: tahsilatTipi
        })
      });
      const data = await res.json();
      if (data.success) {
        setBasariliMesaj(`Tahsilat işlendi! Belge No: ${data.belgeNo || data.islemNo}`);
        setModalOpen(false);
        setTahsilatTutar('');
        setSeciliCari(null);
        setCariArama('');
        fetchKasaData();
        setTimeout(() => setBasariliMesaj(null), 5000);
      } else {
        alert('Hata: ' + data.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sunucu hatası oluştu.';
      alert('Hata: ' + msg);
    } finally {
      setIslemde(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* BAŞLIK & HIZLI BUTONLAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Wallet size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Kasa & Likidite Paneli
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Nakit, POS, pazaryeri hesapları ve kredi kartı borç durumu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <PlusCircle size={16} />
            <span>Hızlı Tahsilat Ekle</span>
          </button>

          <button
            onClick={() => {
              setLoading(true);
              fetchKasaData();
            }}
            title="Yenile"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {basariliMesaj && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span>{basariliMesaj}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI KARTLARI (LİKİDİTE ÖZETİ) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* NET LİKİDİTE */}
        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Net Likidite</span>
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight ${ozet.netLikidite >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
              {formatCurrency(ozet.netLikidite)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Varlıklar - Kart Borçları
            </div>
          </div>
        </div>

        {/* NAKİT KASA */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Nakit Kasa</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatCurrency(ozet.toplamNakit)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Merkez & Nakit Kasalar
            </div>
          </div>
        </div>

        {/* POS ALACAKLARI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">POS Cüzdanı</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatCurrency(ozet.toplamPos)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              İşbankası & Kuveyt POS
            </div>
          </div>
        </div>

        {/* PAZARYERİ ALACAKLARI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pazaryeri</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {formatCurrency(ozet.toplamPazaryeri)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Trendyol & E-Ticaret
            </div>
          </div>
        </div>

        {/* KREDİ KARTI BORÇLARI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">K.K. & Ek Hesap Borcu</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
              {formatCurrency(ozet.toplamKrediKartiBorcu)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Toplam Kart Yükümlülüğü
            </div>
          </div>
        </div>

      </div>

      {/* KASA HESAPLARI KARTLARI */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            <span>Kasa & Hesap Bakiyeleri ({kasalar.length} Hesap)</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {kasalar.map(kasa => {
            const isBorc = kasa.bakiye < 0;
            let badgeBg = 'bg-slate-100 text-slate-700';
            if (kasa.tip === 'POS') badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
            else if (kasa.tip === 'NAKIT') badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (kasa.tip === 'TRENDYOL') badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
            else if (kasa.tip === 'KREDI_KARTI') badgeBg = isBorc ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div 
                key={kasa.kasaid}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      #{kasa.kodu}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeBg}`}>
                      {kasa.tip}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 min-h-[2rem]">
                    {kasa.ad}
                  </h3>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-base font-black font-mono ${isBorc ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatCurrency(kasa.bakiye)}
                  </span>
                  <button
                    onClick={() => {
                      setSeciliKasaId(kasa.kasaid);
                      setModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    + Tahsilat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SON KASA HAREKETLERİ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <ArrowUpRight size={14} className="text-emerald-600" />
            <span>Son Kasa & Tahsilat Hareketleri</span>
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">Son 15 Kayıt</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Tarih</th>
                <th className="py-2.5 px-3">Cari / Müşteri</th>
                <th className="py-2.5 px-3">Kasa / Hesap</th>
                <th className="py-2.5 px-3">İşlem Tipi</th>
                <th className="py-2.5 px-3">Belge No</th>
                <th className="py-2.5 px-4 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {hareketler.map(h => (
                <tr key={h.islemid} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-mono">{h.tarih}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">{h.cariAdi}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-600">{h.kasaAdi || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-500">{h.islemTipi}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{h.belgeNo}</td>
                  <td className={`py-2.5 px-4 text-right font-black font-mono ${h.yon === 'GIRIS' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {h.yon === 'GIRIS' ? '+' : '-'}{formatCurrency(h.tutar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HIZLI TAHSİLAT MODALI */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <PlusCircle size={16} className="text-emerald-600" />
                <span>Hızlı Tahsilat Fişi Kes</span>
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTahsilatKaydet} className="p-5 space-y-4 text-xs">
              
              {/* MÜŞTERİ SEÇİMİ */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Müşteri / Cari Seçimi
                </label>
                {!seciliCari ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Müşteri adı arayın..."
                      value={cariArama}
                      onChange={e => setCariArama(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                    />
                    {bulunanCariler.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 divide-y divide-slate-100">
                        {bulunanCariler.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSeciliCari(c);
                              setCariArama('');
                              setBulunanCariler([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-blue-50 font-bold text-slate-700"
                          >
                            {c.id_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-blue-900">{seciliCari.id_name}</span>
                    <button
                      type="button"
                      onClick={() => setSeciliCari(null)}
                      className="text-red-500 hover:underline font-bold text-[10px]"
                    >
                      Değiştir
                    </button>
                  </div>
                )}
              </div>

              {/* KASA HESABI SEÇİMİ */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tahsilat Yapılan Kasa / POS
                </label>
                <select
                  value={seciliKasaId}
                  onChange={e => setSeciliKasaId(parseInt(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                >
                  {kasalar.map(k => (
                    <option key={k.kasaid} value={k.kasaid}>
                      {k.ad} ({formatCurrency(k.bakiye)})
                    </option>
                  ))}
                </select>
              </div>

              {/* TUTAR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tahsilat Tutarı (TL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={tahsilatTutar}
                    onChange={e => setTahsilatTutar(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-black text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Ödeme Tipi
                  </label>
                  <select
                    value={tahsilatTipi}
                    onChange={e => setTahsilatTipi(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="NAKİT TAHSİLAT">Nakit</option>
                    <option value="KREDİ KARTI TAHSİLAT">Kredi Kartı / POS</option>
                  </select>
                </div>
              </div>

              {/* AÇIKLAMA */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Açıklama / Belge Notu
                </label>
                <input
                  type="text"
                  value={tahsilatAciklama}
                  onChange={e => setTahsilatAciklama(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={islemde}
                  className="flex-1 p-2.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 rounded-xl uppercase tracking-wider"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={islemde || !seciliCari}
                  className="flex-1 p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-black text-white rounded-xl uppercase tracking-wider shadow-xs"
                >
                  {islemde ? 'İşleniyor...' : 'Tahsilatı Onayla'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
