'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { Urun, StokHareketi, KRITIK_STOK_ESIGI, formatPara, getCleanedCode } from './types';

interface UrunDetayModalProps {
  urun: Urun | null;
  isOpen: boolean;
  onClose: () => void;
  onUrunGuncellendi: (yeniUrun: Urun) => void;
  onSatisYap: (urun: Urun) => void;
}

export default function UrunDetayModal({
  urun,
  isOpen,
  onClose,
  onUrunGuncellendi,
  onSatisYap
}: UrunDetayModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Görsel yönetimi durumları
  const [imageVersion, setImageVersion] = useState(Date.now());
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [imageMsg, setImageMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasValidImage, setHasValidImage] = useState<boolean>(true);

  // Düzenleme modunda geçici (staged) görsel değişiklikleri
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageDelete, setPendingImageDelete] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    urun: urun?.urun || '',
    urunalt: urun?.urunalt || '',
    Raf: urun?.Raf || '',
    oems: [
      urun?.OEM_0 || urun?.OEM || '',
      urun?.OEM_1 || '',
      urun?.OEM_2 || '',
      urun?.OEM_3 || '',
      urun?.OEM_4 || ''
    ]
  });

  const [hareketler, setHareketler] = useState<StokHareketi[]>([]);
  const [loadingHareket, setLoadingHareket] = useState(true);

  // Escape tuşuyla zoom kapatma
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const urunKodu = urun?.urunkodu;

  // Ürün değiştiğinde görsel sürümünü ve bekleyen değişiklikleri sıfırla
  useEffect(() => {
    setImageVersion(Date.now());
    setHasValidImage(true);
    setImageMsg(null);
    setPendingImageFile(null);
    setPendingImageDelete(false);
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(null);
    }
  }, [urunKodu]);

  // Düzenleme modunda yeni görsel seçildiğinde (Kaydet'e basana kadar bekletilir)
  const handleSelectImageForEditing = (file: File) => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingImageDelete(false);
    setPreviewImageUrl(previewUrl);
    setHasValidImage(true);
  };

  // Düzenleme modunda görseli silme isteği (Kaydet'e basana kadar bekletilir)
  const handleStageImageDelete = () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPendingImageFile(null);
    setPendingImageDelete(true);
    setPreviewImageUrl('https://placehold.co/400x400?text=G%C3%B6rsel+Silinecek');
  };

  // Düzenlemeyi İptal Et
  const handleCancelEditing = () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(null);
    }
    setPendingImageFile(null);
    setPendingImageDelete(false);
    setIsEditing(false);
  };

  useEffect(() => {
    let ignore = false;
    if (!urunKodu) return;

    fetch(`/api/stok-hareket?detayKodu=${encodeURIComponent(urunKodu)}`)
      .then(res => res.json())
      .then(data => {
        if (!ignore) {
          setHareketler(Array.isArray(data) ? data : []);
          setLoadingHareket(false);
        }
      })
      .catch(err => {
        if (!ignore) {
          console.error('Stok hareketleri yüklenemedi:', err);
          setLoadingHareket(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [urunKodu]);

  if (!isOpen || !urun) return null;

  const stokSayisi = Number(urun.STK_FULL ?? urun.MevcutBakiye) || 0;
  const isStoktaYok = stokSayisi <= 0;
  const isStokKritik = stokSayisi > 0 && stokSayisi <= KRITIK_STOK_ESIGI;

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

  const handleUrunKaydet = async () => {
    setIsSaving(true);
    try {
      // 1. Ürün Metin ve Raf Bilgilerini Kaydet
      const response = await fetch('/api/urun-duzenle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urunKodu: urun.urunkodu,
          urunAd: editForm.urun,
          raf: editForm.Raf,
          oems: editForm.oems
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Bilgiler güncellenemedi.');

      // 2. Bekleyen Görsel Değişikliği Varsa Uygula
      if (pendingImageDelete) {
        await fetch('/api/gorsel/sil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urunkodu: urun.urunkodu }),
        });
        setHasValidImage(false);
      } else if (pendingImageFile) {
        const formData = new FormData();
        formData.append('urunkodu', urun.urunkodu);
        formData.append('file', pendingImageFile);

        const imgRes = await fetch('/api/gorsel/yukle', {
          method: 'POST',
          body: formData,
        });
        const imgData = await imgRes.json();
        if (!imgRes.ok || !imgData.success) {
          throw new Error(imgData.error || 'Görsel kaydedilemedi.');
        }
        setHasValidImage(true);
      }

      // 3. Başarıyla tamamlandı, durumları güncelle
      setImageVersion(Date.now());
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        setPreviewImageUrl(null);
      }
      setPendingImageFile(null);
      setPendingImageDelete(false);

      const guncelUrun: Urun = {
        ...urun,
        urun: editForm.urun,
        urunalt: editForm.urunalt,
        Raf: editForm.Raf,
        OEM_0: editForm.oems[0],
        OEM_1: editForm.oems[1],
        OEM_2: editForm.oems[2],
        OEM_3: editForm.oems[3],
        OEM_4: editForm.oems[4]
      };

      onUrunGuncellendi(guncelUrun);
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      alert('Hata: ' + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const oemListesi = [
    urun.OEM, urun.OEM_0, urun.OEM_1, urun.OEM_2, urun.OEM_3,
    urun.OEM_4, urun.OEM_5, urun.OEM_6, urun.OEM_7,
    urun.OEM_8, urun.OEM_9
  ].filter(oem => oem && oem.trim() !== '');

  const urunBarkodYazdir = () => {
    const oemMetni = [
      urun.OEM, urun.OEM_1, urun.OEM_2, urun.OEM_3,
      urun.OEM_4, urun.OEM_5, urun.OEM_6, urun.OEM_7,
      urun.OEM_8, urun.OEM_9
    ].filter(oem => oem && oem.trim() !== '').join(' - ');

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
      {/* Arka Plan Karartısı */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => { if (!isSaving && !isZoomed) { onClose(); setIsEditing(false); } }}
      />

      <div className="bg-white w-full max-w-[1000px] relative shadow-2xl flex flex-col md:flex-row overflow-hidden h-screen md:h-auto md:max-h-[85vh] z-10 animate-in slide-in-from-bottom-6 duration-300 rounded-none md:rounded-2xl">

        <button
          onClick={() => { onClose(); setIsEditing(false); }}
          disabled={isSaving}
          className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 bg-slate-100/90 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center z-[130] transition-colors shadow-xs disabled:opacity-50"
        >
          <span className="text-xs font-black">✕</span>
        </button>

        {/* SOL: ÜRÜN GÖRSELİ & YÖNETİM ALANI */}
        <div className="w-full md:w-[42%] bg-slate-50/70 p-4 md:p-6 flex flex-col justify-between items-center relative border-b md:border-b-0 md:border-r border-slate-100 shrink-0 min-h-[360px] md:min-h-0">
          
          {/* Gizli Dosya ve Kamera Inputları */}
          {/* Gizli Dosya ve Kamera Inputları (Sadece Düzenleme Modunda Çalışır) */}
          {isEditing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectImageForEditing(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectImageForEditing(file);
                  e.target.value = '';
                }}
              />
            </>
          )}

          {/* Üst Rozetler */}
          <div className="w-full flex items-center justify-between mb-2">
            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight shadow-xs ${isStoktaYok ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {isStoktaYok ? '● Stokta Yok' : '● Stokta Mevcut'}
            </span>

            {isEditing && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 animate-in fade-in">
                ✏️ Düzenleme Modu
              </span>
            )}
          </div>

          {/* Görsel Kutusu */}
          <div 
            className={`w-full flex-1 flex items-center justify-center relative group min-h-[220px] max-h-[300px] bg-white rounded-xl border p-2 shadow-xs overflow-hidden transition-all ${
              isEditing ? 'border-blue-400 ring-2 ring-blue-500/10' : 'border-slate-200/80 cursor-zoom-in'
            }`} 
            onClick={() => { if (!isSaving && !isEditing) setIsZoomed(true); }}
          >
            {isSaving && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xs z-30 flex flex-col items-center justify-center gap-2">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <span className="text-xs font-bold text-slate-700">Kaydediliyor...</span>
              </div>
            )}

            <img
              key={`${urun.urunkodu}-${imageVersion}-${previewImageUrl || 'orig'}`}
              src={previewImageUrl || `/images/urunler/${getCleanedCode(urun.urunkodu)}.jpg?v=${imageVersion}`}
              className="w-full h-full object-contain p-2 transition-transform hover:scale-[1.03]"
              alt={urun.urun}
              onLoad={() => { if (!pendingImageDelete) setHasValidImage(true); }}
              onError={(e) => {
                setHasValidImage(false);
                const target = e.currentTarget;
                if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
                  target.src = 'https://placehold.co/400x400?text=Resim+Yok';
                }
              }}
            />

            {!isEditing && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex bg-black/10 rounded-xl pointer-events-none">
                <span className="bg-slate-900/80 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-xs shadow-md">
                  🔍 Büyütmek için tıkla
                </span>
              </div>
            )}
          </div>

          {/* DÜZENLEME MODU GÖRSEL KONTROLLERİ (Yalnızca Düzenle açıkken görünür) */}
          {isEditing ? (
            <div className="w-full mt-3 pt-3 border-t border-blue-200/60 flex flex-col gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSaving}
                  className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  title="Kamera ile yeni fotoğraf çek"
                >
                  <Camera size={13} />
                  <span>Fotoğraf Çek</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                  title="Dosya seç"
                >
                  <Upload size={13} />
                  <span>Görsel Seç</span>
                </button>

                {hasValidImage && !pendingImageDelete && (
                  <button
                    type="button"
                    onClick={handleStageImageDelete}
                    disabled={isSaving}
                    className="py-1.5 px-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 font-bold text-[11px] rounded-lg transition-colors border border-red-200 flex items-center justify-center gap-1"
                    title="Görseli kaldır"
                  >
                    <Trash2 size={13} />
                    <span className="hidden sm:inline">Kaldır</span>
                  </button>
                )}
              </div>

              {/* Bekleyen Görsel Değişiklik Bildirimi */}
              {pendingImageFile && (
                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md text-center">
                  ✓ Yeni görsel seçildi. Uygulamak için sağ alttan <strong>Kaydet</strong>'e basınız.
                </div>
              )}

              {pendingImageDelete && (
                <div className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-md text-center">
                  ⚠️ Görsel kaldırılacak. Onaylamak için sağ alttan <strong>Kaydet</strong>'e basınız.
                </div>
              )}
            </div>
          ) : (
            <div className="w-full mt-2 text-center">
              <span className="text-[10px] text-slate-400">
                Görseli değiştirmek için <strong className="text-slate-600">Düzenle</strong> butonuna basınız
              </span>
            </div>
          )}

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
                  src={`/images/urunler/${getCleanedCode(urun.urunkodu)}.jpg?v=${imageVersion}`}
                  className="w-full h-full object-contain animate-in zoom-in-95 duration-200 select-none"
                  alt={urun.urun}
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
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">{urun.grubu}</span>
                <span className="text-slate-300 text-[9px]">/</span>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{urun.kateGOri}</span>
              </div>
              <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight uppercase">
                {urun.urunkodu}
              </h2>
              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="block text-[8px] font-bold text-blue-600 uppercase mb-1">Ürün Açıklaması</label>
                    <textarea
                      value={editForm.urun}
                      onChange={e => handleInputChange('urun', e.target.value)}
                      className="w-full p-2 text-xs font-mono border border-blue-300 rounded-lg bg-blue-50/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-blue-600 uppercase mb-1">Alt Açıklama</label>
                    <textarea
                      value={editForm.urunalt}
                      onChange={e => handleInputChange('urunalt', e.target.value)}
                      className="w-full p-2 text-xs font-mono border border-blue-300 rounded-lg bg-blue-50/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-0.5">
                  <p className="text-slate-500 text-xs font-mono break-words uppercase">{urun.urun}</p>
                  {urun.urunalt && <p className="text-slate-400 text-[11px] font-mono break-words uppercase">{urun.urunalt}</p>}
                </div>
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
                        <label className="block text-[7px] text-slate-400 font-bold uppercase">
                          {idx === 0 ? 'OEM' : `OEM-${idx}`}
                        </label>
                        <input
                          type="text"
                          value={oem}
                          onChange={e => handleOemChange(idx, e.target.value)}
                          className="w-full p-1.5 text-[10px] font-semibold bg-white border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500"
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
                      className="w-full mt-1 p-1 text-center text-xs font-bold bg-white border border-slate-200 rounded-sm focus:outline-none focus:border-blue-500"
                      placeholder="Raf No"
                    />
                  ) : (
                    <span className="text-xs md:text-sm font-bold text-slate-800">{urun.Raf || "-"}</span>
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
                                {h.BirimFiyat && !isNaN(Number(h.BirimFiyat)) ? Number(h.BirimFiyat).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : "-"}
                              </td>
                              <td className="py-1 text-right font-bold">
                                {Number(h.Giris || 0) > 0 ? <span className="text-emerald-600">+{h.Giris}</span> : <span className="text-rose-600">-{h.Cikis || 0}</span>}
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
                <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{formatPara(urun.fiyatı)}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">TL</span>
              </div>
            </div>

            {/* DİNAMİK BUTON GRUBU */}
            <div className="flex flex-1 md:flex-none justify-end gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className="px-4 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 active:scale-[0.98] disabled:opacity-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleUrunKaydet}
                    disabled={isSaving}
                    className="px-5 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 flex items-center gap-1.5 transition-colors"
                  >
                    {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditForm({
                        urun: urun.urun,
                        urunalt: urun.urunalt || '',
                        Raf: urun.Raf || '',
                        oems: [
                          urun.OEM_0 || urun.OEM || '',
                          urun.OEM_1 || '',
                          urun.OEM_2 || '',
                          urun.OEM_3 || '',
                          urun.OEM_4 || ''
                        ]
                      });
                      setIsEditing(true);
                    }}
                    className="px-3 md:px-4 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-slate-800 text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span>Düzenle</span>
                  </button>

                  <button
                    onClick={urunBarkodYazdir}
                    className="px-3 md:px-5 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h10M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
                    <span className="hidden sm:inline">Barkod</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onSatisYap(urun);
                    }}
                    className="px-3 md:px-4 h-10 md:h-12 rounded-lg font-bold text-[10px] tracking-wider uppercase bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Hızlı Satış</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
