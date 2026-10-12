'use client';

import React, { useState, useEffect } from 'react';
import { Urun, CariSecim } from './types';

interface HizliSatisModalProps {
  urun: Urun | null;
  isOpen: boolean;
  onClose: () => void;
  onSatisBasarili: (islemNo: number) => void;
}

export default function HizliSatisModal({
  urun,
  isOpen,
  onClose,
  onSatisBasarili
}: HizliSatisModalProps) {
  const [cariAramaMetni, setCariAramaMetni] = useState('');
  const [bulunanCariler, setBulunanCariler] = useState<CariSecim[]>([]);
  const [seciliSatisCarisi, setSeciliSatisCarisi] = useState<CariSecim | null>(null);
  const [cariOneriGoster, setCariOneriGoster] = useState(false);

  const [satisMiktar, setSatisMiktar] = useState<number>(1);
  const [satisFiyat, setSatisFiyat] = useState<number>(urun?.fiyatı || 0);
  const [satisKdvOrani, setSatisKdvOrani] = useState<number>(20);
  const [satisIslemde, setSatisIslemde] = useState(false);

  // Dinamik Cari Arama (Debounced)
  useEffect(() => {
    if (cariAramaMetni.trim().length < 2) {
      return;
    }

    const filtreleCarileri = async () => {
      try {
        const res = await fetch(`/api/cariler?search=${encodeURIComponent(cariAramaMetni)}`);
        const data = await res.json();
        if (data.success) {
          setBulunanCariler(data.data || []);
        }
      } catch (err) {
        console.error('Cari arama hatası:', err);
      }
    };

    const timer = setTimeout(filtreleCarileri, 300);
    return () => clearTimeout(timer);
  }, [cariAramaMetni]);

  if (!isOpen || !urun) return null;

  const carilerGoster = cariAramaMetni.trim().length < 2 ? [] : bulunanCariler;

  const handleSatisKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliSatisCarisi || !urun) {
      alert('Lütfen listeden geçerli bir müşteri seçin.');
      return;
    }

    setSatisIslemde(true);
    try {
      const response = await fetch('/api/katalog-satis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cariId: seciliSatisCarisi.id,
          cariAdi: seciliSatisCarisi.id_name,
          urunAdi: urun.urun,
          stokKodu: urun.urunkodu,
          miktar: satisMiktar,
          birimFiyat: satisFiyat,
          kdvOrani: satisKdvOrani,
          birim: 'ADET'
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Satış Başarılı! Faturaya İşlendi. İşlem No: ${result.islemNo}`);
        onClose();
        onSatisBasarili(result.islemNo);
      } else {
        alert(`Hata: ${result.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      alert(`Sistem Hatası: ${msg}`);
    } finally {
      setSatisIslemde(false);
    }
  };

  const toplamKdvDahil = (satisMiktar * satisFiyat) * (1 + satisKdvOrani / 100);

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
      {/* Arka Plan Karartısı */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={() => { if (!satisIslemde) onClose(); }}
      />

      <div className="bg-white w-full max-w-[500px] relative shadow-2xl flex flex-col overflow-hidden rounded-t-2xl md:rounded-2xl z-10 animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Başlık */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Katalog Hızlı Satış</span>
            <h3 className="text-sm font-black text-slate-800 uppercase font-mono">{urun.urunkodu}</h3>
          </div>
          <button 
            onClick={onClose}
            disabled={satisIslemde}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSatisKaydet} className="p-4 space-y-4">
          
          {/* CARİ / MÜŞTERİ SEÇİM ALANI */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Müşteri / Cari Seçimi
            </label>
            
            {!seciliSatisCarisi ? (
              <>
                <input
                  type="text"
                  value={cariAramaMetni}
                  onChange={(e) => { setCariAramaMetni(e.target.value); setCariOneriGoster(true); }}
                  onFocus={() => setCariOneriGoster(true)}
                  placeholder="Müşteri adı yazın (En az 2 harf)..."
                  className="w-full p-2.5 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
                {/* Öneri Listesi Dropdown */}
                {cariOneriGoster && carilerGoster.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-[160px] overflow-y-auto z-50 custom-scrollbar">
                    {carilerGoster.map((cari) => (
                      <button
                        key={cari.id}
                        type="button"
                        onClick={() => {
                          setSeciliSatisCarisi(cari);
                          setCariOneriGoster(false);
                        }}
                        className="w-full text-left p-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 border-b border-slate-50 transition-colors uppercase"
                      >
                        {cari.id_name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-xs font-black text-blue-800 uppercase font-mono">{seciliSatisCarisi.id_name}</span>
                <button
                  type="button"
                  onClick={() => setSeciliSatisCarisi(null)}
                  className="text-[10px] font-bold text-red-500 hover:underline px-2"
                >
                  Değiştir
                </button>
              </div>
            )}
          </div>

          {/* ÜRÜN ADI BİLGİSİ */}
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Satılacak Ürün</span>
            <p className="text-xs font-mono font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 uppercase">
              {urun.urun}
            </p>
          </div>

          {/* MİKTAR & FİYAT GRID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Miktar (Adet)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={satisMiktar}
                onChange={(e) => setSatisMiktar(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2.5 text-xs font-black border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Birim Fiyat (KDV Hariç)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={satisFiyat}
                onChange={(e) => setSatisFiyat(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-2.5 text-xs font-black border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {/* KDV SEÇİMİ */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">KDV Oranı</label>
            <select
              value={satisKdvOrani}
              onChange={(e) => setSatisKdvOrani(parseInt(e.target.value))}
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value={20}>%20 (Standart)</option>
              <option value={10}>%10</option>
              <option value={1}>%1</option>
              <option value={0}>%0 (Muaf)</option>
            </select>
          </div>

          {/* TOPLAM ÖZET PANELİ */}
          <div className="p-3 bg-slate-900 text-white rounded-xl flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">GENEL TOPLAM (KDV DAHİL)</span>
            <span className="text-base font-black font-mono">
              {toplamKdvDahil.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </span>
          </div>

          {/* EYLEM BUTONLARI */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={satisIslemde}
              onClick={onClose}
              className="flex-1 p-3 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg uppercase tracking-wider transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={satisIslemde || !seciliSatisCarisi}
              className="flex-1 p-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              {satisIslemde ? 'Faturaya İşleniyor...' : 'Satışı Onayla'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
