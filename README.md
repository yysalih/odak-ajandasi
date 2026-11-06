# Odak Ajandası

Günlük görevleri saate bağlayıp her biri için Pomodoro tarzı bir odak seansı başlatan bir web uygulaması. Tamamlanan seans ormana bir ağaç olarak eklenir, yarıda bırakılan seansın ağacı kurur. Telefona "Ana Ekrana Ekle" ile uygulama gibi kurulabilir (PWA).

Canlı sürüm: https://mikailmaras8-ai.github.io/odak-ajandasi/

Derleme adımı yoktur: HTML, CSS ve düz JavaScript dosyalarından oluşur.

## Çalıştırma

```bash
npm install        # sadece testler için gerekir
npm start          # http://localhost:8080
```

Node kurulu değilse `python3 -m http.server 8080` de yeterlidir. Arkadaş özelliği ve kilit ekranı kartı tarayıcının güvenli bağlam (HTTPS ya da `localhost`) kuralı nedeniyle `file://` ile açıldığında çalışmaz.

## Testler

```bash
npm test           # birim testleri (Node'un yerleşik test aracı, ~1 sn)
npm run test:e2e   # gerçek Chromium + yerel MQTT broker ile uçtan uca testler
```

Uçtan uca testler internete çıkmaz; yerel bir statik sunucu ve yerel bir MQTT broker (aedes) başlatır. Chromium yoksa bir kez `npx playwright install chromium` çalıştırın.

Testlerin neyi kanıtladığı:

| Test | Dosya |
|---|---|
| 25 dk'lık görev eklemek ağaç/dakika/hedef üretmez | `tests/e2e/app.test.js`, `tests/unit/core.test.js` |
| Çalışmadan ağaç kilidi açılmaz; pes edilen seans sayılmaz | aynı |
| Görev başlığı ve arkadaş adındaki HTML çalışmaz | `tests/e2e/app.test.js` |
| Yedek dosyasındaki sahte/aşırı değerler atılır | `tests/unit/core.test.js`, `tests/e2e/app.test.js` |
| Tarih aralığı filtresi | `tests/e2e/app.test.js` |
| Arkadaş ekleme: istek, onay, çevrimdışı karşı taraf, ikisi aynı anda ekleme, ret | `tests/unit/friend-protocol.test.js`, `tests/e2e/app.test.js` |
| `odak/#` dinleyen saldırgan içerik okuyamaz; sahte anahtar, sahte profil, tekrar oynatma, davetsiz istek reddedilir | `tests/unit/friend-protocol.test.js` |

Testlerin kapsamadığı şeyler: kilit ekranı medya kartı, ses dosyaları, gerçek iOS/Android cihaz davranışı ve Supabase bulut eşitlemesi (gerçek bir Supabase projesi gerektirir). Bunlar elle denenmiştir ya da denenmesi gerekir.

## Dosya yapısı

```text
index.html                 Sadece HTML iskeleti
css/app.css                Stiller
js/core.js                 DOM'suz hesaplar: istatistik, doğrulama, HTML kaçışı (testli)
js/friend-protocol.js      Arkadaşlık protokolü ve şifreleme (DOM'suz, testli)
js/friends.js              Arkadaş ekranı + MQTT bağlantısı
js/state.js                Tarih, plan takvimi, uygulama durumu, ağaç kilitleri
js/focus.js                Odak seansı, mola, kilit ekranı kartı, zihin kutusu
js/stats.js                İstatistik ekranı ve takvim
js/navigation-plan.js      Ekran geçişleri, plan listesi, orman, hatırlatıcılar
js/account.js              Profil, Supabase hesabı, yerel kayıt
js/...                     Diğer ekran parçaları (tema, ses, rutinler, hedef)
js/vendor/                 Sabit sürümlü kütüphaneler (Paho MQTT, supabase-js 2.45.4)
sw.js                      Service Worker: çevrimdışı önbellek
supabase/schema.sql        Bulut tablosu ve erişim kuralları (RLS)
tests/                     Birim ve uçtan uca testler
```

Script dosyaları `index.html` içinde belirli bir sırayla yüklenir; sıra değişirse bir dosya henüz yüklenmemiş bir fonksiyonu çağırabilir.

## Veriler nerede tutulur

- Varsayılan olarak her şey tarayıcının `localStorage` alanındadır. Başka cihaza otomatik geçmez.
- İsteğe bağlı e-posta/şifre ile giriş yapılırsa veriler Supabase'deki `user_state` tablosuna yedeklenir. Her kullanıcının yalnızca kendi satırını okuyup yazabilmesi Supabase'deki satır güvenliği kurallarına dayanır; kurallar `supabase/schema.sql` dosyasındadır ve projede çalıştırılmış olmaları gerekir. Uygulamadaki `anonKey` gizli bir anahtar değildir, herkese açık olması normaldir; güvenlik bu kurallardan gelir.
- Buluttan, yerel kayıttan ve yedek dosyasından okunan veri aynı doğrulamadan geçer (`OdakCore.sanitizeBackup`): geçersiz tarih, gelecekteki seans, 1440 dk'dan uzun seans ve günde 1440 dk'yı aşan toplam atılır.

## İstatistikler nasıl hesaplanır

Ağaç sayısı, odak dakikası, günlük hedef, seri ve ağaç kilitleri yalnızca **tamamlanmış odak seanslarından** hesaplanır (`OdakCore.buildSessionList`). Planlanmış ama başlatılmamış görevler sayılmaz. Pes edilen seanslar geçmişte "kurumuş" olarak görünür ama süreye eklenmez.

## Arkadaş özelliği ve güvenlik modeli

Bu bölümün sunucusu yok; mesajlar herkese açık iki MQTT broker'ı (`broker.emqx.io`, `broker.hivemq.com`) üzerinden geçer. Bu yüzden broker'a güvenilmez ve mesajlar uçtan uca şifrelenir:

1. Her cihaz ilk açılışta bir ECDH P-256 anahtar çifti üretir (tarayıcının WebCrypto API'si).
2. Davet kodu, açık anahtarın SHA-256 özetinin ilk 120 bitidir (+1 bayt sağlama). Tahmin edilemez ve karşı tarafın anahtarını doğrulamaya yarar.
3. Broker'daki konu adları bu kodun özetidir; konu adından koda geri gidilemez.
4. Arkadaşlık isteği, alıcının davet koduna bağlı bir anahtarla şifrelenir. Kodu bilmeyen biri, konu adını görse bile alıcının kabul edeceği bir istek üretemez.
5. İstek, alıcı onaylamadan listeye eklenmez.
6. Eşleşen iki kişi ortak bir anahtar türetir; profil ve tezahürat mesajları AES-GCM ile şifrelenir ve kimliği doğrulanır. Aralık dışı değerler (ör. haftada 10.080 dk'dan fazla) içeren mesaj reddedilir; aynı mesajın tekrar gönderilmesi işe yaramaz.
7. Ekrana basılan her isim/avatar HTML kaçışından geçer; avatar olarak yalnızca emoji veya base64 resim kabul edilir.

**Bu modelin sınırları** (bilerek kabul edilenler):

- Broker ortak ve herkese açık olduğu için şifreli paketleri ve hangi (özetlenmiş) konunun ne zaman aktif olduğunu görebilir. İçeriği okuyamaz ve sahte mesajı kabul ettiremez, ama mesaj silebilir veya trafiği boğabilir. Gerçek bir ürün için kimlik doğrulamalı, kendi broker'ımız ya da Supabase Realtime gibi bir sunucu tarafı gerekir.
- Arkadaşın gördüğün istatistiği onun cihazının beyanıdır. Sunucu tarafında seans doğrulaması olmadan bir kişinin kendi tarayıcısında verisini değiştirip şişirmesi engellenemez; yalnızca fiziksel olarak imkânsız değerler reddedilir. Aynı şey cihaz saatini ileri almak için de geçerlidir.
- Davet kodunu ele geçiren biri istek gönderebilir; onay vermeden arkadaş olamaz.
- Gizli anahtar `localStorage`'da durur. "Verileri sıfırla" ile silinir ve arkadaşlıklar kaybolur.

## Bilinen sınırlar

- **Bildirimler:** Uygulama tamamen kapalıyken seans bitiş bildirimi garanti değildir. Eski sürümdeki "Service Worker içinde setTimeout" yöntemi kaldırıldı, çünkü tarayıcılar boşta kalan Service Worker'ı dakikalar içinde durdurur. Güvenilir yol bir sunucudan Web Push göndermektir; bu projede yok. Seans süresi bitiş zamanından hesaplandığı için uygulama tekrar açıldığında seans doğru şekilde tamamlanır.
- **Kilit ekranı sayacı:** Arka planda sessiz bir ses dosyası çalınarak ve MediaSession API ile medya kartı gösterilerek yapılır. Davranış tarayıcıya ve işletim sistemine göre değişir; resmi bir "canlı etkinlik" API'si değildir.
- **Yedekleme:** `exportDataBackup` / `importDataBackup` fonksiyonları var ama arayüzde düğmesi yok.
- **Tek kullanıcı varsayımı:** Yerel veri tarayıcıya bağlıdır; aynı tarayıcıyı paylaşan iki kişi aynı veriyi görür.

## Hocanın geri bildirimine göre yapılan değişiklikler

| Geri bildirim | Durum |
|---|---|
| Görev eklemek seans başlamadan 1 ağaç, 25 dk, %21 hedef gösteriyor | Düzeltildi. Sebep: plan görevleri istatistik listesine "tamamlanmış seans" gibi ekleniyordu. |
| Çalışmadan ağaç türlerinin kilidi açılıyor | Düzeltildi (aynı sebep; ayrıca pes edilen seanslar da sayılıyordu). |
| Tarih filtresi yok | İstatistik ekranına başlangıç/bitiş tarihli aralık filtresi eklendi. |
| Sahte profil ve aşırı istatistik doğrulanmadan kabul ediliyor | Arkadaş profilleri ve tüm içe aktarılan veri doğrulanıyor; arkadaş mesajları kimlik doğrulamalı. Kendi verisini değiştiren kullanıcı sınırı yukarıda yazıyor. |
| İsimdeki HTML sıralamaya kaçışsız basılıyor | Tüm `innerHTML` çıktıları kaçışlanıyor; test var. |
| Ortak broker'da herkesin mesajı okunabiliyor / herkese mesaj atılabiliyor | Uçtan uca şifreleme, 120 bit davet kodu, onaylı eşleşme. Broker hâlâ ortak; sınırları yukarıda. |
| Service Worker içinde uzun setTimeout | Kaldırıldı; sınırı yukarıda açıklandı. |
| Kod tek HTML dosyasında | `css/` ve `js/` altına bölündü; hesaplama ve protokol kodu DOM'dan ayrıldı. |
| Test paketi yok | Birim ve uçtan uca testler eklendi. |
| Arkadaş ekleme sorunu | Bağlantı kurulmadan girilen kod hiç gönderilmiyordu; iki kişi farklı yedek broker'a düşünce birbirini göremiyordu. İstekler artık bekletilip yeniden gönderiliyor, iki broker'a aynı anda bağlanılıyor. |
| Abartılı ifadeler | README yeniden yazıldı. |

## Yapay zeka kullanımı

Bu projenin kodunun ve belgelerinin büyük kısmı yapay zeka araçlarıyla (Antigravity/Gemini, sonra Claude) yazıldı. `ODAK_AJANDASI_TUM_KONUSMALAR.md` geliştirme sırasındaki konuşmaların kaydıdır; içindeki teknik iddialar bu README ile çelişirse güncel olan README'dir.

## Lisans

MIT
