'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Camera, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Loader2, 
  Sparkles, 
  FolderUp, 
  Check, 
  X,
  FileImage,
  AlertCircle
} from 'lucide-react';
import { getCleanedCode, formatPara } from '@/components/katalog/types';

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
  // Veri ve Listeleme Durumları
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
  const [grubuFiltre, setGrubuFiltre] = useState('');

  // Toplu Yükleme Durumları (Drag & Drop)
  const [isDragging, setIsDragging] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ total: number; done: number; success: number; fail: number } | null>(null);
  const [bulkLog, setBulkLog] = useState<Array<{ name: string; status: 'ok' | 'error'; msg?: string }>>([]);

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

  // Bildirim gösterme yardımcısı
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
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
      if (grubuFiltre) params.append('grubu', grubuFiltre);

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
        showToast('error', data.error || 'Veri alınamadı.');
      }
    } catch (err: unknown) {
      showToast('error', 'Sunucu ile iletişim hatası.');
    } finally {
      setLoading(false);
    }
  }, [sayfa, limit, durumFiltre, search, grubuFiltre]);

  useEffect(() => {
    fetchUrunler();
  }, [fetchUrunler]);

  // Arama formu submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSayfa(1);
    setSearch(searchInput.trim());
  };

  // Toplu Dosya Yükleme Fonksiyonu
  const handleBulkUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      showToast('error', 'Lütfen geçerli resim dosyaları (JPG, PNG, WEBP) seçin.');
      return;
    }

    setIsBulkUploading(true);
    setBulkUploadProgress({ total: fileArray.length, done: 0, success: 0, fail: 0 });
    setBulkLog([]);

    const batchSize = 10; // 10'arlı paketler halinde sunucuyu zorlamadan yükle
    let successCount = 0;
    let failCount = 0;
    const newLogs: Array<{ name: string; status: 'ok' | 'error'; msg?: string }> = [];

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
            if (s.durum === 'basarili') {
              successCount++;
              newLogs.unshift({ name: s.dosyaAdi, status: 'ok' });
            } else {
              failCount++;
              newLogs.unshift({ name: s.dosyaAdi, status: 'error', msg: s.mesaj });
            }
          });
        } else {
          failCount += currentBatch.length;
          currentBatch.forEach(f => newLogs.unshift({ name: f.name, status: 'error', msg: data.error || 'Hata' }));
        }
      } catch (err: unknown) {
        failCount += currentBatch.length;
        currentBatch.forEach(f => newLogs.unshift({ name: f.name, status: 'error', msg: 'Bağlantı koptu' }));
      }

      setBulkUploadProgress({
        total: fileArray.length,
        done: Math.min(i + batchSize, fileArray.length),
        success: successCount,
        fail: failCount
      });
      setBulkLog([...newLogs]);
    }

    setIsBulkUploading(false);
    setGlobalImageVersion(Date.now());
    showToast('success', `${successCount} görsel sisteme başarıyla işlendi!`);
    fetchUrunler();
  };

  // Tekil Görsel Yükleme (Dosya veya Kamera)
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
        showToast('success', `${urunKodu} görseli başarıyla yüklendi.`);
        setGlobalImageVersion(Date.now());
        // Listeyi anlık güncelle
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
      showToast('error', 'Görsel yüklenirken bağlantı hatası oluştu.');
    } finally {
      setProcessingKod(null);
    }
  };

  // Tekil Görsel Silme
  const handleSingleDelete = async (urunKodu: string) => {
    if (!confirm(`${urunKodu} kodlu ürünün görselini silmek istediğinize emin misiniz?`)) return;

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
        showToast('error', data.error || 'Silme başarısız.');
      }
    } catch {
      showToast('error', 'Görsel silinirken hata oluştu.');
    } finally {
      setProcessingKod(null);
    }
  };

  // Drag & Drop Olayları
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBulkUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Gizli Tekli Inputlar */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeUploadKod) {
            handleSingleUpload(file, activeUploadKod);
          }
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
          if (file && activeCameraKod) {
            handleSingleUpload(file, activeCameraKod);
          }
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
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-bold text-white transition-all transform animate-in slide-in-from-bottom-4 ${
          toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ÜST BAŞLIK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ImageIcon size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Görsel Yönetim Merkezi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Katalog ürün fotoğraflarını yükleyin, otomatik eşleyin, eksikleri tespit edin ve yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => bulkFileInputRef.current?.click()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <FolderUp size={16} />
            <span>Toplu Görsel Seç</span>
          </button>
          <button
            onClick={fetchUrunler}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Listeyi Yenile"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Toplam Ürün */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Toplam Stok Kaydı
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {istatistik.toplamUrun.toLocaleString('tr-TR')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Veritabanındaki aktif ürünler
          </div>
        </div>

        {/* Görseli Olanlar */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Görseli Mevcut</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">
            {istatistik.gorselliSayisi.toLocaleString('tr-TR')}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Fotoğrafı yüklenmiş ürünler
          </div>
        </div>

        {/* Görselsiz (Eksikler) */}
        <div 
          onClick={() => { setDurumFiltre('gorselsiz'); setSayfa(1); }}
          className="bg-white p-4 rounded-2xl border border-amber-300 bg-amber-50/30 shadow-xs cursor-pointer hover:border-amber-400 transition-all group"
        >
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>Görseli Eksik Olanlar</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 group-hover:scale-105 transition-transform inline-block">
            {istatistik.gorselsizSayisi.toLocaleString('tr-TR')}
          </div>
          <div className="text-[11px] text-amber-700 font-bold mt-1 underline">
            Eksikleri Görmek İçin Tıklayın →
          </div>
        </div>

        {/* Doluluk Oranı */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>Katalog Doluluk Oranı</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">
            %{istatistik.dolulukOrani}
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${istatistik.dolulukOrani}%` }}
            />
          </div>
        </div>
      </div>

      {/* TOPLU SÜRÜKLE & BIRAK YÜKLEME ALANI */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging 
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]' 
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/60 shadow-xs'
        }`}
        onClick={() => bulkFileInputRef.current?.click()}
      >
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
          <UploadCloud size={32} />
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-800">
          Fotoğrafları Buraya Sürükleyip Bırakın
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mt-1">
          Dosya isimleri ürün kodu ile eşleşecek şekilde otomatik temizlenir (Örn: <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono">112001OEM.png</code> veya <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono">20-001.webp</code>). Arka plan otomatik beyazlatılır ve 1000x1000 JPG formatına optimize edilir.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs">
            Dosya Seç veya Sürükle
          </span>
          <span className="text-xs text-slate-400">Tek seferde 500+ görsel yüklenebilir</span>
        </div>
      </div>

      {/* TOPLU YÜKLEME İLERLEME ÇUBUĞU */}
      {isBulkUploading && bulkUploadProgress && (
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span>Görseller İşleniyor ve Optimize Ediliyor...</span>
            </span>
            <span className="font-mono font-bold text-blue-600">
              {bulkUploadProgress.done} / {bulkUploadProgress.total} (%{Math.round((bulkUploadProgress.done / bulkUploadProgress.total) * 100)})
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${(bulkUploadProgress.done / bulkUploadProgress.total) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-600">✅ Başarılı: {bulkUploadProgress.success}</span>
            <span className="text-red-500">❌ Hatalı: {bulkUploadProgress.fail}</span>
          </div>
        </div>
      )}

      {/* ARAMA VE FİLTRELEME ÇUBUĞU */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Durum Filtre Butonları (Tümü / Görselli / Görselsiz) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full md:w-auto">
            <button
              onClick={() => { setDurumFiltre('all'); setSayfa(1); }}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                durumFiltre === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tümü ({istatistik.toplamUrun})
            </button>
            <button
              onClick={() => { setDurumFiltre('gorselsiz'); setSayfa(1); }}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                durumFiltre === 'gorselsiz' ? 'bg-amber-500 text-slate-950 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>❌ Görselsiz Ürünler</span>
              <span className="bg-amber-600/20 text-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                {istatistik.gorselsizSayisi}
              </span>
            </button>
            <button
              onClick={() => { setDurumFiltre('gorselli'); setSayfa(1); }}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                durumFiltre === 'gorselli' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>✅ Görselli</span>
              <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[10px]">
                {istatistik.gorselliSayisi}
              </span>
            </button>
          </div>

          {/* Arama Kutusu */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ürün Kodu, Açıklama, OEM veya Raf..."
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs sm:text-sm font-medium outline-none transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setSayfa(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors"
            >
              Ara
            </button>
          </form>
        </div>
      </div>

      {/* ÜRÜN KARTLARI GRİDİ */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-blue-600" />
          <span className="text-sm font-medium">Ürünler ve görseller taranıyor...</span>
        </div>
      ) : urunler.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
          <FileImage size={48} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">Hiçbir Ürün Bulunamadı</h3>
          <p className="text-xs text-slate-500">Seçili filtrelere uygun ürün kaydı mevcut değil.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {urunler.map((urun) => {
            const isProcessingThis = processingKod === urun.urunkodu;
            const imgPath = `/images/urunler/${getCleanedCode(urun.urunkodu)}.jpg?v=${globalImageVersion}`;

            return (
              <div 
                key={urun.urunkodu}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative shadow-xs hover:shadow-md ${
                  urun.gorselVar ? 'border-slate-200' : 'border-amber-200/80 bg-amber-50/10'
                }`}
              >
                {/* Ürün Durum Rozeti */}
                <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1">
                  {urun.gorselVar ? (
                    <span className="px-2 py-0.5 bg-emerald-100/90 text-emerald-800 font-bold text-[9px] rounded-md backdrop-blur-xs flex items-center gap-1">
                      <Check size={10} />
                      <span>Görsel Var</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100/90 text-amber-800 font-bold text-[9px] rounded-md backdrop-blur-xs flex items-center gap-1">
                      <AlertTriangle size={10} />
                      <span>Görsel Eksik</span>
                    </span>
                  )}
                </div>

                {/* Raf Rozeti */}
                {urun.Raf && (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="px-2 py-0.5 bg-slate-900/70 text-white font-mono font-bold text-[9px] rounded-md backdrop-blur-xs">
                      {urun.Raf}
                    </span>
                  </div>
                )}

                {/* Görsel Önizleme Alanı */}
                <div 
                  className="w-full h-44 bg-slate-50 relative flex items-center justify-center p-3 border-b border-slate-100 group cursor-pointer"
                  onClick={() => {
                    if (urun.gorselVar) {
                      setZoomGorsel({
                        src: imgPath,
                        kod: urun.urunkodu,
                        title: urun.urun
                      });
                    }
                  }}
                >
                  {isProcessingThis ? (
                    <div className="flex flex-col items-center gap-1.5 text-blue-600">
                      <Loader2 size={24} className="animate-spin" />
                      <span className="text-[10px] font-bold">İşleniyor...</span>
                    </div>
                  ) : urun.gorselVar ? (
                    <>
                      <img
                        src={imgPath}
                        alt={urun.urun}
                        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== 'https://placehold.co/300x300?text=Resim+Yok') {
                            target.src = 'https://placehold.co/300x300?text=Resim+Yok';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-2 bg-white/95 text-slate-800 rounded-xl shadow-md text-xs font-bold flex items-center gap-1">
                          <Maximize2 size={13} />
                          <span>Büyüt</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                      <FileImage size={40} />
                      <span className="text-[11px] font-bold text-slate-400">Görsel Yüklenmemiş</span>
                    </div>
                  )}
                </div>

                {/* Ürün Bilgileri */}
                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                      <span>{urun.grubu || 'GENEL'}</span>
                      {urun.kategori && <span>• {urun.kategori}</span>}
                    </div>

                    <h4 className="font-mono font-bold text-slate-900 text-sm tracking-tight truncate mt-0.5">
                      {urun.urunkodu}
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5" title={urun.urun}>
                      {urun.urun}
                    </p>
                  </div>

                  {/* Stok ve OEM */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Stok: <strong className="text-slate-800">{urun.MevcutBakiye} Adet</strong>
                    </span>
                    {urun.OEM && (
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={urun.OEM}>
                        OEM: {urun.OEM}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hızlı Aksiyon Butonları (Fotoğraf Çek / Dosya Seç / Sil) */}
                <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCameraKod(urun.urunkodu);
                      singleCameraInputRef.current?.click();
                    }}
                    disabled={isProcessingThis}
                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs"
                    title="Kamera ile çek"
                  >
                    <Camera size={12} />
                    <span>Çek</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveUploadKod(urun.urunkodu);
                      singleFileInputRef.current?.click();
                    }}
                    disabled={isProcessingThis}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 disabled:bg-slate-50 text-slate-700 font-bold text-[10px] rounded-lg transition-all border border-slate-200 flex items-center justify-center gap-1"
                    title="Dosya seçip yükle"
                  >
                    <FolderUp size={12} />
                    <span>{urun.gorselVar ? 'Değiştir' : 'Yükle'}</span>
                  </button>

                  {urun.gorselVar && (
                    <button
                      type="button"
                      onClick={() => handleSingleDelete(urun.urunkodu)}
                      disabled={isProcessingThis}
                      className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-colors border border-red-200 flex items-center justify-center"
                      title="Görseli sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* SAYFALAMA (PAGINATION) */}
      {toplamSayfa > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Toplam <strong className="text-slate-800">{toplamKayit}</strong> üründen <strong>{(sayfa - 1) * limit + 1}</strong> - <strong>{Math.min(sayfa * limit, toplamKayit)}</strong> arası gösteriliyor.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSayfa(p => Math.max(1, p - 1))}
              disabled={sayfa === 1 || loading}
              className="p-2 bg-white border border-slate-200 disabled:opacity-40 rounded-xl hover:bg-slate-50 transition-colors text-slate-700"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-700 px-3">
              Sayfa {sayfa} / {toplamSayfa}
            </span>
            <button
              onClick={() => setSayfa(p => Math.min(toplamSayfa, p + 1))}
              disabled={sayfa === toplamSayfa || loading}
              className="p-2 bg-white border border-slate-200 disabled:opacity-40 rounded-xl hover:bg-slate-50 transition-colors text-slate-700"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX BÜYÜK GÖRSEL MODALI */}
      {zoomGorsel && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setZoomGorsel(null)}
        >
          <button
            onClick={() => setZoomGorsel(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all"
          >
            <X size={24} />
          </button>

          <div className="text-center text-white mb-3">
            <span className="font-mono font-bold text-lg">{zoomGorsel.kod}</span>
            <p className="text-xs text-white/70">{zoomGorsel.title}</p>
          </div>

          <div className="max-w-4xl max-h-[80vh] flex items-center justify-center p-2">
            <img 
              src={zoomGorsel.src} 
              alt={zoomGorsel.title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" 
            />
          </div>
        </div>
      )}

    </div>
  );
}
