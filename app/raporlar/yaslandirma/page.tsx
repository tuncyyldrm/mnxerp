'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function YaslandirmaRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/raporlar/cari?tab=yaslandirma');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-slate-400 font-semibold text-sm">
      Cari Yönetim Merkezi&apos;ne aktarılıyorsunuz...
    </div>
  );
}
