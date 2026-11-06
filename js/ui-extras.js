/* ══════════════════════════════════════════════════════
   GLOBAL BİLDİRİM TOAST YÖNETİCİSİ
   ══════════════════════════════════════════════════════ */
// Bazı yerler showToast(...) çağırıyordu ama bu fonksiyon hiç tanımlı değildi
// (ör. günlük hedef kaydedilince ReferenceError). Tek bir toast'a yönlendiriyoruz.
function showToast(msg){ showAppToast(msg, 'ℹ️'); }

function showAppToast(msg, icon = '🌿'){
  const toast = document.getElementById('app-toast');
  if(!toast) return;
  // textContent: mesajlar görev başlığı / arkadaş adı içerebilir, HTML olarak yorumlanmamalı.
  toast.textContent = '';
  const iconEl = document.createElement('span');
  iconEl.style.cssText = 'font-size:13px;flex-shrink:0;';
  iconEl.textContent = String(icon ?? '');
  const msgEl = document.createElement('span');
  msgEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:270px;';
  msgEl.textContent = String(msg ?? '');
  toast.append(iconEl, ' ', msgEl);
  toast.classList.add('show');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

/* ══════════════════════════════════════════════════════
   2. ŞABLONLAR & TEKRARLAYAN GÜNLÜK RUTİNLER
   ══════════════════════════════════════════════════════ */
const DEFAULT_ROUTINES = [
  { id: 'r1', title: 'Sabah Kitap Okuma', cat: 'Kişisel', dur: 30, start: '08:30', end: '09:00', treeType: '🎋', treeName: 'Bonsai' },
  { id: 'r2', title: 'Atölye Deri Kesimi', cat: 'Atölye', dur: 45, start: '14:00', end: '14:45', treeType: '🌳', treeName: 'Meşe' },
  { id: 'r3', title: 'Odaklı Kodlama & Analiz', cat: 'Yazılım', dur: 50, start: '16:00', end: '16:50', treeType: '🌲', treeName: 'Ulu Çam' }
];

let userRoutines = JSON.parse(JSON.stringify(DEFAULT_ROUTINES));

const DEFAULT_FRIENDS = [
  { id: 'f1', name: 'Zeynep Kaya', avatar: '👩‍💻', code: 'ODAK-1042', status: 'focus', currentTask: 'Algoritma & Veri Yapıları', weeklyMinutes: 840, trees: 14, isOnline: true, cheersReceived: 3 },
  { id: 'f2', name: 'Emre Yılmaz', avatar: '👨‍🎨', code: 'ODAK-5521', status: 'focus', currentTask: 'UI Tasarım Sistemi Revizesi', weeklyMinutes: 720, trees: 12, isOnline: true, cheersReceived: 5 },
  { id: 'f3', name: 'Selin Demir', avatar: '👩‍🔬', code: 'ODAK-3982', status: 'break', currentTask: 'Kahve Molası ☕', weeklyMinutes: 610, trees: 10, isOnline: true, cheersReceived: 2 },
  { id: 'f4', name: 'Can Polat', avatar: '👨‍💻', code: 'ODAK-7119', status: 'idle', currentTask: 'Çevrimdışı', weeklyMinutes: 450, trees: 8, isOnline: false, cheersReceived: 0 },
  { id: 'f5', name: 'Mert Aksoy', avatar: '🧑‍🚀', code: 'ODAK-9923', status: 'idle', currentTask: 'Çevrimdışı', weeklyMinutes: 380, trees: 6, isOnline: false, cheersReceived: 1 }
];

function openRoutinesModal(){
  const formatter = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'long' });
  const dateStr = formatter.format(activeDate);
  const isToday = toDateKey(activeDate) === todayStr;
  
  const sub = document.getElementById('routines-modal-subtitle');
  if(sub) {
    sub.innerHTML = `Tekrarlayan rutinlerini <b>${isToday ? 'Bugün (' + dateStr + ')' : dateStr}</b> planına ekle:`;
  }

  renderRoutinesList();
  document.getElementById('routines-modal-backdrop')?.classList.add('active');
}

function closeRoutinesModal(){
  document.getElementById('routines-modal-backdrop')?.classList.remove('active');
  const form = document.getElementById('new-routine-form');
  if(form) form.style.display = 'none';
}

function renderRoutinesList(){
  const listEl = document.getElementById('routines-modal-list');
  if(!listEl) return;
  const activeKey = toDateKey(activeDate);

  if(!userRoutines.length){
    listEl.innerHTML = `<div style="text-align:center;padding:18px 10px;color:var(--text3);font-size:12px;">Kayıtlı rutin şablonu bulunmuyor.<br>Aşağıdan yeni rutin ekleyebilirsin.</div>`;
    return;
  }

  listEl.innerHTML = userRoutines.map(r => {
    const exists = tasks.some(t => t.date === activeKey && t.title === r.title);
    return `
      <div style="background:var(--bg3);border:1px solid ${exists ? 'rgba(82,199,133,0.35)' : 'var(--border)'};border-radius:12px;padding:9px 11px;display:flex;align-items:center;gap:10px;">
        <input type="checkbox" data-routine-id="${esc(r.id)}" ${exists ? '' : 'checked'} style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);">
        <span style="font-size:22px;line-height:1;">${esc(r.treeType || '🌳')}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.title)}</div>
          <div style="font-size:11px;color:var(--text3);display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap;">
            <span class="tag" style="padding:1px 6px;font-size:10px;">${esc(r.cat)}</span>
            <span>⏰ ${esc(r.start)} - ${esc(r.end)} (${esc(r.dur)} dk)</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
          ${exists 
            ? `<span style="font-size:9px;background:rgba(82,199,133,0.18);color:var(--accent);padding:2px 6px;border-radius:6px;font-weight:700;">✓ Planda Var</span>` 
            : `<span style="font-size:9px;background:var(--border2);color:var(--text2);padding:2px 6px;border-radius:6px;font-weight:600;">➕ Eklenecek</span>`}
          <button type="button" onclick="deleteUserRoutine(${jsArg(r.id)})" style="background:transparent;border:none;color:var(--text3);font-size:11px;cursor:pointer;padding:2px 4px;" title="Rutin Şablonunu Sil">Sil</button>
        </div>
      </div>
    `;
  }).join('');
}

function applySelectedRoutines(){
  const activeKey = toDateKey(activeDate);
  const checkboxes = document.querySelectorAll('#routines-modal-list input[type="checkbox"]');
  let addedCount = 0;

  checkboxes.forEach(chk => {
    if(chk.checked){
      const rId = chk.getAttribute('data-routine-id');
      const routine = userRoutines.find(r => String(r.id) === String(rId));
      if(routine){
        const exists = tasks.some(t => t.date === activeKey && t.title === routine.title);
        if(!exists){
          tasks.push({
            id: Date.now() + Math.floor(Math.random()*1000) + addedCount,
            title: routine.title,
            cat: routine.cat,
            dur: routine.dur,
            start: routine.start,
            end: routine.end,
            treeType: routine.treeType || '🌳',
            treeName: routine.treeName || 'Meşe',
            done: false,
            tree: false,
            date: activeKey
          });
          addedCount++;
        }
      }
    }
  });

  renderMain();
  saveStateToStorage();
  closeRoutinesModal();

  if(addedCount > 0){
    showAppToast(`${addedCount} rutin görevi "${activeKey}" planına eklendi!`, '🌿');
  } else {
    showAppToast('Seçilen rutinler bugünün planında zaten mevcut.', 'ℹ️');
  }
}

function addDailyRoutines(){
  // Tıklama yapıldığında direkt modalı açar
  openRoutinesModal();
}

function toggleNewRoutineForm(){
  const form = document.getElementById('new-routine-form');
  if(!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function saveNewRoutine(){
  const title = document.getElementById('nr-title').value.trim();
  if(!title){
    showAppToast('Lütfen bir rutin başlığı yazın!', '⚠️');
    return;
  }
  const cat = document.getElementById('nr-cat').value.trim() || 'Genel';
  const dur = parseInt(document.getElementById('nr-dur').value) || 30;
  const start = document.getElementById('nr-start').value || '08:30';
  const end = document.getElementById('nr-end').value || '09:00';

  const newR = {
    id: 'r_' + Date.now(),
    title,
    cat,
    dur,
    start,
    end,
    treeType: '🌳',
    treeName: 'Meşe'
  };

  userRoutines.push(newR);
  saveStateToStorage();
  
  document.getElementById('nr-title').value = '';
  document.getElementById('new-routine-form').style.display = 'none';
  renderRoutinesList();
  showAppToast(`"${title}" rutin şablonlarına kaydedildi!`, '✓');
}

function deleteUserRoutine(id){
  userRoutines = userRoutines.filter(r => String(r.id) !== String(id));
  saveStateToStorage();
  renderRoutinesList();
  showAppToast('Rutin şablonu silindi.', '🗑️');
}

/* ══════════════════════════════════════════════════════
   4. SAYACIN ALTINDA ODAK SÖZLERİ (MİNİMALİST ALINTILAR)
   ══════════════════════════════════════════════════════ */
const FOCUS_QUOTES = [
  { text: "Ruhunu gereksiz şeylerden arındır; tek bir işe tüm dikkatinle odaklan.", author: "Marcus Aurelius" },
  { text: "Zamanını iyi kullanan insan için hiçbir şey imkansız değildir.", author: "Seneca" },
  { text: "Derin odaklanma, dikkat dağınıklığının hüküm sürdüğü bu çağda bir süper güçtür.", author: "Cal Newport (Pürdikkat)" },
  { text: "Büyük işler, bir araya gelen küçük çabaların toplamıdır.", author: "Vincent van Gogh" },
  { text: "Basitlik, en yüksek gelişmişlik düzeyidir.", author: "Leonardo da Vinci" },
  { text: "Yaptığın işi öyle sev ki, zamanın nasıl geçtiğini unut.", author: "Konfüçyüs" },
  { text: "Zihnin sakin kaldığı yerde, en karmaşık engeller bile berraklaşır.", author: "Epiktetos" },
  { text: "En büyük zafer, dikkatin dağılmadan şimdiki anı fethedebilmektir.", author: "Lao Tzu" }
];

function pickRandomQuote(){
  const q = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
  const txt = document.getElementById('foc-quote-text');
  const auth = document.getElementById('foc-quote-author');
  if(txt && auth){
    txt.textContent = `"${q.text}"`;
    auth.textContent = `— ${q.author}`;
  }
}

/* ══════════════════════════════════════════════════════
   6. GÜN SONU BAŞARI KARTI (HER GÜN FARKLI ALINTI)
   ══════════════════════════════════════════════════════ */
const DAILY_SHARE_QUOTES = [
  { text: "Ruhunu gereksiz şeylerden arındır; tek bir işe tüm dikkatinle odaklan.", author: "Marcus Aurelius" },
  { text: "Zamanını iyi kullanan insan için hiçbir şey imkansız değildir.", author: "Seneca" },
  { text: "Derin odaklanma, dikkat dağınıklığının hüküm sürdüğü bu çağda bir süper güçtür.", author: "Cal Newport (Pürdikkat)" },
  { text: "Büyük işler, bir araya gelen küçük çabaların toplamıdır.", author: "Vincent van Gogh" },
  { text: "Bir ağaç gibi tek ve hür, ve bir orman gibi kardeşçesine.", author: "Nâzım Hikmet" },
  { text: "Sabır, hedefe giden yolda atılan en kararlı adımdır.", author: "Mevlânâ Celâleddîn-i Rûmî" },
  { text: "Her gün küçük bir disiplin, zamanla devasa bir başarı ormanı yaratır.", author: "James Clear" },
  { text: "Yavaş ilerlemekten korkma; asıl korkman gereken şey yerinde saymaktır.", author: "Konfüçyüs" },
  { text: "Bir nehri temizlemek istiyorsan, kaynağına odaklanmalısın.", author: "Epiktetos" },
  { text: "En büyük zafer, insanın kendi dikkatini fethedebilmesidir.", author: "Platon" },
  { text: "Zanaatın ve ustalığın sırrı, sabırla tekrarlanan sessiz emektir.", author: "Ahi Evran" },
  { text: "Bugün toprağa bıraktığın tohum, yarının serin gölgesidir.", author: "Kadim Özdeyiş" },
  { text: "Zihnin berraklığı, gereksiz her şeyi geride bıraktığında başlar.", author: "Laozi" },
  { text: "Zaman, en adil dağıtılmış ama en az kıymeti bilinen hazinedir.", author: "Michel de Montaigne" },
  { text: "Fırtınanın gücü ne olursa olsun, kökleri derin olan ağaç eğilmez.", author: "Bilgelik Sözü" },
  { text: "Odaklanmak 'evet' demek değil; yüzlerce harika fikre 'hayır' diyebilmektir.", author: "Steve Jobs" },
  { text: "Başarı bir varış noktası değil, her gün sessizce attığın odaklı adımlardır.", author: "Robin Sharma" },
  { text: "Gürültülü bir dünyada sessizce çalışmak en büyük ayrıcalıktır.", author: "Susan Cain" },
  { text: "Bugün gösterdiğin özen, geleceğine bıraktığın en kıymetli mirastır.", author: "Seneca" },
  { text: "Bir işe tüm kalbin ve zihninle bağlandığında pürdikkat akış başlar.", author: "Mihaly Csikszentmihalyi" },
  { text: "Damlaya damlaya göl, odaklana odaklana koca bir orman olur.", author: "Anadolu Atasözü" },
  { text: "Kendi iç huzurunu bulan insan, en zor işleri bile zarafetle tamamlar.", author: "Marcus Aurelius" },
  { text: "Zaman bir nehir gibidir; anın kıymetini bilen geleceğini inşa eder.", author: "Herakleitos" },
  { text: "Kendini tanımak ve dikkatini yönetmek, bilgeliğin başlangıcıdır.", author: "Sokrates" },
  { text: "Her biten odak seansı, zihninde yeni ve taze bir yaprak açtırır.", author: "Odak Ajandası" },
  { text: "Sabır ve zaman, güç ve öfkeden çok daha büyük işler başarır.", author: "La Fontaine" },
  { text: "Dikkatini nereye verirsen, hayatın orada yeşerir.", author: "Feridüddin Attâr" },
  { text: "Zihnin sessizliği, en derin yaratıcılığın ve üretkenliğin doğduğu yerdir.", author: "Eckhart Tolle" },
  { text: "Bir ustanın eseri, acele edilmemiş anların toplamıdır.", author: "Uzakdoğu Felsefesi" },
  { text: "Günü kurtarmak değil, günü anlamlandırmak için odaklandın.", author: "Stoacı Felsefe" },
  { text: "Yapabileceğin en iyi yatırım, kendi dikkatine ve zihnine yaptığındır.", author: "Warren Buffett" },
  { text: "Basitlik, en yüksek gelişmişlik düzeyidir.", author: "Leonardo da Vinci" },
  { text: "Hayat, ona verdiğin odak kadar zengin ve anlamlıdır.", author: "William James" },
  { text: "Kökleri derinde olan bir ağacın meyvesi tatlı, gölgesi bereketli olur.", author: "Yunus Emre" }
];

let currentShareQuoteOffset = 0;

function getDailyShareQuote(dateObj, offset = 0){
  const d = dateObj || activeDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  // Her gün için deterministik farklı bir indeks üretir
  const seed = Math.abs((year * 372) + (month * 31) + day + offset);
  const idx = seed % DAILY_SHARE_QUOTES.length;
  return DAILY_SHARE_QUOTES[idx];
}

function cycleShareQuote(e){
  if(e) e.stopPropagation();
  currentShareQuoteOffset++;
  const q = getDailyShareQuote(activeDate, currentShareQuoteOffset);
  const qEl = document.getElementById('sp-quote');
  const aEl = document.getElementById('sp-author');
  if(qEl && aEl){
    qEl.style.opacity = '0';
    aEl.style.opacity = '0';
    setTimeout(()=>{
      qEl.textContent = `"${q.text}"`;
      aEl.textContent = `— ${q.author}`;
      qEl.style.opacity = '1';
      aEl.style.opacity = '1';
    }, 150);
  }
}

function showShareCard(){
  const activeKey = toDateKey(activeDate);
  const daySessions = getUnifiedStatsList().filter(h => h.rawDate === activeKey && !h.failed);
  const totalMin = daySessions.reduce((a,b)=>a+(b.dur||0), 0);
  const treeCount = daySessions.length;
  streakDays = calculateStreakDays();
  
  const formatter = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'long' });
  const dateStr = formatter.format(activeDate);

  document.getElementById('sp-date').textContent = dateStr;
  document.getElementById('sp-stat-num').textContent = `${treeCount} Ağaç Yetiştirildi · ${totalMin} Dk`;
  document.getElementById('sp-streak').textContent = `🔥 ${streakDays} Günlük Kesintisiz Seri`;
  
  const icons = daySessions.length ? daySessions.map(s => s.treeType || '🌳').slice(0, 6).join(' ') : '🌱 🌿 🌳';
  document.getElementById('sp-icons').textContent = icons;

  // Günün benzersiz sözü (tarihe göre her gün farklı)
  currentShareQuoteOffset = 0;
  const q = getDailyShareQuote(activeDate, 0);
  document.getElementById('sp-quote').textContent = `"${q.text}"`;
  const aEl = document.getElementById('sp-author');
  if(aEl) aEl.textContent = `— ${q.author}`;

  document.getElementById('share-modal-backdrop').classList.add('active');
}

function closeShareModal(){
  document.getElementById('share-modal-backdrop').classList.remove('active');
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for(let n = 0; n < words.length; n++){
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if(metrics.width > maxWidth && n > 0){
      ctx.fillText(line.trim(), x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, curY);
  return curY;
}

function downloadShareImage(){
  const canvas = document.getElementById('share-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  // Arka Plan Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 700);
  grad.addColorStop(0, '#0D1512');
  grad.addColorStop(1, '#1A3326');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 700);

  // Yeşil Kenarlık
  ctx.strokeStyle = '#52C785';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 560, 660);

  // Logo & Başlık
  ctx.fillStyle = '#52C785';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌲 ODAK AJANDASI · GÜN SONU BAŞARISI', 300, 75);

  // Tarih
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '22px sans-serif';
  ctx.fillText(document.getElementById('sp-date').textContent, 300, 125);

  // İkonlar
  ctx.font = '54px sans-serif';
  ctx.fillText(document.getElementById('sp-icons').textContent, 300, 215);

  // İstatistik
  ctx.fillStyle = '#52C785';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(document.getElementById('sp-stat-num').textContent, 300, 305);

  // Seri
  ctx.fillStyle = '#CBD5E1';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(document.getElementById('sp-streak').textContent, 300, 355);

  // Ayraç Çizgisi
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 400);
  ctx.lineTo(520, 400);
  ctx.stroke();

  // Çok Satırlı Günün Alıntısı
  ctx.fillStyle = '#CBD5E1';
  ctx.font = 'italic 16.5px sans-serif';
  const quoteText = document.getElementById('sp-quote').textContent;
  const endY = drawWrappedText(ctx, quoteText, 300, 450, 470, 25);

  // Yazar
  const authorText = document.getElementById('sp-author')?.textContent || '';
  if(authorText){
    ctx.fillStyle = '#52C785';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(authorText, 300, endY + 28);
  }

  // Alt Etiket
  ctx.fillStyle = '#52C785';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('🌱 Odaklanarak Ormanını Büyüt', 300, 640);

  // İndirme Bağlantısı
  const link = document.createElement('a');
  link.download = `odak-basari-${toDateKey(activeDate)}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAppToast('Başarı kartı görsel olarak indirildi! 📥', '✓');
}

function shareSummaryText(){
  const dateStr = document.getElementById('sp-date').textContent;
  const statStr = document.getElementById('sp-stat-num').textContent;
  const streakStr = document.getElementById('sp-streak').textContent;
  const quoteStr = document.getElementById('sp-quote').textContent;
  const authorStr = document.getElementById('sp-author')?.textContent || '';
  const shareText = `🌲 Odak Ajandası Gün Sonu Başarım:\n📅 ${dateStr}\n✨ ${statStr}\n${streakStr}\n\n💬 ${quoteStr}\n${authorStr}\n\n🌱 Odaklanarak ormanımı büyütüyorum!`;

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(shareText).then(()=>{
      showAppToast('Başarı özeti panoya kopyalandı! 📋', '✓');
    }).catch(()=>{
      prompt('Özeti kopyala:', shareText);
    });
  } else {
    prompt('Özeti kopyala:', shareText);
  }
}

/* ══════════════════════════════════════════════════════
   7. GÜNLÜK KISA NOT / DEĞERLENDİRME (MICRO-JOURNALING)
   ══════════════════════════════════════════════════════ */
let dailyNotes = {
  [todayStr]: "Bugün üretim hattında harika bir odak yakaladım."
};
let isEditingJournal = false;

function escapeJournalHtml(str){
  if(!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateJournalUI(){
  const container = document.getElementById('daily-journal-card');
  if(!container) return;
  container.style.display = 'none';
  container.innerHTML = '';
}

function editDailyJournal(){
  isEditingJournal = true;
  updateJournalUI();
  updateDailyGoalUI();
  const inp = document.getElementById('daily-journal-inp');
  if(inp){
    inp.focus();
    inp.select();
  }
}

function cancelEditJournal(){
  isEditingJournal = false;
  updateJournalUI();
  updateDailyGoalUI();
}

function saveDailyJournal(){
  const inp = document.getElementById('daily-journal-inp');
  if(!inp) return;
  const val = inp.value.trim();
  const activeKey = toDateKey(activeDate);
  
  if(!val){
    delete dailyNotes[activeKey];
  } else {
    dailyNotes[activeKey] = val;
  }
  
  isEditingJournal = false;
  saveStateToStorage();
  updateJournalUI();
  updateDailyGoalUI();
  
  if(val){
    showAppToast('Günün kapanış notu kaydedildi! 📖', '✓');
  } else {
    showAppToast('Kapanış notu temizlendi.', 'ℹ️');
  }
}

function deleteDailyJournal(){
  const activeKey = toDateKey(activeDate);
  delete dailyNotes[activeKey];
  isEditingJournal = false;
  saveStateToStorage();
  updateJournalUI();
  updateDailyGoalUI();
  showAppToast('Kapanış notu silindi.', '🗑️');
}


/* SESSİZ OTOMATİK VERİ KAYDI (HER SANİYE VE HER EYLEMDE ÇALIŞIR) */
