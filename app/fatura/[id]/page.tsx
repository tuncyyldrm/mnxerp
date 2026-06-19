"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface FaturaSatir {
  satirId: number;
  urunAdi: string;
  stokKodu: string;
  birim: string;
  miktar: number;
  birimFiyat: number;
  kdvOrani: number;
  kdvTutari: number;
  kdvDahilBirimFiyat: number;
  satirTutari: number;
}

interface FaturaDetay {
  islemNo: number;
  cariAdi: string;
  islemTipi: string;
  faturaTarihi: string;
  belgeNo: string;
  faturaToplamTutar: number;
  faturaNotu: string;
  satirlar: FaturaSatir[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FaturaIzlemePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [fatura, setFatura] = useState<FaturaDetay | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFaturaDetay = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Yenilenen API endpoint'imize istek atıyoruz
        const res = await fetch(`/api/fatura/${resolvedParams.id}`);
        const result = await res.json();

        if (result.success && result.data) {
          // Gelen veriyi güvenli bir şekilde state'e aktarıyoruz
          setFatura({
            islemNo: result.data.islemNo,
            cariAdi: result.data.cariAdi || "Bilinmeyen Cari",
            islemTipi: result.data.islemTipi || "BELGE",
            faturaTarihi: result.data.faturaTarihi,
            belgeNo: result.data.belgeNo && result.data.belgeNo !== "-" ? result.data.belgeNo : "Yok",
            faturaToplamTutar: Number(result.data.faturaToplamTutar || 0),
            faturaNotu: result.data.faturaNotu || "",
            satirlar: Array.isArray(result.data.satirlar) ? result.data.satirlar : []
          });
        } else {
          setError(result.error || "#" + resolvedParams.id + " numaralı belge getirilirken bir sorun oluştu.");
        }
      } catch (err: any) {
        console.error("Hata:", err);
        setError("Sunucuya bağlanılamadı. API rotasını ve DB bağlantısını kontrol edin.");
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.id) {
      fetchFaturaDetay();
    }
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-500">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-400">Belge Çekiliyor...</p>
      </div>
    );
  }

  if (error || !fatura) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-md text-center border border-slate-100">
          <div className="text-amber-500 text-3xl mb-2">⚠️</div>
          <h3 className="text-md font-bold text-slate-900 mb-1">Belge İşlenemedi</h3>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition-colors"
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-100/70 min-h-screen text-slate-900 font-sans print:bg-white print:p-0 print:text-black">
      
      {/* 📄 YAZDIRMA İÇİN MİLİMETRİK FONT VE ALAN OPTİMİZASYONU */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
            size: A4; 
            margin: 10mm 10mm 10mm 10mm; 
          }
          body { 
            background: #fff !important; 
            color: #000 !important;
            font-size: 10px !important;
          }
          tr { 
            page-break-inside: avoid; 
            page-break-after: auto; 
          }
          thead { 
            display: table-header-group; 
          }
          th {
            font-size: 9px !important;
            padding: 4px 6px !important;
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td {
            font-size: 9px !important;
            padding: 4px 6px !important;
          }
          .print-clean {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-title {
            font-size: 14px !important;
          }
          .print-meta {
            font-size: 10px !important;
          }
          .print-total-box {
            border: 1px solid #000 !important;
            background: #fff !important;
            color: #000 !important;
            padding: 6px 12px !important;
          }
          .print-total-text {
            font-size: 14px !important;
          }
        }
      `}} />

      <div className="max-w-5xl mx-auto space-y-6 print:space-y-0">
        
        {/* Üst Aksiyon Paneli */}
        <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          <button
            onClick={() => router.back()}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Geri Dön
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            🖨️ Belgeyi Yazdır / PDF Kaydet
          </button>
        </div>

        {/* ANATOMİK FATURA KARTI */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 md:p-10 relative overflow-hidden print-clean">
          
          {/* İşlem Tipi Sağ Üst Etiket */}
          <div className="absolute top-0 right-0 bg-slate-900 text-white px-6 py-2 rounded-bl-2xl font-bold text-[10px] uppercase tracking-widest print:text-black print:bg-white print:border print:border-black print:top-0 print:right-0 print:py-1 print:px-3 print:text-[9px]">
            {fatura.islemTipi}
          </div>

          {/* Üst Bilgiler (Cari & Seri No) */}
          <div className="border-b border-slate-200/80 pb-6 grid grid-cols-2 gap-6 items-start mt-4 print:mt-2 print:pb-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block print:text-slate-500 print:text-[8px]">Müşteri / Cari Bilgisi</span>
              <h1 className="text-base md:text-xl font-black text-slate-900 tracking-tight uppercase leading-snug print-title">
                {fatura.cariAdi}
              </h1>
              <p className="text-xs font-mono text-slate-400 print:text-slate-500 print:text-[9px]">İşlem No: #{fatura.islemNo}</p>
            </div>
            
            <div className="text-right space-y-3 print:space-y-1">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block print:text-slate-500 print:text-[8px]">Belge Seri No</span>
                <span className="font-mono font-black text-lg md:text-xl text-slate-900 tracking-tight print-meta">{fatura.belgeNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block print:text-slate-500 print:text-[8px]">İşlem Tarihi</span>
                <span className="text-xs font-semibold text-slate-700 print:text-black print:text-[9px]">
                  {fatura.faturaTarihi ? new Date(fatura.faturaTarihi).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                </span>
              </div>
            </div>
          </div>

          {fatura.faturaNotu && (
            <div className="mt-4 bg-amber-50/50 border border-amber-100/70 rounded-xl p-3.5 text-xs text-amber-900 print:bg-slate-50 print:border-slate-300 print:text-black print:mt-2 print:p-2 print:text-[9px]">
              <span className="font-bold block mb-0.5">📢 Belge Notu:</span>
              <p className="leading-relaxed">{fatura.faturaNotu}</p>
            </div>
          )}

          {/* SATIRLAR TABLOSU */}
          <div className="mt-6 border border-slate-200/50 rounded-xl overflow-x-auto print:overflow-visible print:border-slate-300 print:mt-3">
            <table className="w-full text-left border-collapse text-xs table-fixed print:w-full">
              <thead className="bg-slate-50/70 text-slate-400 font-bold border-b border-slate-200/60 print:bg-slate-100 print:text-black">
                <tr>
                  <th className="p-3 w-[45%]">Ürün Açıklaması</th>
                  <th className="p-3 text-center w-[12%]">Miktar</th>
                  <th className="p-3 text-right w-[13%]">Birim Fiyat</th>
                  <th className="p-3 text-center w-[8%]">KDV</th>
                  <th className="p-3 text-right w-[11%]">KDV Dahil</th>
                  <th className="p-3 text-right w-[11%]">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white print:divide-slate-300">
                {fatura.satirlar.length > 0 ? (
                  fatura.satirlar.map((satir) => (
                    <tr key={satir.satirId} className="hover:bg-slate-50/40 transition-colors print:bg-white">
                      {/* Ürün Adı */}
                      <td className="p-3 align-middle break-words whitespace-normal">
                        <div className="font-bold text-slate-900 text-xs tracking-tight print:text-black print:text-[9px] print:leading-tight">
                          {satir.urunAdi || "Tanımsız Stok Hareketi"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 print:text-slate-500 print:text-[8px]">
                          Kod: {satir.stokKodu || "-"}
                        </div>
                      </td>
                      
                      {/* Miktar */}
                      <td className="p-3 text-center align-middle font-bold text-slate-900 font-mono print:text-black print:text-[9px]">
                        {satir.miktar} <span className="text-[10px] text-slate-400 font-normal uppercase ml-0.5 print:text-slate-500 print:text-[8px]">{satir.birim || "ADET"}</span>
                      </td>
                      
                      {/* Birim Fiyat */}
                      <td className="p-3 text-right align-middle text-slate-500 font-mono print:text-black print:text-[9px]">
                        {(satir.birimFiyat || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                      
                      {/* KDV */}
                      <td className="p-3 text-center align-middle text-slate-500 font-semibold font-mono print:text-black print:text-[9px]">
                        %{satir.kdvOrani ?? 0}
                      </td>
                      
                      {/* KDV Dahil */}
                      <td className="p-3 text-right align-middle text-slate-600 font-semibold font-mono print:text-black print:text-[9px]">
                        {(satir.kdvDahilBirimFiyat || satir.birimFiyat || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                      
                      {/* Satır Toplamı */}
                      <td className="p-3 text-right align-middle font-black text-slate-900 font-mono text-xs print:text-black print:text-[9px]">
                        {(satir.satirTutari || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic text-xs bg-slate-50/50 print:bg-white">
                      Bu harekete ait alt stok hareket detayı bulunmamaktadır (Nakit Evrağı / Kasa Fişi).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Alt Kapanış ve Genel Toplam Paneli */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4 print:mt-3 print:pt-2 print:border-slate-300">
            <div className="text-slate-400 text-[10px] max-w-xs leading-relaxed print:text-slate-500 print:text-[8px]">
              * Bu döküm veritabanı üzerindeki resmi <span className="font-semibold text-slate-500 print:text-black">vw_FaturaDetayRaporu</span> görünümünden anlık üretilmiştir.
            </div>
            
            <div className="bg-slate-950 text-white px-6 py-4 rounded-xl flex items-center justify-between gap-10 shadow-md print-total-box print:shadow-none print:rounded-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 print:text-black print:text-[8px]">Genel Toplam</span>
              <div className="text-xl md:text-2xl font-black font-mono tracking-tight print-total-text">
                {(fatura.faturaToplamTutar || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}