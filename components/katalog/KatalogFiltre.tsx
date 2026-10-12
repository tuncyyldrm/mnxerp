'use client';

import React from 'react';

interface KatalogFiltreProps {
  aramaMetni: string;
  setAramaMetni: (val: string) => void;
  onAramaTetikle: () => void;
  seciliGrup: string;
  setSeciliGrup: (val: string) => void;
  gruplar: string[];
  seciliKategori: string;
  setSeciliKategori: (val: string) => void;
  kategoriler: string[];
  seciliTip: string;
  setSeciliTip: (val: string) => void;
  tipler: string[];
  onTemizle: () => void;
  setSayfa: (val: number | ((prev: number) => number)) => void;
}

export default function KatalogFiltre({
  aramaMetni,
  setAramaMetni,
  onAramaTetikle,
  seciliGrup,
  setSeciliGrup,
  gruplar,
  seciliKategori,
  setSeciliKategori,
  kategoriler,
  seciliTip,
  setSeciliTip,
  tipler,
  onTemizle,
  setSayfa,
}: KatalogFiltreProps) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 mb-4 md:mb-6 shadow-xs">
      <div className="flex flex-col lg:flex-row gap-3 items-center">

        {/* ARAMA ALANI */}
        <div className="relative w-full lg:w-[35%] flex gap-2">
          <div className="relative flex-1">
            <input
              value={aramaMetni}
              onChange={(e) => setAramaMetni(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAramaTetikle()}
              placeholder="Parça Adı, Marka veya OEM Kodu..."
              className="w-full h-11 pl-10 pr-4 bg-slate-50 rounded-lg outline-none text-xs font-bold text-slate-700 border border-slate-200/80 focus:border-blue-500 focus:bg-white transition-all"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </span>
          </div>

          <button
            onClick={onAramaTetikle}
            className="h-11 px-5 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center shrink-0 shadow-xs"
          >
            ARA
          </button>
        </div>

        {/* SELECT FİLTRELERİ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 flex-1 w-full gap-2">
          <select
            className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white cursor-pointer transition-all dynamic-select"
            value={seciliGrup}
            onChange={(e) => { setSeciliGrup(e.target.value); setSayfa(1); }}
          >
            <option value="">TÜM GRUPLAR</option>
            {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            disabled={!seciliGrup}
            className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white disabled:opacity-40 transition-all cursor-pointer"
            value={seciliKategori}
            onChange={(e) => { setSeciliKategori(e.target.value); setSayfa(1); }}
          >
            <option value="">KATEGORİ</option>
            {kategoriler.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <select
            disabled={!seciliKategori}
            className="h-11 bg-slate-50 rounded-lg px-3 text-[11px] font-bold text-slate-600 outline-none border border-slate-200/80 focus:border-blue-500 focus:bg-white disabled:opacity-40 col-span-2 sm:col-span-1 transition-all cursor-pointer"
            value={seciliTip}
            onChange={(e) => { setSeciliTip(e.target.value); setSayfa(1); }}
          >
            <option value="">TİP / YÖN</option>
            {tipler.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* SIFIRLA BUTONU */}
        <button
          onClick={onTemizle}
          className="h-11 w-full lg:w-auto px-4 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold uppercase hover:bg-red-50 hover:text-red-600 border border-slate-200/60 transition-all flex items-center justify-center shrink-0"
        >
          Temizle
        </button>

      </div>
    </section>
  );
}
