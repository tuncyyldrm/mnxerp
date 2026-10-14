@echo off
title MNX ERP - Hizli Uretim Sunucusu
echo ======================================================
echo   MNX ERP - Sistem Baslatiliyor (Yuksek Performans)
echo ======================================================
git pull origin main
call npm install
if not exist .next (
    echo Ilk derleme hazirlaniyor...
    call npm run build
)
echo [BILGI] Sistem Production modunda baslatiliyor...
call npm run start