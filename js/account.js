/* ══════════════════════════════════════════════════════
   ⚡ SUPABASE & SQLITE BULUT HESAP DOĞRULAMA & KALICI EŞİTLEME SİSTEMİ
   ══════════════════════════════════════════════════════ */
const SUPABASE_CONFIG = {
  url: "https://argffidtpmkwdvlkipru.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZ2ZmaWR0cG1rd2R2bGtpcHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTM5MjgsImV4cCI6MjEwOTIyOTkyOH0.ab6dfzlcXdOZni949_emRC1JNjXlG6Gn9YQZt5jcTsg"
};

let supabaseClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
} catch(e) {
  console.warn('Supabase client init:', e);
}

let currentUser = null;
let currentAuthToken = null; // Supabase oturumundan doldurulur (checkStoredAuthToken)

/* ══════════════════════════════════════════════════════
   KULLANICI PROFİLİ, AVATAR VE İSİM YÖNETİMİ
   ══════════════════════════════════════════════════════ */
const AVATAR_OPTIONS = ['👤', '🧘', '🌳', '🚀', '⚡', '🦁', '🦉', '🦊', '🐼', '🎯', '💻', '🎨', '📚', '☕', '🌟'];

let userProfile = {
  name: 'Odak Kullanıcısı',
  avatar: '👤',
  title: 'Odak Yolcusu 🌱'
};

try {
  const savedProfile = localStorage.getItem('ODAK_USER_PROFILE');
  if(savedProfile){
    userProfile = Object.assign(userProfile, JSON.parse(savedProfile));
  }
} catch(e){}

function saveUserProfileToStorage(){
  try {
    localStorage.setItem('ODAK_USER_PROFILE', JSON.stringify(userProfile));
  } catch(e){}
}

// Avatar: yalnızca emoji ya da base64 data:image kabul edilir (OdakCore.normalizeAvatar).
// Eskiden uzaktan gelen her http(s)/blob URL'si <img src> içine kaçışsız konuyordu.
function renderAvatarHtml(av, size = 36){
  av = OdakCore.normalizeAvatar(av);
  const px = Math.round((Number(size) || 36) * 0.58);
  if(OdakCore.isImageAvatar(av)){
    return `<img src="${esc(av)}" alt="Profil Fotoğrafı" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
  }
  return `<span style="font-size:${px}px;line-height:1;display:flex;align-items:center;justify-content:center;user-select:none;">${esc(av)}</span>`;
}

function triggerPhotoUpload(){
  const inp = document.getElementById('profile-photo-inp');
  if(inp) inp.click();
}

function handlePhotoUpload(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  // Tekrar aynı dosya seçilebilsin diye dosya girdisini sıfırla
  e.target.value = '';

  if(!file.type || !file.type.startsWith('image/')){
    showAppToast('Lütfen geçerli bir görsel dosyası seçin.', '⚠️');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt){
    const rawDataUrl = evt.target.result;
    if(!rawDataUrl) return;

    // Fotoğrafı hafifletmek ve performansı korumak için 128x128 kareye kırp ve sıkıştır
    try {
      const img = new Image();
      img.onload = function(){
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 128, 128);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          applyNewAvatar(compressed, true);
        } catch(canvasErr){
          console.warn('Canvas sıkıştırma yedeğe geçti:', canvasErr);
          applyNewAvatar(rawDataUrl, true);
        }
      };
      img.onerror = function(){
        applyNewAvatar(rawDataUrl, true);
      };
      img.src = rawDataUrl;
    } catch(err){
      applyNewAvatar(rawDataUrl, true);
    }
  };
  reader.onerror = function(){
    showAppToast('Görsel okunurken bir sorun oluştu.', '⚠️');
  };
  reader.readAsDataURL(file);
}

function applyNewAvatar(av, isPhoto = false){
  av = OdakCore.normalizeAvatar(av);
  userProfile.avatar = av;
  if(currentUser) currentUser.avatar = av;

  // 1. Yerel hafızaya kaydet
  saveUserProfileToStorage();

  // 2. Kullanıcı ekranı önizlemelerini güncelle
  renderUserProfileUI();
  updateCloudAuthUI();

  // 3. Arkadaşlar ekranındaki profil kartını ve sıralama listesini anında güncelle
  try { renderFriends(); } catch(err){}

  // 4. Kullanıcıya net bildirim ver
  if(isPhoto){
    showAppToast('Profil fotoğrafınız başarıyla yüklendi! 📸', '✅');
  } else {
    showAppToast(`Profil simgesi "${av}" olarak güncellendi! ✨`, '🎨');
  }

  // 5. Sunucuya senkronize et
  syncUserProfileToServer();
}

function removeProfilePhoto(){
  applyNewAvatar('👤', false);
  showAppToast('Profil fotoğrafı kaldırıldı, simgeye dönüldü.', 'ℹ️');
}

function selectProfileAvatar(av){
  applyNewAvatar(av, false);
}

function handleProfileNameInput(val){
  const cleanVal = (val || '').trim();
  userProfile.name = cleanVal || 'Odak Kullanıcısı';
  if(currentUser) currentUser.name = userProfile.name;

  const previewName = document.getElementById('profile-preview-name');
  if(previewName) previewName.textContent = userProfile.name;

  const friendsSelfName = document.getElementById('friends-self-name');
  if(friendsSelfName) friendsSelfName.textContent = userProfile.name;

  saveUserProfileToStorage();
  try { renderFriends(); } catch(err){}
}

function renderUserProfileUI(){
  const previewAvatar = document.getElementById('profile-preview-avatar');
  const previewName = document.getElementById('profile-preview-name');
  const previewTitle = document.getElementById('profile-preview-title');
  const nameInp = document.getElementById('profile-name-inp');
  const titleInp = document.getElementById('profile-title-inp');
  const cloudAvatar = document.getElementById('cloud-user-avatar');

  const displayName = userProfile.name || (currentUser && currentUser.name) || 'Odak Kullanıcısı';
  const displayAvatar = userProfile.avatar || (currentUser && currentUser.avatar) || '👤';
  const displayTitle = userProfile.title || 'Odak Yolcusu 🌱';

  if(previewAvatar) previewAvatar.innerHTML = renderAvatarHtml(displayAvatar, 54);
  if(cloudAvatar) cloudAvatar.innerHTML = renderAvatarHtml(displayAvatar, 38);
  if(previewName) previewName.textContent = displayName;
  if(previewTitle) previewTitle.textContent = displayTitle;
  if(nameInp && document.activeElement !== nameInp) nameInp.value = displayName;
  if(titleInp && document.activeElement !== titleInp) titleInp.value = displayTitle;

  const removePhotoBtn = document.getElementById('btn-remove-photo');
  if(removePhotoBtn){
    const isImage = typeof displayAvatar === 'string' && (displayAvatar.startsWith('data:') || displayAvatar.startsWith('http'));
    removePhotoBtn.style.display = isImage ? 'inline-block' : 'none';
  }

  const grid = document.getElementById('avatar-picker-grid');
  if(grid){
    grid.innerHTML = AVATAR_OPTIONS.map(av => `
      <button type="button" class="avatar-btn ${av === displayAvatar ? 'selected' : ''}" onclick="selectProfileAvatar(${jsArg(av)})" title="Avatar: ${esc(av)}">
        ${esc(av)}
      </button>
    `).join('');
  }
}

function saveProfileName(){
  const inp = document.getElementById('profile-name-inp');
  if(!inp) return;
  const val = inp.value.trim();
  if(!val){
    alert('Lütfen geçerli bir kullanıcı adı girin.');
    return;
  }
  userProfile.name = val;
  if(currentUser) currentUser.name = val;
  saveUserProfileToStorage();
  renderUserProfileUI();
  updateCloudAuthUI();
  try { renderFriends(); } catch(e){}
  showAppToast(`Kullanıcı adınız "${val}" olarak kaydedildi! ✓`, '👤');
  syncUserProfileToServer();
}

function saveProfileTitle(){
  const inp = document.getElementById('profile-title-inp');
  if(!inp) return;
  const val = inp.value.trim();
  userProfile.title = val || 'Odak Yolcusu 🌱';
  saveUserProfileToStorage();
  renderUserProfileUI();
  showAppToast('Durum notunuz kaydedildi! 🌿', '📝');
  syncUserProfileToServer();
}

// Profil adı/durum notu Supabase kullanıcı bilgisine yazılır (avatar fotoğrafı yerelde kalır).
function syncUserProfileToServer(){
  if(!supabaseClient || !currentUser) return;
  supabaseClient.auth.updateUser({ data: { name: userProfile.name, title: userProfile.title } }).catch(()=>{});
}

function updateCloudAuthUI(){
  const loggedOutBox = document.getElementById('cloud-auth-logged-out');
  const loggedInBox = document.getElementById('cloud-auth-logged-in');
  const badge = document.getElementById('cloud-status-badge');
  
  if(!badge) return;

  if(currentUser && currentAuthToken){
    if(loggedOutBox) loggedOutBox.style.display = 'none';
    if(loggedInBox) loggedInBox.style.display = 'block';
    
    badge.innerHTML = '🟢 Bulut Aktif';
    badge.style.color = 'var(--accent)';
    badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    badge.style.background = 'var(--accent-soft)';

    const nameEl = document.getElementById('cloud-user-name');
    const emailEl = document.getElementById('cloud-user-email');
    const avatarEl = document.getElementById('cloud-user-avatar');
    if(nameEl) nameEl.textContent = currentUser.name || userProfile.name || 'Odak Kullanıcısı';
    if(emailEl) emailEl.textContent = currentUser.email || '';
    if(avatarEl) avatarEl.innerHTML = renderAvatarHtml(userProfile.avatar || '👤', 38);
  } else {
    if(loggedOutBox) loggedOutBox.style.display = 'block';
    if(loggedInBox) loggedInBox.style.display = 'none';

    badge.innerHTML = '💾 Yerel Hafıza';
    badge.style.color = 'var(--text3)';
    badge.style.borderColor = 'var(--border)';
    badge.style.background = 'transparent';
  }
}

/*
 * Hesap işlemleri doğrudan Supabase Auth ile yapılır.
 * Eskiden önce /api/auth/... adreslerine istek atılıyordu; bu adresler
 * GitHub Pages'te yok (sadece geliştiricinin yerel sunucusunda vardı), her
 * seferinde 404 alınıp Supabase'e düşülüyordu.
 * Veri güvenliği Supabase tarafındaki satır güvenliği (RLS) kurallarına
 * dayanır: bkz. supabase/schema.sql
 */
function readAuthForm(){
  const email = (document.getElementById('auth-input-email')?.value || '').trim().toLowerCase();
  const password = document.getElementById('auth-input-password')?.value || '';
  return { email, password };
}

function onSignedIn(user, session, isNew){
  currentUser = { id: user.id, email: user.email, name: user.user_metadata?.name || user.email.split('@')[0] };
  currentAuthToken = session ? session.access_token : null;
  if(currentUser.name) userProfile.name = currentUser.name;
  saveUserProfileToStorage();
  renderUserProfileUI();
  updateCloudAuthUI();
  try { renderFriends(); } catch(e){}
  if(isNew){
    showAppToast('Hesabın oluşturuldu, verilerin buluta yedekleniyor.', '⚡');
    forceCloudSyncPush();
  } else {
    showAppToast('Giriş yapıldı, verilerin buluttan alınıyor…', '⚡');
    forceCloudSyncPull();
  }
}

async function handleAuthRegister(){
  const { email, password } = readAuthForm();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8){
    alert('Lütfen geçerli bir e-posta ve en az 8 karakterli bir şifre girin.');
    return;
  }
  if(!supabaseClient){ alert('Bulut bağlantısı kurulamadı.'); return; }
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { name: email.split('@')[0] } } });
    if(error) throw error;
    if(data.session) onSignedIn(data.user, data.session, true);
    else alert('Kayıt alındı. E-postana gelen doğrulama bağlantısına tıkladıktan sonra giriş yapabilirsin.');
  } catch(err){
    alert('Kayıt yapılamadı: ' + (err.message || err));
  }
}

async function handleAuthLogin(){
  const { email, password } = readAuthForm();
  if(!email || !password){ alert('Lütfen e-posta ve şifrenizi girin.'); return; }
  if(!supabaseClient){ alert('Bulut bağlantısı kurulamadı.'); return; }
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error) throw error;
    onSignedIn(data.user, data.session, false);
  } catch(err){
    alert('Giriş yapılamadı: ' + (err.message || err));
  }
}

function resetAllApplicationData(isLogout = false){
  // 1. Devam eden odak seansı veya mola varsa sonlandır
  if(typeof isFocusing !== 'undefined' && (isFocusing || isBreakMode || isShortBreak)){
    try { exitFocus(); } catch(e){}
  }
  try { stopAmbientSound(); } catch(e){}
  try { closeSideDrawer(); } catch(e){}

  // 2. Bulut oturumunu kapat
  if(supabaseClient) {
    try { supabaseClient.auth.signOut(); } catch(e){}
  }

  // 3. Kullanıcı kimlik & oturum bilgilerini tamamen sıfırla
  currentUser = null;
  currentAuthToken = null;

  // 4. TÜM VERİLERİ VE İSTATİSTİKLERİ TAMAMEN SIFIRLA
  tasks = [];
  focusHistory = [];
  inbox = [];
  dailyNotes = {};
  streakDays = 0;
  dailyGoalMinutes = 120;
  activeTask = null;
  selectedStatsCategory = null;
  calSelectedDateKey = toDateKey(new Date());
  calCurrentDate = new Date();

  userProfile = {
    name: 'Odak Kullanıcısı',
    avatar: '👤',
    title: 'Odak Yolcusu 🌱'
  };

  if(typeof DEFAULT_ROUTINES !== 'undefined'){
    userRoutines = JSON.parse(JSON.stringify(DEFAULT_ROUTINES));
  }

  // 5. Tarayıcı depolama alanlarını (localStorage & sessionStorage) tamamen temizle
  try { localStorage.clear(); } catch(e){}
  try { sessionStorage.clear(); } catch(e){}

  // 6. Sıfırlanmış boş durumu yerel depolamaya kaydet
  saveStateToStorage();

  // 7. Form girdilerini temizle
  const emailInp = document.getElementById('auth-input-email');
  if(emailInp) emailInp.value = '';
  const passInp = document.getElementById('auth-input-password');
  if(passInp) passInp.value = '';
  const nameInp = document.getElementById('profile-name-inp');
  if(nameInp) nameInp.value = 'Odak Kullanıcısı';
  const titleInp = document.getElementById('profile-title-inp');
  if(titleInp) titleInp.value = 'Odak Yolcusu 🌱';

  // 8. Tüm ekranları sıfırdan yeniden çiz
  updateCloudAuthUI();
  renderUserProfileUI();
  renderMain();
  renderForest();
  renderStats();
  try { renderFriends(); } catch(e){}
  updateDailyGoalUI();

  // 9. Performans Dökümü ve Odak Analizleri dökümlerini doğrudan garanti sıfırla
  const boxesEl = document.getElementById('stats-boxes');
  if(boxesEl){
    boxesEl.innerHTML = `
      <div class="stat-box"><span class="slabel">Toplam Odak</span><span class="sval" style="color:var(--accent);">0 dk</span><span class="ssub">⏱️ 0 dk</span></div>
      <div class="stat-box"><span class="slabel">Ağaç</span><span class="sval">0</span><span class="ssub">🌳 yetişen</span></div>
      <div class="stat-box"><span class="slabel">Seri</span><span class="sval">0 gün</span><span class="ssub">🔥 kesintisiz</span></div>`;
  }
  const catBarsEl = document.getElementById('stats-cat-bars');
  if(catBarsEl){
    catBarsEl.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:14px 0;">Bu dönemde henüz kategori verisi bulunmuyor. 🌱</div>';
  }
  const dailyEl = document.getElementById('stats-daily-breakdown');
  if(dailyEl){
    dailyEl.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:14px 0;">Bu aralıkta kayıtlı gün bulunamadı. 🌱</div>';
  }
  const hl = document.getElementById('history-list');
  if(hl){
    hl.innerHTML = '<div class="empty"><div class="ei">📭</div><p>Henüz tamamlanan odak yok.</p></div>';
  }

  showAppToast(isLogout ? 'Hesaptan çıkış yapıldı ve tüm analizler & dökümler sıfırlandı. 🌿' : 'Tüm veriler, analizler ve dökümler sıfırlandı! 🧹', '🧹');
  // Arkadaşlık anahtarı da silindi; bellekteki eski anahtarın tekrar kaydedilmemesi için sayfayı yeniden yükle.
  setTimeout(() => location.reload(), 1200);
}

function handleAuthLogout(){
  resetAllApplicationData(true);
}

window.resetAllApplicationData = resetAllApplicationData;
window.handleAuthLogout = handleAuthLogout;

let cloudPushTimer = null;

function collectSyncPayload(){
  return { tasks, focusHistory, inbox, dailyNotes, userRoutines, dailyGoalMinutes };
}

// Buluttan (veya eski kayıttan) gelen veri, yedek dosyasıyla AYNI doğrulamadan geçer.
function applyValidatedState(raw){
  const { data, report } = OdakCore.sanitizeBackup(raw, toDateKey(new Date()));
  if(data.tasks) tasks = data.tasks.filter(t => !isMockStatsEntry(t));
  if(data.focusHistory) focusHistory = data.focusHistory.filter(h => !isMockStatsEntry(h));
  if(data.inbox) inbox = data.inbox;
  if(data.dailyNotes) dailyNotes = data.dailyNotes;
  if(data.userRoutines && data.userRoutines.length) userRoutines = data.userRoutines;
  if(data.dailyGoalMinutes) dailyGoalMinutes = data.dailyGoalMinutes;
  streakDays = calculateStreakDays();
  return report;
}

async function forceCloudSyncPush(){
  if(!supabaseClient || !currentUser) return;
  try {
    const { error } = await supabaseClient.from('user_state').upsert({
      user_id: currentUser.id,
      tasks,
      focus_history: focusHistory,
      inbox,
      daily_notes: dailyNotes,
      daily_goal_minutes: dailyGoalMinutes
    });
    if(error) throw error;
    const lbl = document.getElementById('cloud-last-sync-label');
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    if(lbl) lbl.textContent = `Son senkronizasyon: ${nowTime}`;
  } catch(e){
    console.warn('Bulut yedekleme hatası:', e);
  }
}

async function forceCloudSyncPull(){
  if(!supabaseClient || !currentUser) return;
  try {
    const { data, error } = await supabaseClient.from('user_state').select('*').eq('user_id', currentUser.id).maybeSingle();
    if(error) throw error;
    if(!data){ forceCloudSyncPush(); return; }
    applyValidatedState({
      tasks: data.tasks, focusHistory: data.focus_history, inbox: data.inbox,
      dailyNotes: data.daily_notes, dailyGoalMinutes: data.daily_goal_minutes
    });
    saveStateToStorage();
    renderMain();
    renderForest();
    renderStats();
    updateDailyGoalUI();
    try { renderFriends(); } catch(e){}
    showAppToast('Verilerin buluttan yüklendi.', '☁️');
  } catch(e){
    console.warn('Buluttan okuma hatası:', e);
  }
}

async function checkStoredAuthToken(){
  if(!supabaseClient){ updateCloudAuthUI(); return; }
  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data && data.session;
    if(session && session.user){
      const u = session.user;
      currentUser = { id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0] };
      currentAuthToken = session.access_token;
      updateCloudAuthUI();
      forceCloudSyncPull();
      return;
    }
  } catch(e){}
  currentUser = null;
  currentAuthToken = null;
  try { localStorage.removeItem('ODAK_AUTH_TOKEN'); } catch(e){}
  updateCloudAuthUI();
}

let lastSavedStateJson = '';

// Değişiklik varsa yerel depoya yazar; giriş yapılmışsa 5 sn sonra buluta da gönderir.
function saveStateToStorage(){
  let json = '';
  try {
    json = JSON.stringify({
      version: '3.0',
      tasks,
      focusHistory,
      inbox,
      dailyNotes,
      userRoutines,
      autoMode,
      manualDark,
      soundEnabled,
      planRemindersEnabled
    });
  } catch(e){ return; }
  if(json === lastSavedStateJson) return;
  lastSavedStateJson = json;
  try { localStorage.setItem(STORAGE_KEY, json); } catch(e){ /* depolama dolu/kapalı */ }

  if(currentUser){
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(forceCloudSyncPush, 5000);
  }
}

function loadStateFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    const report = applyValidatedState(data);
    if(report.tasksDropped || report.historyDropped){
      console.warn('Yerel kayıtta geçersiz veri atlandı:', report);
    }
    if(typeof data.autoMode === 'boolean') autoMode = data.autoMode;
    if(typeof data.manualDark === 'boolean') manualDark = data.manualDark;
    if(typeof data.soundEnabled === 'boolean') soundEnabled = data.soundEnabled;
    if(typeof data.planRemindersEnabled === 'boolean') planRemindersEnabled = data.planRemindersEnabled;
    return true;
  } catch(e){
    console.warn('Storage read error:', e);
  }
  return false;
}

// Güvenlik ağı: her 5 sn'de bir değişiklik var mı bak (değişmediyse hiçbir şey yazılmaz).
setInterval(saveStateToStorage, 5000);
window.addEventListener('pagehide', saveStateToStorage);
