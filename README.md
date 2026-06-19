# MNX ERP Kurulum ve Kullanım Kılavuzu
MNXERP_2026_Beta_X4897
## 📋 Sistem Gereksinimleri

Kuruluma başlamadan önce aşağıdaki yazılımların bilgisayarda kurulu olması gerekir:

* Node.js (LTS sürümü)
* Git
* SQL Server
* SQL Server TCP/IP bağlantılarının aktif olması

---

# 🛠 İlk Kurulum

## 1. Gerekli Programların Kurulması

Müşteri bilgisayarına aşağıdaki yazılımları kurun:

### Node.js (LTS)

Next.js uygulamasının çalışabilmesi için gereklidir.

### Git

Projeyi GitHub üzerinden indirebilmek için gereklidir.

Kurulum sırasında varsayılan ayarlar kullanılabilir.

---

## 2. Projeyi İndirme

Projenin kurulacağı klasörü oluşturun.

Örnek:

```bash
C:\MNXERP
```

Bu klasörde CMD veya PowerShell açıp aşağıdaki komutu çalıştırın:

```bash
git clone https://github.com/tuncyyldrm/mnxerp.git .
```

> Sondaki "." işareti dosyaların doğrudan mevcut klasöre indirilmesini sağlar.

---

## 3. Veritabanı Ayarları

Proje klasöründe `.env.local` dosyası oluşturun.

Örnek içerik:

```env
DB_USER=sa
DB_PASSWORD=2026
DB_SERVER=127.0.0.1
DB_DATABASE=ONEDB
DB_PORT=1433
```

SQL Server bilgilerini müşterinin sistemine göre düzenleyin.

---

## 4. Bağımlılıkların Kurulması

Terminalde aşağıdaki komutu çalıştırın:

```bash
npm install
```

Bu işlem projede kullanılan tüm paketleri yükler.

---

## 5. Production Build Oluşturma

Projeyi canlı kullanım için derleyin:

```bash
npm run build
```

Build işlemi tamamlandıktan sonra sistem canlı kullanıma hazır hale gelir.

---

## 6. PM2 ile Sürekli Çalıştırma

PM2 uygulamanın:

* Arka planda çalışmasını,
* Terminal kapansa bile kapanmamasını,
* Bilgisayar yeniden başlatıldığında otomatik açılmasını sağlar.

### PM2 Kurulumu

```bash
npm install -g pm2
```

### Uygulamayı Başlatma

```bash
pm2 start npm --name "mnx-sunucu" -- run start
```

### PM2 Yapılandırmasını Kaydetme

```bash
pm2 save
```

### Çalışan Servisleri Görüntüleme

```bash
pm2 list
```

### Logları Görüntüleme

```bash
pm2 logs mnx-sunucu
```

### Servisi Yeniden Başlatma

```bash
pm2 restart mnx-sunucu
```

---

# 🗄 Veritabanı Güncelleme

Kurulum tamamlandıktan sonra aşağıdaki adres açılarak veritabanı nesneleri oluşturulur veya güncellenir:

```text
http://localhost:3000/api/db-update?key=ŞİFRENİZ
```

İşlem başarılı olduğunda aşağıdakine benzer bir çıktı görülmelidir:

```text
Toplam 21 SQL bloğu çalıştırıldı.
```

Bu mesaj görüldüğünde sistem kullanıma hazırdır.

---

# 🚀 Güncelleme İşlemleri

Yeni sürüm yayınlandığında aşağıdaki komutlar çalıştırılır:

```bash
git pull origin main
npm install
npm run build
pm2 restart mnx-sunucu
```

Bu işlem son sürümü indirir ve sistemi günceller.

---

# 💻 Geliştirme Ortamı

Yerel geliştirme için:

```bash
npm install
npm run dev
```

Uygulama aşağıdaki adreste çalışır:

```text
http://localhost:3000
```

---

# 📂 Önemli Klasörler

## public/images/urunler

Ürün görselleri burada saklanır.

Bu klasör Git tarafından takip edilmez.

Her mağaza kendi görsellerini bağımsız olarak kullanabilir.

---

## api/db-update

Veritabanı güncellemelerini otomatik uygulayan servistir.

Kullanım:

```text
http://localhost:3000/api/db-update?key=ŞİFRENİZ
```

---

# 🔧 Git Kullanımı

## Değişiklik Gönderme

```bash
git add .
git commit -m "update"
git push
```

## Güncellemeleri Alma

```bash
git pull origin main
```

---

# ⚠️ Notlar

* Ürün görselleri Git tarafından takip edilmez.
* Yeni paket eklendiğinde mutlaka `npm install` çalıştırılmalıdır.
* Build sonrası sistem yeniden başlatılmalıdır.
* SQL Server servisinin çalışır durumda olması gerekir.
* PM2 kullanılması tavsiye edilir.
* Veritabanı güncellemeleri yalnızca yetkili kişiler tarafından yapılmalıdır.

---

# ✅ Kurulum Kontrol Listesi

* [ ] Node.js kuruldu
* [ ] Git kuruldu
* [ ] Proje klonlandı
* [ ] .env.local oluşturuldu
* [ ] npm install çalıştırıldı
* [ ] npm run build tamamlandı
* [ ] PM2 kuruldu
* [ ] PM2 ile servis başlatıldı
* [ ] db-update çalıştırıldı
* [ ] Sistem test edildi

Kurulum tamamlandığında uygulama aşağıdaki adresten erişilebilir:

```text
http://localhost:3000
```
