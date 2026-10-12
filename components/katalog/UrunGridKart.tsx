'use client';

import React from 'react';
import { Urun, getStokDurumu, getCleanedCode, formatPara } from './types';

interface UrunGridKartProps {
  item: Urun;
  onClick: () => void;
}

export default function UrunGridKart({ item, onClick }: UrunGridKartProps) {
  const stokSayisi = Number(item.STK_FULL) || 0;
  const durum = getStokDurumu(stokSayisi);

  return (
    <article
      onClick={onClick}
      className={`bg-white p-3 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] border transition-all cursor-pointer group flex flex-col h-full active:scale-[0.98] relative
      ${durum.isYok
        ? 'border-red-200 opacity-80'
        : 'border-green-200 hover:shadow-2xl hover:border-blue-400 shadow-xs'
      }`}
    >
      {/* ÜST GÖRSEL ALANI */}
      <div className={`aspect-square rounded-[1.1rem] md:rounded-[1.4rem] mb-3 md:mb-5 flex items-center justify-center overflow-hidden p-2 md:p-4 relative shadow-inner transition-colors
      ${durum.isYok ? 'bg-slate-0' : 'bg-slate-0 group-hover:bg-blue-0/0'}`}
      >
        {/* SOL ÜST: Dinamik Stok Durumu ve Adet */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          <span className={`px-2 py-1 rounded-lg text-[7px] md:text-[8px] font-black border shadow-xs uppercase tracking-tighter transition-transform group-hover:scale-105 flex items-center gap-1
          ${durum.bg} ${durum.text} ${durum.border}`}>
            {durum.label}
            {!durum.isYok && <span className="opacity-60 ml-1">({stokSayisi} ADET)</span>}
          </span>
        </div>

        {/* SAĞ ÜST: Katalog Kodu */}
        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-lg text-[12px] md:text-[15px] font-black text-slate-500 border border-slate-100 shadow-xs uppercase z-10">
          {item.urunkodu}
        </span>

        <img
          src={`/images/urunler/${getCleanedCode(item.urunkodu)}.jpg`}
          alt={item.urun}
          className={`max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 
          ${durum.isYok ? 'opacity-95' : 'grayscale-0'}`}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== 'https://placehold.co/400x400?text=Resim+Yok') {
              target.src = 'https://placehold.co/400x400?text=Resim+Yok';
            }
          }}
        />

        {/* SAĞ ALT: Net Stok Bilgisi */}
        <div className="absolute bottom-2 right-2">
          <div className={`px-2 py-1 rounded-md text-[7px] md:text-[8px] font-bold border backdrop-blur-xs shadow-xs
          ${durum.bg}/80 ${durum.text} ${durum.border}`}>
            {durum.isYok ? 'TEMİN EDİLECEK' : `MEVCUT: ${stokSayisi}`}
          </div>
        </div>

        {/* SOL ALT: Kritik Stok Uyarı Işığı */}
        <div className="absolute bottom-2 left-2">
          {durum.isKritik && (
            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded-full border border-orange-200 shadow-xs animate-bounce">
              <span className={`w-1.5 h-1.5 ${durum.dot} rounded-full animate-ping`} />
              <span className="text-[7px] font-black text-orange-600 uppercase">TÜKENİYOR</span>
            </div>
          )}
        </div>
      </div>

      {/* ÜRÜN BİLGİLERİ */}
      <div className="flex-1">
        <p className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest mb-1 
        ${durum.isYok ? 'text-slate-400' : 'text-blue-500'}`}>
          {item.grubu}
        </p>

        <h3 className={`text-[8px] md:text-[10px] font-bold line-clamp-2 min-h-[2.5rem] leading-tight mb-3 uppercase transition-colors
        ${durum.isYok ? 'text-slate-500' : 'text-slate-800 group-hover:text-blue-600'}`}>
          {item.urun} {item.urunalt && <span className="block text-slate-400 font-normal">{item.urunalt}</span>}
        </h3>
      </div>

      {/* ALT BAR: Fiyat ve Raf */}
      <div className={`mt-auto flex justify-between items-center pt-3 border-t 
      ${durum.isYok ? 'border-slate-100' : 'border-slate-200'}`}>

        <div className="flex flex-col">
          <span className={`text-xs md:text-base font-black tracking-tighter ${durum.isYok ? 'text-slate-400' : 'text-slate-950'}`}>
            {formatPara(item.fiyatı)} TL
          </span>
          <span className="text-[6px] text-slate-400 font-bold tracking-tighter uppercase">Birim Fiyat</span>
        </div>

        <span className={`text-[7px] md:text-[9px] font-black px-2 py-1 rounded-md transition-all shadow-xs
        ${durum.isYok
            ? 'bg-slate-50 text-slate-400 border border-slate-100'
            : 'bg-slate-900 text-white group-hover:bg-blue-600'}`}>
          RAF: {item.Raf || '-'}
        </span>
      </div>
    </article>
  );
}
