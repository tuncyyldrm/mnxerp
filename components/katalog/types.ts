// --- AYARLAR / KONFİGÜRASYON ---
export const KRITIK_STOK_ESIGI = 2; // Bu değer ve altı "KRİTİK" sayılır.

// --- TİPLER ---
export interface Urun {
  urunkodu: string;        // Benzersiz ürün kodu (Zorunlu)
  urun: string;            // Ürün adı/açıklaması (Zorunlu)
  urunalt?: string;        // Alt açıklama (Boş gelebilir)
  grubu?: string;          // Ürün grubu (Boş gelebilir)
  kateGOri?: string;       // Kategori (Boş gelebilir)
  tipi?: string;           // Tipi (Boş gelebilir)
  ureticifirma?: string;   // Üretici Firma (Boş gelebilir)
  Raf?: string;            // Raf Bilgisi (Boş gelebilir)
  fiyatı: number;          // Fiyat (Zorunlu)
  STK_FULL?: number;       // Eski/Alternatif stok alanı
  MevcutBakiye: number;    // Canlı bakiye alanı (Zorunlu/0 döner)
  imageVersion?: number;   // Canlı görsel versiyonu (anında önbellek tazeleme)

  // OEM Numaraları (Hepsi opsiyonel - Boş gelebilir)
  OEM?: string;
  OEM_0?: string;
  OEM_1?: string;
  OEM_2?: string;
  OEM_3?: string;
  OEM_4?: string;
  OEM_5?: string;
  OEM_6?: string;
  OEM_7?: string;
  OEM_8?: string;
  OEM_9?: string;
}

export interface StokDurumu {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  isYok?: boolean;
  isKritik?: boolean;
  isVar?: boolean;
}

export interface CariSecim {
  id: number;
  id_name: string;
}

export interface StokHareketi {
  Tarih?: string;
  MusteriAdi?: string;
  BirimFiyat?: string | number;
  Giris?: number;
  Cikis?: number;
}

// Fiyat Formatlayıcı
export const formatPara = (deger: number) => {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(deger || 0);
};

export const getCleanedCode = (code: string) => {
  return code?.replace(/\s?(OEM|ITH|ESD|MUA|EZM|YERLI|ORJ)\b/gi, "")
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim() || "";
};

export const getStokDurumu = (stok?: number): StokDurumu => {
  const s = Number(stok) || 0;

  if (s <= 0) {
    return {
      label: "STOKTA YOK",
      bg: "bg-red-50",
      text: "text-red-600",
      border: "border-red-100",
      dot: "bg-red-500",
      isYok: true
    };
  }

  if (s <= KRITIK_STOK_ESIGI) {
    return {
      label: `KRİTİK (SON ${s})`,
      bg: "bg-orange-50",
      text: "text-orange-600",
      border: "border-orange-100",
      dot: "bg-orange-500",
      isKritik: true
    };
  }

  return {
    label: "STOKTA VAR",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
    isVar: true
  };
};
