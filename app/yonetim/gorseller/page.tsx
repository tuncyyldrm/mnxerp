'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Camera, 
  Trash2, 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Loader2, 
  Plus, 
  Check, 
  X,
  FileImage,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { getCleanedCode } from '@/components/katalog/types';

interface UrunGorselItem {
  oto: number;
  urunkodu: string;
  urun: string;
  grubu: string;
  kategori: string;
  tipi: string;
  Raf: string;
  fiyatı: number;
  OEM: string;
  MevcutBakiye: number;
  cleanedKod: string;
  gorselVar: boolean;
  gorselUrl: string | null;
}

interface IstatistikData {
  toplamUrun: number;
  gorselliSayisi: number;
  gorselsizSayisi: number;
  dolulukOrani: number;
}

export default function GorselYonetimPage() {
  // Liste ve Sayfalama
  const [urunler, setUrunler] = useState<UrunGorselItem[]>([]);
  const [istatistik, setIstatistik] = useState<IstatistikData>({
    toplamUrun: 0,
    gorselliSayisi: 0,
    gorselsizSayisi: 0,
    dolulukOrani: 0
  });
  const [toplamKayit, setToplamKayit] = useState(0);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [sayfa, setSayfa] = useState(1);
  const [limit] = useState(24);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [durumFiltre, setDurumFiltre] = useState<'all' | 'gorselli' | 'gorselsiz'>('all');

  // Toplu Yükleme Modalı
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ total: number; done: number; success: number; fail: number } | null>(null);

  // Tekil Görsel İşlemleri
  const [processingKod, setProcessingKod] = useState<string | null>(null);
  const [activeCameraKod, setActiveCameraKod] = useState<string | null>(null);
  const [activeUploadKod, setActiveUploadKod] = useState<string | null>(null);
  const [globalImageVersion, setGlobalImageVersion] = useState(Date.now());
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Zoom / Lightbox
  const [zoomGorsel, setZoomGorsel] = useState<{ src: string; kod: string; title: string } | null>(null);

  // Input referansları
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const singleCameraInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Veri Çekme
  const fetchUrunler = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sayfa: sayfa.toString(),
        limit: limit.toString(),
        durum: durumFiltre,
      });
      if (search) params.append('search', search);

      const res = await fetch(`/api/gorsel/liste?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUrunler(data.urunler || []);
        setToplamKayit(data.pagination?.totalFiltered ?? data.toplamKayit ?? 0);
        setToplamSayfa(data.pagination?.totalPages ?? data.toplamSayfa ?? 1);
        if (data.stats || data.istatistik) {
          setIstatistik(data.stats || data.istatistik);
        }
      } else {
        showToast('error', data.error || 'Veriler alınamadı.');
      }
    } catch {
      showToast('error', 'Sunucu ile iletişim hatası.');
    } finally {
      setLoading(false);
    }
  }, [sayfa, limit, durumFiltre, search]);

  useEffect(() => {
    fetchUrunler();
  }, [fetchUrunler]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSayfa(1);
    setSearch(searchInput.trim());
  };

  // Toplu Dosya Yükleme
  const handleBulkUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      showToast('error', 'Lütfen resim dosyaları (JPG, PNG, WEBP) seçin.');
      return;
    }

    setIsBulkUploading(true);
    setBulkUploadProgress({ total: fileArray.length, done: 0, success: 0, fail: 0 });

    const batchSize = 10;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileArray.length; i += batchSize) {
      const currentBatch = fileArray.slice(i, i + batchSize);
      const formData = new FormData();
      currentBatch.forEach(file => formData.append('files', file));

      try {
        const res = await fetch('/api/gorsel/yukle', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.sonuclar)) {
          data.sonuclar.forEach((s: any) => {
            if (s.durum === 'basarili') successCount++;
            else failCount++;
          });
        } else {
          failCount += currentBatch.length;
        }
      } catch {
        failCount += currentBatch.length;
      }

      setBulkUploadProgress({
        total: fileArray.length,
        done: Math.min(i + batchSize, fileArray.length),
        success: successCount,
        fail: failCount
      });
    }

    setIsBulkUploading(false);
    setGlobalImageVersion(Date.now());
    showToast('success', `${successCount} görsel sisteme yüklendi!`);
    fetchUrunler();
  };

  // Tekil Dosya Yükleme
  const handleSingleUpload = async (file: File, urunKodu: string) => {
    setProcessingKod(urunKodu);
    const formData = new FormData();
    formData.append('urunkodu', urunKodu);
    formData.append('file', file);

    try {
      const res = await fetch('/api/gorsel/yukle', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', `${urunKodu} görseli güncellendi.`);
        setGlobalImageVersion(Date.now());
        setUrunler(prev => prev.map(u => {
          if (u.urunkodu === urunKodu) {
            return {
              ...u,
              gorselVar: true,
              gorselUrl: `/images/urunler/${getCleanedCode(urunKodu)}.jpg`
            };
          }
          return u;
        }));
      } else {
        showToast('error', data.error || 'Yükleme başarısız.');
      }
    } catch {
      showToast('error', 'Görsel yüklenemedi.');
    } finally {
      setProcessingKod(null);
    }
  };

  // Tekil Görsel Silme
  const handleSingleDelete = async (urunKodu: string) => {
    if (!confirm(`${urunKodu} ürününün görselini silmek istediğinize emin misiniz?`)) return;

    setProcessingKod(urunKodu);
    try {
      const res = await fetch('/api/gorsel/sil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urunkodu: urunKodu })
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', `${urunKodu} görseli silindi.`);
        setGlobalImageVersion(Date.now());
        setUrunler(prev => prev.map(u => {
          if (u.urunkodu === urunKodu) {
            return { ...u, gorselVar: false, gorselUrl: null };
          }
          return u;
        }));
      } else {
        showToast('error', data.error || 'Silinemedi.');
      }
    } catch {
      showToast('error', 'Silme sırasında hata oluştu.');
    } finally {
      setProcessingKod(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-150">
      
      {/* Gizli Tekli Inputlar */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeUploadKod) handleSingleUpload(file, activeUploadKod);
          e.target.value = '';
        }}
      />
      <input
        ref={singleCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeCameraKod) handleSingleUpload(file, activeCameraKod);
          e.target.value = '';
        }}
      />
      <input
        ref={bulkFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleBulkUploadFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Toast Bildirim */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold text-white animate-in slide-in-from-bottom-2 ${
          toastMsg.type === 'success' ? 'bg-slate-900' : 'bg-red-600'
        }`}>
          {toastMsg.type === 'success' ? <Check size={14} className="text-emerald-400" /> : <AlertCircle size={14} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* SADE VE FERAH ÜST BAŞLIK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Görsel Yönetimi</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              %{istatistik.dolulukOrani} Doluluk
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ürün fotoğraflarını görüntüleyin, eksikleri tamamlayın veya toplu fotoğraf aktarın.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
          >
            <UploadCloud size={15} />
            <span>Toplu Yükle</span>
          </button>

          <button
            onClick={fetchUrunler}
            disabled={loading}
            className="p-2.5 sm:p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors shadow-xs active:scale-95"
            title="Listeyi Yenile"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KULLANIMI KOLAY FİLTRE VE ARAMA ÇUBUĞU */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
        
        {/* Filtre Sekmeleri (Mobilde 3 Eşit Sütun Olarak Kusursuz Sığar) */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-lg w-full md:w-auto text-[11px] sm:text-xs font-semibold gap-1">
          <button
            onClick={() => { setDurumFiltre('all'); setSayfa(1); }}
            className={`py-1.5 sm:py-1.5 px-1 sm:px-3 rounded-md transition-all text-center truncate ${
              durumFiltre === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tümü ({istatistik.toplamUrun.toLocaleString('tr-TR')})
          </button>

          <button
            onClick={() => { setDurumFiltre('gorselsiz'); setSayfa(1); }}
            className={`py-1.5 sm:py-1.5 px-1 sm:px-3 rounded-md transition-all flex items-center justify-center gap-1 truncate ${
              durumFiltre === 'gorselsiz' 
                ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' 
                : 'text-amber-800 hover:bg-amber-100/50'
            }`}
          >
            <span>❌ Eksik</span>
            <span className="text-[10px] bg-amber-600/20 px-1 rounded font-mono">
              {istatistik.gorselsizSayisi.toLocaleString('tr-TR')}
            </span>
          </button>

          <button
            onClick={() => { setDurumFiltre('gorselli'); setSayfa(1); }}
            className={`py-1.5 sm:py-1.5 px-1 sm:px-3 rounded-md transition-all flex items-center justify-center gap-1 truncate ${
              durumFiltre === 'gorselli' 
                ? 'bg-emerald-600 text-white shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>✓ Var</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({istatistik.gorselliSayisi.toLocaleString('tr-TR')})
            </span>
          </button>
        </div>

        {/* Hızlı Arama */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 w-full md:w-80">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ürün Kodu, OEM veya Ad..."
              className="w-full pl-8 pr-7 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg text-xs font-medium outline-none transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearch(''); setSayfa(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
          >
            Ara
          </button>
        </form>
      </div>

      {/* SADE VE DÜZENLİ ÜRÜN KARTLARI */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 size={28} className="animate-spin text-blue-600" />
          <span className="text-xs">Yükleniyor...</span>
        </div>
      ) : urunler.length === 0 ? (
        <div className="py-16 bg-white rounded-xl border border-slate-200 text-center p-6 space-y-2">
          <FileImage size={36} className="mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">Ürün Bulunamadı</h3>
          <p className="text-xs text-slate-400">Seçili filtrelere uygun ürün kaydı mevcut değil.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {urunler.map((urun) => {
            const isProcessingThis = processingKod === urun.urunkodu;
            const imgPath = `/images/urunler/${getCleanedCode(urun.urunkodu)}.jpg?v=${globalImageVersion}`;

            return (
              <div 
                key={urun.urunkodu}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden shadow-2xs group relative"
              >
                {/* Görsel Alanı */}
                <div 
                  className="w-full h-28 sm:h-36 bg-slate-50/60 relative flex items-center justify-center p-1.5 sm:p-2 border-b border-slate-100 cursor-pointer"
                  onClick={() => {
                    if (urun.gorselVar) {
                      setZoomGorsel({ src: imgPath, kod: urun.urunkodu, title: urun.urun });
                    }
                  }}
                >
                  {isProcessingThis ? (
                    <div className="flex flex-col items-center gap-1 text-blue-600">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="text-[9px] font-bold">Kaydediliyor...</span>
                    </div>
                  ) : urun.gorselVar ? (
                    <>
                      <img
                        src={imgPath}
                        alt={urun.urun}
                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== 'https://placehold.co/200x200?text=Yok') {
                            target.src = 'https://placehold.co/200x200?text=Yok';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-1.5 bg-white/90 text-slate-700 rounded-lg shadow-xs text-[10px] font-bold flex items-center gap-1">
                          <Maximize2 size={11} />
                        </span>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveUploadKod(urun.urunkodu);
                        singleFileInputRef.current?.click();
                      }}
                      className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Plus size={20} className="stroke-[2.5]" />
                      <span className="text-[10px] font-bold">Görsel Ekle</span>
                    </button>
                  )}
                </div>

                {/* Ürün Künyesi */}
                <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="font-mono font-bold text-slate-900 text-xs truncate" title={urun.urunkodu}>
                      {urun.urunkodu}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate" title={urun.urun}>
                      {urun.urun}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>{urun.Raf ? `Raf: ${urun.Raf}` : 'Raf yok'}</span>
                    <span className="font-semibold text-slate-600">{urun.MevcutBakiye} Ad</span>
                  </div>
                </div>

                {/* Hızlı Aksiyon Barı (Mobilde Kolay Dokunmatik Butonlar) */}
                <div className="p-1 sm:p-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCameraKod(urun.urunkodu);
                      singleCameraInputRef.current?.click();
                    }}
                    disabled={isProcessingThis}
                    className="flex-1 h-8 sm:h-7 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center justify-center shadow-2xs"
                    title="Kamera ile çek"
                  >
                    <Camera size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveUploadKod(urun.urunkodu);
                      singleFileInputRef.current?.click();
                    }}
                    disabled={isProcessingThis}
                    className="flex-1 h-8 sm:h-7 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center justify-center shadow-2xs"
                    title="Dosya seçip yükle"
                  >
                    <UploadCloud size={14} />
                  </button>

                  {urun.gorselVar && (
                    <button
                      type="button"
                      onClick={() => handleSingleDelete(urun.urunkodu)}
                      disabled={isProcessingThis}
                      className="h-8 sm:h-7 px-2.5 bg-white hover:bg-red-50 active:bg-red-100 text-red-500 rounded-lg border border-slate-200 transition-colors flex items-center justify-center shadow-2xs"
                      title="Görseli sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* SAYFALAMA */}
      {toplamSayfa > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200 text-xs">
          <span className="text-slate-500 text-center sm:text-left">
            Toplam <strong>{toplamKayit.toLocaleString('tr-TR')}</strong> üründen {(sayfa - 1) * limit + 1} - {Math.min(sayfa * limit, toplamKayit)} arası
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSayfa(p => Math.max(1, p - 1))}
              disabled={sayfa === 1 || loading}
              className="p-2 sm:p-1.5 bg-white border border-slate-200 disabled:opacity-40 rounded-lg hover:bg-slate-50 text-slate-700 active:scale-95 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-slate-700 px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs">
              {sayfa} / {toplamSayfa}
            </span>
            <button
              onClick={() => setSayfa(p => Math.min(toplamSayfa, p + 1))}
              disabled={sayfa === toplamSayfa || loading}
              className="p-2 sm:p-1.5 bg-white border border-slate-200 disabled:opacity-40 rounded-lg hover:bg-slate-50 text-slate-700 active:scale-95 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* SADE TOPLU YÜKLEME MODALI */}
      {showBulkModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => { if (!isBulkUploading) setShowBulkModal(false); }}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UploadCloud size={20} className="text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Toplu Görsel Yükle</h3>
              </div>
              <button
                onClick={() => { if (!isBulkUploading) setShowBulkModal(false); }}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div 
              onClick={() => bulkFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all space-y-2"
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <UploadCloud size={24} />
              </div>
              <div className="font-bold text-slate-800 text-sm">
                Fotoğrafları Seçin veya Buraya Bırakın
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Dosya adları (Örn: <code>112001.jpg</code>) otomatik olarak ürün kodları ile eşleşir.
              </p>
            </div>

            {/* İlerleme Çubuğu */}
            {isBulkUploading && bulkUploadProgress && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Yükleniyor...</span>
                  <span>{bulkUploadProgress.done} / {bulkUploadProgress.total}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${(bulkUploadProgress.done / bulkUploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                disabled={isBulkUploading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={isBulkUploading}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
              >
                Dosya Seç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX BÜYÜK GÖRSEL */}
      {zoomGorsel && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setZoomGorsel(null)}
        >
          <button
            onClick={() => setZoomGorsel(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={24} />
          </button>
          <div className="text-center text-white mb-2">
            <span className="font-mono font-bold">{zoomGorsel.kod}</span>
            <p className="text-xs text-white/70">{zoomGorsel.title}</p>
          </div>
          <img 
            src={zoomGorsel.src} 
            alt={zoomGorsel.title}
            className="max-w-3xl max-h-[75vh] object-contain rounded-lg" 
          />
        </div>
      )}

    </div>
  );
}
