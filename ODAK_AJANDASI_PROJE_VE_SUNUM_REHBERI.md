# 🌲 Odak Ajandası — Proje Tanıtım, Mimari ve Sunum Hazırlama Rehberi

> **Düzeltme notu (Kasım 2026):** Bu belgedeki bazı abartılı ifadeler ("sektörde ilk", "sıfır gecikme", "sıfır bellek tüketimi", "%100 çevrimdışı") ölçülmemiş veya doğru olmadığı için kaldırıldı. Güncel ve doğru teknik açıklama, güvenlik modeli ve bilinen sınırlar için `README.md` esas alınmalıdır.

> **Kullanım Amacı:** Bu belge, Google Gemini veya benzeri bir üretken yapay zekaya verilerek **Odak Ajandası** projesi için profesyonel bir sunum (pitch deck, teknik proje sunumu, dönem projesi veya yatırımcı sunumu) hazırlatmak amacıyla hazırlanmıştır.  
> Bu belgeyi ve ekteki `ODAK_AJANDASI_TUM_KONUSMALAR.md` dosyasını Gemini'ye ilettiğinizde, Gemini projenin fikrinden son kod satırına kadar tüm sürece hakim olacaktır.

---

## 🚀 1. Proje Özeti ve Vizyon

* **Proje Adı:** Odak Ajandası (Focus Agenda)
* **Slogan:** *"Zamanını Blokla, Odağını Koru, Ormanını Büyüt."*
* **Canlı Web Uygulaması (PWA):** [https://mikailmaras8-ai.github.io/odak-ajandasi/](https://mikailmaras8-ai.github.io/odak-ajandasi/)
* **Açık Kaynak Kod Deposu:** [https://github.com/mikailmaras8-ai/odak-ajandasi](https://github.com/mikailmaras8-ai/odak-ajandasi)
* **Geliştirici:** Mikail Maraş & Antigravity AI
* **Temel Felsefe:** Klasik yapılacaklar listeleri (To-Do List) insanı ertelemeye iter çünkü *"ne zaman"* yapılacağını söylemez. Odak Ajandası, **Zaman Bloklama (Time-Blocking)** metodolojisi ile **Forest tipi oyunlaştırma (Gamification)** dinamiklerini birleştirir. Kullanıcı görevini saate bağlar, odaklandıkça fidanı büyür ve ağaca dönüşür; seansı terk ederse fidan kurur.

---

## 💡 2. Çözülen Problem ve Değer Önerisi

### 🔴 Problem:
1. **Pasif Liste Sendromu:** Geleneksel yapılacaklar listelerinde maddeler yığılır, başlama saati olmadığı için sürekli ertelenir.
2. **Bildirim ve Dikkat Dağınıklığı:** Telefonda başka uygulamalara (Instagram, TikTok vb.) kaçış çok kolaydır.
3. **Ağır & Ücretli Odak Uygulamaları:** Forest vb. uygulamalar App Store'da ücretlidir veya hesap açma, ağır reklamlar gibi bariyerler içerir.
4. **Web / Tarayıcı Kısıtlamaları:** Normal web siteleri arka plana atıldığında veya ekran kilitlendiğinde sayaçları donar ve arka plan çalışma yeteneğini kaybeder.

### 🟢 Odak Ajandası'nın Çözümü:
1. **Net Zaman Blokları (A5 Ajanda Ruhu):** Sabah 08:00'den gece 23:30'a kadar günü net saat dilimlerine bölen zaman bloklama arayüzü.
2. **Kayıp Korkusu (Loss Aversion):** Odaklanılan süre boyunca fidan büyür. Kullanıcı pes ederse veya seansı terk ederse fidan kurur ve ormanından 1 ağaç eksilir.
3. **Kilit Ekranında Medya Kartı:** Seans sürerken arka planda sessiz bir ses çalınır ve MediaSession API ile medya kartına kalan süreyi gösteren bir kapak resmi verilir. Bu, müzik uygulamalarının kullandığı standart bir web API'sidir; davranışı tarayıcı ve işletim sistemine göre değişir.
4. **Çevrimdışı Çalışma:** Service Worker uygulama dosyalarını önbelleğe alır; internet yokken plan ve odak seansı çalışır. Arkadaş ve bulut özellikleri internet gerektirir.

---

## 🛠️ 3. Teknik Mimari ve Mühendislik İnovasyonları

| Alan | Kullanılan Teknoloji | Sağlanan Yetenek |
| :--- | :--- | :--- |
| **Ön Yüz (Frontend)** | Düz JavaScript, HTML, CSS | Framework ve derleme adımı yok (açılış süresi ölçülmedi) |
| **Arka Plan & Kilit Ekranı** | Web Audio API + MediaSession API | Telefon kilitlendiğinde veya ekran kapandığında iOS/Android kilit ekranında canlı medya widget'ı |
| **Dinamik Kapak Motoru** | HTML5 Canvas 2D Engine (512×512) | Kilit ekranında canlı yeşil halka, ağaç emojisi ve okunabilir dijital sayaç çizimi |
| **Akıllı Ses Yönetimi** | Web Audio API + Gerçek Stüdyo Kayıtları | Yağmur, Kafe, Orman, Dalga sesleri; foreground'da mikrofon serbest, background'da canlı kilit ekranı |
| **Zaman Tutarlılığı** | Date.now() Monotonic Timestamp Delta | Ekran kapandığında JavaScript dursa bile uyanışta tam saniye senkronizasyonu |
| **PWA & Offline** | Service Worker Cache v11, Web App Manifest | iOS'ta "Ana Ekrana Ekle", Android'de "Uygulamayı Yükle" ile tam native uygulama deneyimi |
| **Dağıtım (CI/CD)** | Git + GitHub Pages | Tek komutla sürüm derleme, önbellek temizleme ve global CDN yayını |

---

## 🏆 4. Geliştirme Sürecinde Çözülen Kritik Mühendislik Zorlukları

1. **iOS WebKit Kilit Ekranı Zaman Aşımı:**
   * *Zorluk:* Apple Safari, ekran kapandıktan 15-30 saniye sonra web sayfalarının JavaScript zamanlayıcılarını (`setInterval`) dondurur.
   * *Çözüm:* İnsan kulağının duyamayacağı düzeyde fısıltı seviyesinde optimize edilmiş sessizlik frekansı (`silence.m4a` / `silence.wav`) ve MediaSession API ile sistem uyanık tutuldu. Ekran açıldığında mutlak zaman damgası (`Date.now()`) ile anında zaman eşitlemesi yapıldı.
2. **WhatsApp ve Mikrofon Çakışması:**
   * *Zorluk:* Kullanıcı uygulama açıkken sesli mesaj göndermek veya telefonla konuşmak istediğinde sürekli ses çalması mikrofonun kilitlenmesine yol açıyordu.
   * *Çözüm:* Sayfa ön plandayken (`!document.hidden`) sessizlik sesi anında durdurulur ve mikrofon serbest bırakılır; yalnızca telefon kilitlendiğinde veya uygulamadan çıkıldığında kilit ekranı modu devreye girer.
3. **Akıllı Ambiyans Sesleri Yaşam Döngüsü:**
   * *Zorluk:* Kullanıcı sadece ambiyans seslerini test etmek istediğinde seslerin uygulama genelinde gezinirken durmaması kafa karışıklığı yaratıyordu.
   * *Çözüm:* Kullanıcı aktif odaklanmıyorsa (`!isFocusing`) plandan çıkıldığı an ses durdurulur; aktif odaklanıyorsa arka planda ve kilit ekranında kesintisiz çalmaya devam eder.
4. **Çerçevesiz ve Lüks Arayüz:**
   * Kullanıcının talebi doğrultusunda odak sayacı etrafındaki tüm sınır kutuları kaldırılmış, parlayan ağaç çemberi altında minimalist ve modern bir tipografi uygulanmıştır.

---

## 📊 5. Gemini İçin 10 Slaytlık Profesyonel Sunum Taslağı

Gemini'ye bu taslağı vererek doğrudan sunum içeriğini, slayt notlarını ve konuşmacı ipuçlarını hazırlatabilirsiniz:

### 🔹 Slayt 1: Başlık & Vizyon
* **Başlık:** Odak Ajandası (Focus Agenda)
* **Alt Başlık:** Zaman Bloklama ve Oyunlaştırma ile Yeni Nesil Odak Deneyimi
* **Konuşmacı Notu:** Modern dünyada dikkat dağınıklığına karşı sadece bir liste değil, zamanı sahiplenen ve psikolojik oyunlaştırmayla odaklanmayı koruyan bir çözüm ürettik.

### 🔹 Slayt 2: Problem — Dikkat Dağınıklığı ve Pasif Listeler
* **Maddeler:**
  * To-Do Listeler zaman belirtmediği için ertelemeyi teşvik eder.
  * Telefon bildirimleri ve diğer uygulamalar odaklanmayı sürekli böler.
  * Mevcut odak uygulamaları pahalı, ağır ve karmaşıktır.

### 🔹 Slayt 3: Çözüm — Zaman Bloklama + Fidan Büyütme
* **Maddeler:**
  * Günlük A5 deri ajanda deneyiminin dijitale aktarımı (Zaman Blokları).
  * Odaklanırken büyüyen tohumlar, seansı terk edince kuruyan ağaçlar.
  * Ormanım sekmesinde günlük, haftalık ve aylık başarı görselleştirmesi.

### 🔹 Slayt 4: Oyunlaştırma Psikolojisi (Gamification & Loss Aversion)
* **Maddeler:**
  * 15+ farklı ağaç türü (Çam, Meşe, Sakura, Bonsai, Baobab vb.).
  * Pes edince ağacın kuruması ve ormandan silinmesi korkusu.
  * Zihin Kutusu: Aklına takılanları seansı bozmadan not alıp devam edebilme.

### 🔹 Slayt 5: Teknik Atılım — Web Tabanlı Kilit Ekranı Entegrasyonu
* **Maddeler:**
  * MediaSession API ile kilit ekranı medya kartında kalan süre (standart API, cihaza göre değişir).
  * 512×512 Canvas motoru ile gerçek zamanlı dinamik kilit ekranı kapağı.
  * Hiçbir native mağaza indirmesi gerekmeden tarayıcı üzerinden native deneyim.

### 🔹 Slayt 6: Akıllı Ses & Ambiyans Deneyimi
* **Maddeler:**
  * 4 doğal odak ambiyansı: Yağmur, Kafe, Orman, Okyanus Dalgaları.
  * Çift katmanlı ses motoru: Gerçek stüdyo kayıtları + Procedural Web Audio API sentezleyici.
  * Akıllı mikrofon uyumluluğu (WhatsApp / arama çakışmasız).

### 🔹 Slayt 7: Tasarım Felsefesi — Apple & Forest Minimalizmi
* **Maddeler:**
  * Karanlık lüks zümrüt paleti (`#0C111D`, `#10B981`, `#059669`).
  * Dinamik Gece/Gündüz modu (Türkiye saatine göre otomatik geçiş).
  * Çerçevesiz, göz yormayan odak sayacı ve LED göstergeli ilerleme çemberi.

### 🔹 Slayt 8: Mimari & Teknoloji Yığını
* **Maddeler:**
  * Framework kullanmayan düz JavaScript; dosyalar `js/` altında modüllere ayrıldı.
  * Service Worker ile çevrimdışı önbellek (arkadaş/bulut özellikleri hariç).
  * Otomatik güncelleme algılama motoru ve veri yedekleme (JSON / Firestore hazır).

### 🔹 Slayt 9: Geliştirme Yolculuğu (5 Günde 139 İterasyon)
* **Maddeler:**
  * 30 Ekim 2026: İlk fikir ve interaktif telefon simülatörü prototipi.
  * 31 Ekim – 2 Kasım: Zihin kutusu, takvim, yan menü ve istatistik geliştirmeleri.
  * 3 – 4 Kasım: PWA altyapısı, kilit ekranı optimizasyonu, GitHub Pages yayını.
  * Çevik yapay zeka eşliğinde sürekli test ve anlık sürüm dağıtımı.

### 🔹 Slayt 10: Canlı Uygulama, Özet & Gelecek
* **Maddeler:**
  * Canlı Uygulama Linki & QR Kodu.
  * Gelecek: Arkadaşlar arası yarışma modu, yapay zeka odak koçu.
  * Kapanış & Soru-Cevap.

---

## 🤖 6. Gemini'ye Gönderilecek Örnek İstek (Prompt)

Aşağıdaki metni kopyalayıp Gemini'ye bu belgelerle birlikte yapıştırabilirsiniz:

```text
Merhaba Gemini! 
Seninle bir web ve mobil odaklanma uygulaması geliştirdik: "Odak Ajandası".
Sana ekte iki dosya veriyorum:
1. ODAK_AJANDASI_PROJE_VE_SUNUM_REHBERI.md (Proje özeti, mimari, çözülen problemler ve önerilen sunum yapısı)
2. ODAK_AJANDASI_TUM_KONUSMALAR.md (Projenin ilk gününden bugüne kadar yapılan tüm konuşmalar ve teknik iterasyonlar)

Bu belgelere dayanarak benden çok etkileyici, profesyonel, modern ve görsel yönden zengin bir SUNUM hazırlamanı istiyorum.
Lütfen her slayt için:
- Slayt Başlığı ve Alt Başlığı
- Madde Madde Görsel Metinler (Slide Content)
- Konuşmacı Notları (Ben sahnede veya jüri önünde ne konuşacağım?)
- Tasarım ve Görsel Önerileri (Hangi ekran görüntüleri, ikonlar veya renkler yer almalı?)
hazırla. Projenin teknik başarısını, oyunlaştırma psikolojisini ve web üzerinde kilit ekranı entegrasyonu gibi yenilikçi taraflarını özellikle vurgula.
```
