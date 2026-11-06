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
let currentAuthToken = localStorage.getItem('ODAK_AUTH_TOKEN') || null;

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

function syncUserProfileToServer(){
  if(!currentAuthToken) return;
  fetch('/api/auth/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentAuthToken}`
    },
    body: JSON.stringify({ name: userProfile.name, avatar: userProfile.avatar, title: userProfile.title })
  }).catch(()=>{});
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

function handleAuthRegister(){
  const emailInp = document.getElementById('auth-input-email');
  const passInp = document.getElementById('auth-input-password');
  const email = emailInp?.value.trim().toLowerCase();
  const password = passInp?.value.trim();

  if(!email || !password || password.length < 6){
    alert('Lütfen geçerli bir e-posta ve en az 6 karakterli bir şifre girin.');
    return;
  }

  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: email.split('@')[0] })
  })
  .then(res => res.json())
  .then(data => {
    if(data.error){
      alert('Kayıt Hatası: ' + data.error);
      return;
    }
    currentUser = data.user;
    if(currentUser.name) userProfile.name = currentUser.name;
    if(currentUser.avatar) userProfile.avatar = currentUser.avatar;
    saveUserProfileToStorage();
    renderUserProfileUI();
    currentAuthToken = data.token;
    localStorage.setItem('ODAK_AUTH_TOKEN', data.token);
    updateCloudAuthUI();
    showAppToast(`Hoş geldin ${currentUser.name}! Hesabın oluşturuldu. 🎉`, '⚡');
    forceCloudSyncPush();
  })
  .catch(async () => {
    if(supabaseClient){
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { name: email.split('@')[0] } }
        });
        if(error) throw error;
        if(data.session){
          currentUser = { id: data.user.id, email: data.user.email, name: email.split('@')[0] };
          currentAuthToken = data.session.access_token;
          localStorage.setItem('ODAK_AUTH_TOKEN', currentAuthToken);
          updateCloudAuthUI();
          showAppToast(`Hoş geldin! Supabase hesabın oluşturuldu. 🎉`, '⚡');
          forceCloudSyncPush();
          return;
        } else {
          alert('Kayıt başarılı! Hesabınız oluşturuldu.');
          return;
        }
      } catch(sbErr) {
        alert('Supabase Kayıt Hatası: ' + sbErr.message);
        return;
      }
    }
    alert('Sunucu veya internet bağlantı hatası.');
  });
}

function handleAuthLogin(){
  const emailInp = document.getElementById('auth-input-email');
  const passInp = document.getElementById('auth-input-password');
  const email = emailInp?.value.trim().toLowerCase();
  const password = passInp?.value.trim();

  if(!email || !password){
    alert('Lütfen e-posta ve şifrenizi girin.');
    return;
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {
    if(data.error){
      alert('Giriş Başarısız: ' + data.error);
      return;
    }
    currentUser = data.user;
    if(currentUser.name) userProfile.name = currentUser.name;
    if(currentUser.avatar) userProfile.avatar = currentUser.avatar;
    saveUserProfileToStorage();
    renderUserProfileUI();
    currentAuthToken = data.token;
    localStorage.setItem('ODAK_AUTH_TOKEN', data.token);
    updateCloudAuthUI();
    showAppToast(`Giriş yapıldı! Verilerin eşitleniyor... 🔄`, '⚡');
    forceCloudSyncPull();
  })
  .catch(async () => {
    if(supabaseClient){
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if(error) throw error;
        currentUser = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || email.split('@')[0] };
        currentAuthToken = data.session.access_token;
        localStorage.setItem('ODAK_AUTH_TOKEN', currentAuthToken);
        updateCloudAuthUI();
        showAppToast(`Giriş yapıldı! Supabase bulut verilerin çekiliyor... 🔄`, '⚡');
        forceCloudSyncPull();
        return;
      } catch(sbErr) {
        alert('Supabase Giriş Hatası: ' + sbErr.message);
        return;
      }
    }
    alert('Sunucu veya internet bağlantı hatası.');
  });
}

function resetAllApplicationData(isLogout = false){
  // 1. Devam eden odak seansı veya mola varsa sonlandır
  if(typeof isFocusing !== 'undefined' && (isFocusing || isBreakMode || isShortBreak)){
    try { exitFocus(); } catch(e){}
  }
  try { stopAmbientSound(); } catch(e){}
  try { closeSideDrawer(); } catch(e){}

  // 2. Sunucu ve bulut oturumunu kapat
  const prevToken = currentAuthToken;
  if(prevToken){
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prevToken}`
        }
      }).catch(()=>{});
    } catch(e){}
  }

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
  if(typeof DEFAULT_FRIENDS !== 'undefined'){
    friendsList = JSON.parse(JSON.stringify(DEFAULT_FRIENDS));
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
}

function handleAuthLogout(){
  resetAllApplicationData(true);
}

window.resetAllApplicationData = resetAllApplicationData;
window.handleAuthLogout = handleAuthLogout;

let syncDebounceTimer = null;

function forceCloudSyncPush(newSession = null){
  if(!currentAuthToken) return;
  
  const payload = {
    tasks,
    focusHistory,
    inbox,
    streakDays,
    dailyNotes,
    autoMode,
    manualDark,
    soundEnabled,
    dailyGoalMinutes,
    friendsList,
    new_session: newSession
  };

  fetch('/api/cloud/push', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentAuthToken}`
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    const lbl = document.getElementById('cloud-last-sync-label');
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    if(lbl) lbl.textContent = `Son senkronizasyon: ${nowTime} (Supabase PostgreSQL)`;
    showAppToast('Verilerin Supabase bulut veritabanına yedeklendi! ⚡', '✅');
  })
  .catch(async () => {
    if(supabaseClient && currentUser){
      try {
        await supabaseClient.from('user_state').upsert({
          user_id: currentUser.id,
          tasks,
          focus_history: focusHistory,
          inbox,
          daily_notes: dailyNotes,
          streak_days: streakDays,
          daily_goal_minutes: dailyGoalMinutes,
          friends_list: friendsList
        });
        const lbl = document.getElementById('cloud-last-sync-label');
        if(lbl) lbl.textContent = `Son senkronizasyon: Az önce (Supabase Doğrudan)`;
      } catch(e) {
        console.warn('Supabase direct push error:', e);
      }
    }
  });
}

function forceCloudSyncPull(){
  if(!currentAuthToken) return;

  fetch('/api/cloud/pull', {
    headers: { 'Authorization': `Bearer ${currentAuthToken}` }
  })
  .then(res => res.json())
  .then(res => {
    if(res.status === 'ok' && res.data){
      const d = res.data;
      if(Array.isArray(d.tasks)) tasks = d.tasks.filter(t => !isMockStatsEntry(t));
      if(Array.isArray(d.focusHistory)) focusHistory = d.focusHistory.filter(h => !isMockStatsEntry(h));
      if(Array.isArray(d.inbox)) inbox = d.inbox;
      if(d.dailyNotes && typeof d.dailyNotes === 'object') dailyNotes = d.dailyNotes;
      if(Array.isArray(d.friendsList)) friendsList = d.friendsList;
      if(typeof d.streakDays === 'number') streakDays = d.streakDays;
      if(typeof d.dailyGoalMinutes === 'number') dailyGoalMinutes = d.dailyGoalMinutes;

      saveStateToStorage();
      renderMain();
      renderForest();
      renderStats();
      updateDailyGoalUI();
      try { renderFriends(); } catch(e){}
      showAppToast('Tüm geçmişin ve ağaçların Supabase bulutundan yüklendi! ⚡🌲', '🎉');
    } else if(res.status === 'empty'){
      forceCloudSyncPush();
    }
  })
  .catch(async () => {
    if(supabaseClient && currentUser){
      try {
        const { data, error } = await supabaseClient
          .from('user_state')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();
        if(data && !error){
          if(Array.isArray(data.tasks)) tasks = data.tasks.filter(t => !isMockStatsEntry(t));
          if(Array.isArray(data.focus_history)) focusHistory = data.focus_history.filter(h => !isMockStatsEntry(h));
          if(Array.isArray(data.inbox)) inbox = data.inbox;
          if(data.daily_notes) dailyNotes = data.daily_notes;
          if(Array.isArray(data.friends_list)) friendsList = data.friends_list;
          if(typeof data.streak_days === 'number') streakDays = data.streak_days;
          if(typeof data.daily_goal_minutes === 'number') dailyGoalMinutes = data.daily_goal_minutes;
          saveStateToStorage();
          renderMain();
          renderForest();
          renderStats();
          updateDailyGoalUI();
          try { renderFriends(); } catch(e){}
          showAppToast('Verilerin Supabase bulutundan yüklendi! ⚡', '🎉');
        }
      } catch(e){}
    }
  });
}

function checkStoredAuthToken(){
  if(!currentAuthToken) {
    updateCloudAuthUI();
    return;
  }
  fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${currentAuthToken}` }
  })
  .then(res => res.json())
  .then(data => {
    if(data.status === 'ok' && data.user){
      currentUser = data.user;
      if(currentUser.name && currentUser.name !== 'Kullanıcı') {
        userProfile.name = currentUser.name;
      } else if(userProfile.name && userProfile.name !== 'Odak Kullanıcısı') {
        currentUser.name = userProfile.name;
      }

      const isCustomLocalAvatar = userProfile.avatar && userProfile.avatar !== '👤' && userProfile.avatar !== '🧑‍💻';
      const isCustomServerAvatar = currentUser.avatar && currentUser.avatar !== '👤' && currentUser.avatar !== '🧑‍💻';

      if(isCustomServerAvatar){
        userProfile.avatar = currentUser.avatar;
      } else if(isCustomLocalAvatar){
        currentUser.avatar = userProfile.avatar;
        syncUserProfileToServer();
      } else if(currentUser.avatar){
        userProfile.avatar = currentUser.avatar;
      }

      saveUserProfileToStorage();
      renderUserProfileUI();
      updateCloudAuthUI();
      try { renderFriends(); } catch(e){}
      forceCloudSyncPull();
    } else {
      currentUser = null;
      currentAuthToken = null;
      localStorage.removeItem('ODAK_AUTH_TOKEN');
      updateCloudAuthUI();
    }
  })
  .catch(async () => {
    if(supabaseClient && currentAuthToken){
      try {
        const { data: { user }, error } = await supabaseClient.auth.getUser(currentAuthToken);
        if(user && !error){
          currentUser = { id: user.id, email: user.email, name: user.user_metadata?.name || user.email.split('@')[0] };
          updateCloudAuthUI();
          forceCloudSyncPull();
          return;
        }
      } catch(e){}
    }
    updateCloudAuthUI();
  });
}

let isSqliteConnected = false;
let lastSqliteSyncTime = 0;

function syncToSqliteDatabase(){
  const payload = {
    tasks,
    focusHistory,
    inbox,
    streakDays,
    dailyNotes,
    autoMode,
    manualDark,
    soundEnabled,
    dailyGoalMinutes,
    friendsList
  };
  
  const headers = { 'Content-Type': 'application/json' };
  if(currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;
  fetch('/api/sync', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    isSqliteConnected = true;
    lastSqliteSyncTime = Date.now();
    updateSqliteBadgeUI(true);
  })
  .catch(err => {
    // Sunucu açık değilse (file:// üzerinden çalışılıyorsa) sessizce localStorage devam eder
    isSqliteConnected = false;
    updateSqliteBadgeUI(false);
  });
}

function updateSqliteBadgeUI(connected){
  // updateCloudAuthUI ile birleştirildi
}

function saveStateToStorage(){
  try {
    const payload = {
      version: '2.0',
      savedAt: Date.now(),
      tasks,
      focusHistory,
      inbox,
      streakDays,
      dailyNotes,
      userRoutines,
      autoMode,
      manualDark,
      soundEnabled,
      planRemindersEnabled,
      friendsList
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch(e){
    // Depolama alanı dolu veya kapalıysa sessizce geç
  }
  
  // SQLite & Supabase arka plan senkronizasyonu (Debounced - 2 saniye bekleme ile toplu istek)
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncToSqliteDatabase();
  }, 2000);
}

function loadStateFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const data = JSON.parse(raw);
      if(Array.isArray(data.tasks)) tasks = data.tasks.filter(t => !isMockStatsEntry(t));
      if(Array.isArray(data.focusHistory)) focusHistory = data.focusHistory.filter(h => !isMockStatsEntry(h));
      if(Array.isArray(data.inbox)) inbox = data.inbox;
      if(Array.isArray(data.friendsList) && data.friendsList.length > 0) friendsList = data.friendsList;
      if(data.dailyNotes && typeof data.dailyNotes === 'object') dailyNotes = data.dailyNotes;
      if(Array.isArray(data.userRoutines) && data.userRoutines.length > 0) userRoutines = data.userRoutines;
      if(typeof data.streakDays === 'number') streakDays = data.streakDays;
      if(typeof data.autoMode === 'boolean') autoMode = data.autoMode;
      if(typeof data.manualDark === 'boolean') manualDark = data.manualDark;
      if(typeof data.soundEnabled === 'boolean') soundEnabled = data.soundEnabled;
      if(typeof data.planRemindersEnabled === 'boolean') planRemindersEnabled = data.planRemindersEnabled;
      
      streakDays = calculateStreakDays();
      saveStateToStorage();
      return true;
    }
  } catch(e){
    console.warn('Storage read error:', e);
  }
  return false;
}

// Her saniye sessizce arka planda yedekle
setInterval(saveStateToStorage, 1000);
