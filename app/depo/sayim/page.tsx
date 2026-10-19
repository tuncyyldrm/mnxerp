'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RotateCcw, 
  Save, 
  Download, 
  ClipboardList, 
  Sparkles,
  ArrowRight,
  Boxes,
  Volume2,
  VolumeX,
  Trash2,
  Maximize2,
  X,
  ImageIcon,
  Send,
  CloudCheck,
  Edit3,
  Check,
  Camera,
  Loader2
} from 'lucide-react';
import { getCleanedCode } from '@/components/katalog/types';

interface UrunItem {
  urunkodu: string;
  urun: string;
  urunalt?: string;
  grubu?: string;
  kateGOri?: string;
  Raf?: string;
  fiyatı?: number;
  sistemStok: number;
  OEM?: string;
  OEM_0?: string;
  OEM_1?: string;
}

interface SayimKayit {
  id: string;
  urunkodu: string;
  urun: string;
  raf: string;
  sistemStok: number;
  sayilanStok: number;
  fark: number;
  tarih: string;
}

// Basit Web Audio API bip sesi (Terminal okuma hissi)
const playBeep = (type: 'success' | 'alert' = 'success', enabled = true) => {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtxClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // A6
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } else {
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch {
    // Audio playback may be restricted by autoplay policy
  }
};

export default function DepoSayimPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UrunItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUrun, setSelectedUrun] = useState<UrunItem | null>(null);

  // Sayım değerleri
  const [sayimAdet, setSayimAdet] = useState<number>(0);
  const [yeniRaf, setYeniRaf] = useState<string>('');
  const [isSavingRaf, setIsSavingRaf] = useState(false);
  const [rafSaveMessage, setRafSaveMessage] = useState<string | null>(null);

  // Hydration koruması: LocalStorage verileri mount sonrasında yüklenir
  const [isMounted, setIsMounted] = useState(false);
  const [sayimListesi, setSayimListesi] = useState<SayimKayit[]>([]);
  const [sayimAdi, setSayimAdi] = useState<string>('Depo Sayımı');

  // LocalStorage'dan İlk Yükleme (SSR ve İstemci hydration farkını önler)
  useEffect(() => {
    try {
      const savedList = localStorage.getItem('ezm_depo_sayim_listesi');
      if (savedList) {
        setSayimListesi(JSON.parse(savedList));
      }
      const savedAdi = localStorage.getItem('ezm_depo_sayim_adi');
      if (savedAdi) {
        setSayimAdi(savedAdi);
      } else {
        const today = new Date().toLocaleDateString('tr-TR');
        setSayimAdi(`Depo Sayımı - ${today}`);
      }
    } catch {}
    setIsMounted(true);
  }, []);

  const [isEditingSayimAdi, setIsEditingSayimAdi] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Görsel Büyütme Modalı (Lightbox)
  const [zoomImg, setZoomImg] = useState<{ src: string; title: string; kod: string } | null>(null);

  // Sisteme İşleme / Onay Modalı
  const [isTamamlaModalOpen, setIsTamamlaModalOpen] = useState(false);
  const [stoklariGuncelle, setStoklariGuncelle] = useState(true);
  const [isSubmittingSayim, setIsSubmittingSayim] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; syId?: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Depoda Anlık Görsel Çekme & Yükleme
  const [imageVersion, setImageVersion] = useState(1);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUrun) return;

    setIsUploadingImage(true);
    setImageUploadStatus(null);

    const formData = new FormData();
    formData.append('urunkodu', selectedUrun.urunkodu);
    formData.append('file', file);

    try {
      const res = await fetch('/api/gorsel/yukle', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Görsel yüklenemedi.');
      }
      setImageVersion(Date.now());
      setImageUploadStatus('Görsel başarıyla kaydedildi!');
      playBeep('success', soundEnabled);
      setTimeout(() => setImageUploadStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Yükleme başarısız';
      setImageUploadStatus('Hata: ' + msg);
      playBeep('alert', soundEnabled);
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // LocalStorage'a Otomatik Eşitleme (Yalnızca mount gerçekleştikten sonra kaydeder, veriyi sıfırlamaz)
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem('ezm_depo_sayim_listesi', JSON.stringify(sayimListesi));
    } catch {}
  }, [sayimListesi, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem('ezm_depo_sayim_adi', sayimAdi);
    } catch {}
  }, [sayimAdi, isMounted]);

  // Sayfa yüklendiğinde ve işlem bitince arama kutusuna odaklan
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [selectedUrun]);

  // Arama Fonksiyonu
  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setRafSaveMessage(null);

    try {
      const res = await fetch(`/api/depo/sayim?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (data.success && data.urunler) {
        setSearchResults(data.urunler);

        // Eğer tam 1 ürün bulunduysa (örneğin barkod okutulduysa), doğrudan seç
        if (data.urunler.length === 1) {
          selectItem(data.urunler[0]);
          playBeep('success', soundEnabled);
        } else if (data.urunler.length === 0) {
          playBeep('alert', soundEnabled);
        }
      }
    } catch (err) {
      console.error('Arama hatası:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Ürün Seçimi
  const selectItem = (urun: UrunItem) => {
    setSelectedUrun(urun);
    setYeniRaf(urun.Raf || '');
    // Daha önce bu oturumda sayıldıysa onun adedini getir, yoksa sistem stokla başlat
    const oncekiKayit = sayimListesi.find(k => k.urunkodu === urun.urunkodu);
    if (oncekiKayit) {
      setSayimAdet(oncekiKayit.sayilanStok);
    } else {
      setSayimAdet(urun.sistemStok > 0 ? urun.sistemStok : 1);
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  // Adet Artır/Azalt
  const changeCount = (delta: number) => {
    setSayimAdet(prev => Math.max(0, prev + delta));
  };

  // Raf Güncelleme (Onelee DB sp_StokDuzenle tetikler)
  const handleSaveRaf = async () => {
    if (!selectedUrun) return;
    setIsSavingRaf(true);
    setRafSaveMessage(null);

    try {
      const res = await fetch('/api/depo/sayim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urunKodu: selectedUrun.urunkodu,
          raf: yeniRaf.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setRafSaveMessage('✓ Raf kaydedildi');
        setSelectedUrun(prev => prev ? { ...prev, Raf: yeniRaf.trim() } : null);
        playBeep('success', soundEnabled);
      } else {
        setRafSaveMessage('✗ Hata: ' + (data.error || 'Kaydedilemedi'));
        playBeep('alert', soundEnabled);
      }
    } catch {
      setRafSaveMessage('✗ Bağlantı hatası');
    } finally {
      setIsSavingRaf(false);
    }
  };

  // Sayımı Oturum Listesine Ekle
  const handleConfirmSayim = () => {
    if (!selectedUrun) return;

    const fark = sayimAdet - selectedUrun.sistemStok;
    const yeniKayit: SayimKayit = {
      id: `${selectedUrun.urunkodu}-${Date.now()}`,
      urunkodu: selectedUrun.urunkodu,
      urun: selectedUrun.urun,
      raf: yeniRaf.trim() || selectedUrun.Raf || '-',
      sistemStok: selectedUrun.sistemStok,
      sayilanStok: sayimAdet,
      fark: fark,
      tarih: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    // Varsa güncelle, yoksa en başa ekle
    setSayimListesi(prev => {
      const filtered = prev.filter(item => item.urunkodu !== selectedUrun.urunkodu);
      return [yeniKayit, ...filtered];
    });

    playBeep(fark === 0 ? 'success' : 'alert', soundEnabled);

    // Sıfırla ve arama kutusuna odaklan
    setSelectedUrun(null);
    setSearchQuery('');
    setRafSaveMessage(null);
  };

  // Sayım Listesini Sıfırla
  const handleResetList = () => {
    if (window.confirm('Bu oturumda sayılan tüm kayıtlar temizlenecektir. Emin misiniz?')) {
      setSayimListesi([]);
      try {
        localStorage.removeItem('ezm_depo_sayim_listesi');
      } catch {}
    }
  };

  // Sayımı Sisteme İşle (Onelee ERP'ye aktarma)
  const handleSubmitSayimToSystem = async () => {
    if (sayimListesi.length === 0) return;
    setIsSubmittingSayim(true);
    setSubmitResult(null);

    try {
      const res = await fetch('/api/depo/sayim/tamamla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sayimAdi,
          kalemler: sayimListesi.map(k => ({
            urunkodu: k.urunkodu,
            sayilanStok: k.sayilanStok,
            raf: k.raf
          })),
          stoklariGuncelle
        })
      });

      const data = await res.json();

      if (data.success) {
        setSubmitResult({
          success: true,
          message: data.message || 'Sayım başarıyla Onelee muhasebe sistemine işlendi.',
          syId: data.syId
        });
        playBeep('success', soundEnabled);
        // Sayım başarılı olunca hafızayı temizle
        setSayimListesi([]);
        try {
          localStorage.removeItem('ezm_depo_sayim_listesi');
        } catch {}
      } else {
        setSubmitResult({
          success: false,
          message: data.error || 'İşlem başarısız oldu.'
        });
        playBeep('alert', soundEnabled);
      }
    } catch {
      setSubmitResult({
        success: false,
        message: 'Sunucu ile bağlantı kurulamadı.'
      });
      playBeep('alert', soundEnabled);
    } finally {
      setIsSubmittingSayim(false);
    }
  };

  // CSV İndir
  const handleExportCSV = () => {
    if (sayimListesi.length === 0) return;
    const headers = ['Urun Kodu', 'Urun Adi', 'Raf', 'Sistem Stok', 'Sayilan Stok', 'Fark', 'Saat'];
    const rows = sayimListesi.map(k => [
      `"${k.urunkodu}"`,
      `"${k.urun.replace(/"/g, '""')}"`,
      `"${k.raf}"`,
      k.sistemStok,
      k.sayilanStok,
      k.fark,
      k.tarih
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Depo_Sayim_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fark = selectedUrun ? sayimAdet - selectedUrun.sistemStok : 0;
  const toplamSayilanKalem = sayimListesi.length;
  const toplamFarkli = sayimListesi.filter(k => k.fark !== 0).length;
  const toplamSayilanAdet = sayimListesi.reduce((sum, item) => sum + item.sayilanStok, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Üst Başlık & Kontroller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <Boxes size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                {isEditingSayimAdi ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={sayimAdi}
                      onChange={(e) => setSayimAdi(e.target.value)}
                      className="px-2 py-1 bg-white border border-amber-400 rounded-lg text-lg font-black text-slate-800 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => setIsEditingSayimAdi(false)}
                      className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <h1 
                    onClick={() => setIsEditingSayimAdi(true)}
                    className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2 cursor-pointer hover:text-amber-600 transition-colors group"
                    title="Sayım başlığını düzenlemek için tıklayın"
                  >
                    <span>{sayimAdi}</span>
                    <Edit3 size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h1>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <CloudCheck size={14} className="text-emerald-600" />
                <span>Cihaz hafızasında otomatik korunuyor &bull; Yenilemelerde kaybolmaz</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              soundEnabled 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title="Okuma Bip Sesi"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{soundEnabled ? 'Ses Açık' : 'Sessiz'}</span>
          </button>

          {sayimListesi.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Excel/CSV İndir"
              >
                <Download size={15} />
                <span className="hidden sm:inline">CSV İndir</span>
              </button>

              <button
                onClick={() => {
                  setSubmitResult(null);
                  setIsTamamlaModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Send size={15} />
                <span>Sisteme İşle ({sayimListesi.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Arama / Barkod Okutma Kutusu (Terminal Tarzı) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Barcode size={24} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Barkod okutun veya Ürün Kodu / OEM / İsim yazın..."
                className="w-full pl-13 pr-4 py-3.5 sm:py-4 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-slate-200 focus:border-amber-500 rounded-xl text-base sm:text-lg font-mono font-medium placeholder:font-sans placeholder:text-slate-400 outline-none transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-5 sm:px-8 py-3.5 sm:py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 disabled:text-slate-400 font-black rounded-xl text-sm sm:text-base transition-all flex items-center gap-2 shadow-sm"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search size={18} />
                  <span className="hidden sm:inline">Ara</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Çoklu Sonuç Listesi (Küçük Resimlerle) */}
        {searchResults.length > 0 && !selectedUrun && (
          <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50">
            <div className="px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 flex justify-between items-center">
              <span>Bulunan Ürünler ({searchResults.length})</span>
              <span className="text-[11px] text-slate-400 font-normal">Seçmek için dokunun</span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {searchResults.map((u) => {
                const imgPath = `/images/urunler/${getCleanedCode(u.urunkodu)}.jpg`;
                return (
                  <button
                    key={u.urunkodu}
                    onClick={() => selectItem(u)}
                    className="w-full px-4 py-3 text-left hover:bg-amber-50 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Küçük Önizleme Resmi */}
                      <div className="w-12 h-12 shrink-0 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-1 shadow-xs">
                        <img
                          src={imgPath}
                          alt={u.urun}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            const t = e.currentTarget;
                            if (t.src !== 'https://placehold.co/100x100?text=-') {
                              t.src = 'https://placehold.co/100x100?text=-';
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 text-sm">{u.urunkodu}</span>
                          {u.Raf && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                              Raf: {u.Raf}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{u.urun}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Sistem</span>
                        <span className="text-sm font-bold text-slate-700">{u.sistemStok} Adet</span>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Aktif Seçilen Ürün ve Sayım Paneli (GÖRSEL ODAKLI) */}
      {selectedUrun && (
        <div className="bg-white rounded-2xl border-2 border-amber-400/50 shadow-md p-4 sm:p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
          {/* Ürün Görseli & Künyesi */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-slate-100">
            {/* Büyük Ürün Görseli */}
            <div className="relative group shrink-0 flex flex-col items-center">
              <div 
                onClick={() => setZoomImg({
                  src: `/images/urunler/${getCleanedCode(selectedUrun.urunkodu)}.jpg?v=${imageVersion}`,
                  title: selectedUrun.urun,
                  kod: selectedUrun.urunkodu
                })}
                className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-50 border-2 border-slate-200 hover:border-amber-400 rounded-2xl overflow-hidden flex items-center justify-center p-2.5 shadow-inner cursor-pointer transition-all relative"
                title="Büyük boy görmek için tıklayın"
              >
                <img
                  key={`${selectedUrun.urunkodu}-${imageVersion}`}
                  src={`/images/urunler/${getCleanedCode(selectedUrun.urunkodu)}.jpg?v=${imageVersion}`}
                  alt={selectedUrun.urun}
                  className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== 'https://placehold.co/400x400?text=Görsel+Yok') {
                      target.src = 'https://placehold.co/400x400?text=Görsel+Yok';
                    }
                  }}
                />

                {/* Hover Büyüt İkonu */}
                <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                  <span className="p-2 bg-white/95 text-slate-800 rounded-xl shadow-lg flex items-center gap-1.5 text-xs font-bold">
                    <Maximize2 size={14} />
                    <span>Büyüt</span>
                  </span>
                </div>
              </div>

              {/* Depo Personeli İçin Hızlı Fotoğraf Çekme Butonu */}
              <div className="mt-2 w-full">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraCapture}
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:bg-slate-200 text-slate-950 disabled:text-slate-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  title="Cihaz kamerası ile yeni görsel çekip sisteme yükle"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>İşleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={13} />
                      <span>Fotoğraf Çek</span>
                    </>
                  )}
                </button>
                {imageUploadStatus && (
                  <p className="text-[10px] font-bold text-emerald-600 text-center mt-1 animate-in fade-in">
                    {imageUploadStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Ürün Metin Bilgileri */}
            <div className="flex-1 w-full space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg font-mono font-black text-sm tracking-wide">
                  {selectedUrun.urunkodu}
                </span>
                {selectedUrun.grubu && (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                    {selectedUrun.grubu}
                  </span>
                )}
                {selectedUrun.kateGOri && (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                    {selectedUrun.kateGOri}
                  </span>
                )}
                {selectedUrun.OEM && (
                  <span className="text-xs text-slate-400 font-mono">
                    OEM: {selectedUrun.OEM}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {selectedUrun.urun}
              </h2>
              {selectedUrun.urunalt && (
                <p className="text-xs text-slate-500">
                  {selectedUrun.urunalt}
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-normal">Mevcut Raf:</span> 
                  <strong className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedUrun.Raf || 'Tanımsız'}
                  </strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-normal">Sistem Stok:</span> 
                  <strong className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedUrun.sistemStok} Adet
                  </strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedUrun(null)}
              className="self-center sm:self-start text-xs font-bold text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Kapat / Başka Ürün
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SOL: Hızlı Raf Güncelleme */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin size={16} className="text-amber-600" />
                  Raf Konumu Güncelle
                </span>
                {rafSaveMessage && (
                  <span className={`text-xs font-bold ${rafSaveMessage.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {rafSaveMessage}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={yeniRaf}
                  onChange={(e) => setYeniRaf(e.target.value.toUpperCase())}
                  placeholder="Örn: A-04, RAF-12..."
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-sm font-bold uppercase tracking-wider outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveRaf}
                  disabled={isSavingRaf}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Save size={14} />
                  <span>{isSavingRaf ? '...' : 'Rafı Kaydet'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                * Bu alana yeni raf kodunu yazıp kaydettiğinizde muhasebe veritabanına anında yansır.
              </p>
            </div>

            {/* SAĞ: Sayım & Adet Karşılaştırma */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>Sistem Kayıtlı Stok:</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {selectedUrun.sistemStok} Adet
                </span>
              </div>

              {/* Büyük Adet Sayacı */}
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => changeCount(-1)}
                  className="w-12 h-12 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center font-bold text-lg transition-transform active:scale-95"
                >
                  <Minus size={20} />
                </button>

                <div className="flex-1 text-center">
                  <input
                    type="number"
                    min="0"
                    value={sayimAdet}
                    onChange={(e) => setSayimAdet(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black font-mono text-slate-900 bg-transparent outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Fiziksel Sayılan Adet</span>
                </div>

                <button
                  type="button"
                  onClick={() => changeCount(1)}
                  className="w-12 h-12 bg-amber-500 active:bg-amber-600 text-slate-950 rounded-lg flex items-center justify-center font-bold text-lg transition-transform active:scale-95"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Hızlı Adet Ekle Butonları */}
              <div className="flex items-center gap-1.5 justify-center">
                <button
                  type="button"
                  onClick={() => changeCount(5)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => changeCount(10)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => changeCount(50)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => setSayimAdet(0)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Sıfırla
                </button>
              </div>
            </div>
          </div>

          {/* Fark Göstergesi & Onaylama Barı */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className={`p-2.5 rounded-xl flex items-center justify-center ${
                fark === 0 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                  : fark > 0 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                {fark === 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Stok Durumu:</span>
                <span className={`text-base font-black font-mono ${
                  fark === 0 
                    ? 'text-emerald-700' 
                    : fark > 0 
                    ? 'text-blue-700' 
                    : 'text-rose-700'
                }`}>
                  {fark === 0 ? '✓ Birebir Eşleşiyor' : `${fark > 0 ? '+' : ''}${fark} Adet Fark`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmSayim}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 size={18} />
              <span>Sayımı Onayla & Listeye Ekle</span>
            </button>
          </div>
        </div>
      )}

      {/* Oturum Sayım Listesi (Resimli Önizleme & Yerel Kalıcılık) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-slate-600" />
            <h3 className="font-bold text-slate-800 text-base">Bu Oturumdaki Sayımlar</h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {toplamSayilanKalem} Kalem / {toplamSayilanAdet} Adet
            </span>
          </div>

          {toplamSayilanKalem > 0 && (
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-emerald-600">
                ✓ {toplamSayilanKalem - toplamFarkli} Eşleşen
              </span>
              {toplamFarkli > 0 && (
                <span className="text-rose-600">
                  ⚠ {toplamFarkli} Farklı
                </span>
              )}
              <button
                onClick={handleResetList}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                title="Listeyi Temizle"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {sayimListesi.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <Sparkles size={36} className="mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-medium">Henüz bir ürün sayımı yapılmadı</p>
            <p className="text-xs text-slate-400">
              Yukarıdaki alandan barkod okutarak veya aratarak sayıma başlayabilirsiniz. Sayımınız cihazınızda otomatik saklanır.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Ürün</th>
                  <th className="py-3 px-4">Raf</th>
                  <th className="py-3 px-4 text-center">Sistem</th>
                  <th className="py-3 px-4 text-center">Sayılan</th>
                  <th className="py-3 px-4 text-center">Fark</th>
                  <th className="py-3 px-4 text-right">Saat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sayimListesi.map((item) => {
                  const imgPath = `/images/urunler/${getCleanedCode(item.urunkodu)}.jpg`;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Mini Resim */}
                          <div 
                            onClick={() => setZoomImg({ src: imgPath, title: item.urun, kod: item.urunkodu })}
                            className="w-10 h-10 shrink-0 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center p-0.5 cursor-pointer hover:border-amber-400 transition-colors"
                            title="Büyütmek için tıklayın"
                          >
                            <img
                              src={imgPath}
                              alt={item.urun}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const t = e.currentTarget;
                                if (t.src !== 'https://placehold.co/80x80?text=-') {
                                  t.src = 'https://placehold.co/80x80?text=-';
                                }
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-slate-800 block">{item.urunkodu}</span>
                            <span className="text-slate-500 truncate max-w-xs block">{item.urun}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono font-semibold">
                          {item.raf}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {item.sistemStok}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {item.sayilanStok}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded font-mono font-bold ${
                          item.fark === 0 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : item.fark > 0 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.fark > 0 ? `+${item.fark}` : item.fark}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono">
                        {item.tarih}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BÜYÜK GÖRSEL ÖNİZLEME MODALI (LIGHTBOX) */}
      {zoomImg && (
        <div 
          onClick={() => setZoomImg(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded font-mono font-bold text-xs">
                  {zoomImg.kod}
                </span>
                <h3 className="font-bold text-slate-800 text-sm mt-1 line-clamp-1">{zoomImg.title}</h3>
              </div>
              <button
                onClick={() => setZoomImg(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 bg-slate-50 flex items-center justify-center min-h-[300px]">
              <img
                src={zoomImg.src}
                alt={zoomImg.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (t.src !== 'https://placehold.co/600x600?text=Görsel+Yok') {
                    t.src = 'https://placehold.co/600x600?text=Görsel+Yok';
                  }
                }}
              />
            </div>

            <div className="p-3 bg-slate-100/50 text-center text-xs text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5">
              <ImageIcon size={14} />
              <span>Kapatmak için dışarıya veya çarpıya dokunun</span>
            </div>
          </div>
        </div>
      )}

      {/* SAYIMI SİSTEME İŞLEME & ONAY MODALI */}
      {isTamamlaModalOpen && (
        <div 
          onClick={() => !isSubmittingSayim && setIsTamamlaModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Sayımı Muhasebeye İşle</h3>
                <p className="text-xs text-slate-500">Onelee ERP sistemine kalıcı aktarım</p>
              </div>
              <button
                onClick={() => !isSubmittingSayim && setIsTamamlaModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {submitResult ? (
                <div className={`p-4 rounded-xl border text-sm space-y-2 ${
                  submitResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {submitResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span>{submitResult.success ? 'Başarıyla Tamamlandı' : 'Hata Oluştu'}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{submitResult.message}</p>
                  {submitResult.syId && (
                    <p className="text-xs font-mono font-bold">
                      Onelee Sayım Fiş No: #{submitResult.syId}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sayım Adı:</span>
                      <span className="font-bold text-slate-800">{sayimAdi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toplam Kalem:</span>
                      <span className="font-bold text-slate-800">{toplamSayilanKalem} Ürün</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toplam Sayılan Adet:</span>
                      <span className="font-bold text-slate-800">{toplamSayilanAdet} Adet</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fark Olan Kalemler:</span>
                      <span className="font-bold text-rose-600">{toplamFarkli} Kalem</span>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-amber-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stoklariGuncelle}
                      onChange={(e) => setStoklariGuncelle(e.target.checked)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">
                        Onelee Stoklarını Eşitle (STK_FULL)
                      </span>
                      <span className="text-slate-500 text-[11px] leading-tight block mt-0.5">
                        İşaretlenirse, Onelee veritabanındaki stok miktarları sayılan adetlere eşitlenecektir.
                      </span>
                    </div>
                  </label>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    * Bu işlem Onelee veritabanında <code className="font-mono text-slate-600">INDX_SAYIM</code> tablosuna sayım fişi olarak kaydedilir ve geçmişte incelenebilir.
                  </p>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              {submitResult?.success ? (
                <button
                  type="button"
                  onClick={() => setIsTamamlaModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Tamam / Kapat
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsTamamlaModalOpen(false)}
                    disabled={isSubmittingSayim}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitSayimToSystem}
                    disabled={isSubmittingSayim}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {isSubmittingSayim ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Onayla ve Sisteme İşle</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
