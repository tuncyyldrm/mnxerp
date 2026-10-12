'use client';

import React from 'react';
import { Urun, getStokDurumu, getCleanedCode, formatPara } from './types';

interface UrunListeSatirProps {
  item: Urun;
  onClick: () => void;
}

export default function UrunListeSatir({ item, onClick }: UrunListeSatirProps) {
  const stokSayisi = Number(item.STK_FULL) || 0;
  const durum = getStokDurumu(stokSayisi);

  return (
    <tr
      onClick={onClick}
      className={`group transition-all duration-200 cursor-pointer
      ${durum.isYok
        ? 'bg-gray-50/50 hover:bg-red-50/30'
        : 'hover:bg-indigo-50/40'}`}
    >
      {/* Görsel ve Kod Bölümü */}
      <td className="px-6 py-4 w-[280px]">
        <div className="flex items-center gap-4">
          <div className="relative group/img">
            <div className={`w-16 h-16 rounded-xl border-2 p-1 transition-all
            ${durum.isYok ? 'border-slate-100 bg-slate-50' : 'border-white bg-white shadow-xs group-hover/img:border-blue-100'}`}>
              <img
                src={`/images/urunler/${getCleanedCode(item.urunkodu)}.jpg`}
                className="w-full h-full object-contain animate-in zoom-in-95 duration-200 select-none"
                alt={item.urun}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
                    target.src = 'https://placehold.co/400x400?text=Resim+Yok';
                  }
                }}
              />
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${durum.dot}`} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={`text-[14px] font-bold px-2 py-0.5 rounded border tracking-tight
            ${durum.isYok ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
              {item.urunkodu}
            </span>
          </div>
        </div>
      </td>

      {/* Ürün Tanımı */}
      <td className="px-6 py-4">
        <div className="max-w-[400px]">
          <h4 className={`text-[12px] font-bold leading-snug mb-2 uppercase
          ${durum.isYok ? 'text-slate-400' : 'text-slate-800'}`}>
            {item.urun}
          </h4>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border
            ${durum.isYok ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {durum.isYok ? 'STOK BEKLENİYOR' : `${stokSayisi} ADET STOKTA`}
            </span>
            <span className="text-[10px] text-slate-300 font-medium">|</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
              {item.grubu}
            </span>
          </div>
        </div>
      </td>

      {/* Referans / Marka */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 tracking-tighter">OEM</span>
          <span className={`text-[11px] font-semibold ${durum.isYok ? 'text-slate-400' : 'text-slate-600'}`}>
            {item.OEM || '—'}
          </span>
        </div>
      </td>

      {/* Raf / Konum */}
      <td className="px-6 py-4 text-center">
        <div className={`inline-block px-4 py-1.5 rounded-lg text-[11px] font-bold border transition-all
        ${durum.isYok
          ? 'bg-slate-50 text-slate-300 border-slate-100'
          : 'bg-white text-slate-700 border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-700 shadow-xs'}`}>
          {item.Raf || ' '}
        </div>
      </td>

      {/* Fiyat Alanı */}
      <td className="px-6 py-4 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-lg md:text-xl font-black tracking-tight transition-colors
          ${durum.isYok ? 'text-slate-300' : 'text-slate-900 group-hover:text-indigo-600'}`}>
            {formatPara(item.fiyatı)} <small className="text-[10px] font-bold">TL</small>
          </span>
          <div className="flex items-center gap-2">
            {durum.isKritik && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-black rounded uppercase">
                Kritik Seviye
              </span>
            )}
            <span className="text-[9px] text-slate-400 font-bold uppercase">KDV DAHİL</span>
          </div>
        </div>
      </td>
    </tr>
  );
}
