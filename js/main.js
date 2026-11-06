/* ══════════════════════════════════════════════════════
   ARKA PLAN VE KİLİT EKRANI EŞİTLEME (Page Visibility API)
   ══════════════════════════════════════════════════════ */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Uygulamaya geri dönüldü: Saat farkını eşitle, bildirimi kapat ve mikrofonu/sesi serbest bırak
    handleVisibilityOrFocusSync();
    closeLockScreenOngoingNotification();
    stopLockScreenAudio();
    try { publishMyLiveProfile(); } catch(e){}
    try { renderFriendsLeaderboard(); } catch(e){}
  } else {
    // Uygulamadan çıkıldı veya telefon kilitlendi: Kilit ekranı medya kartı direkt otomatik devreye girer!
    if (isFocusing) {
      saveActiveFocusSessionState();
      ensureLockScreenAudio();
      initLockScreenMediaSession(true);
      showLockScreenOngoingNotification();
    } else if (currentAmbientType !== 'off') {
      stopAmbientSound();
    }
  }
});
window.addEventListener('pageshow', () => {
  handleVisibilityOrFocusSync();
  closeLockScreenOngoingNotification();
  stopLockScreenAudio();
});
window.addEventListener('focus', () => {
  handleVisibilityOrFocusSync();
  closeLockScreenOngoingNotification();
  stopLockScreenAudio();
});

/* ══════════════════════════════════════════════════════
   BAŞLANGIÇ (BOOTSTRAP & AUTO-HYDRATE)
   ══════════════════════════════════════════════════════ */
try {
  loadStateFromStorage();
} catch(e) { console.warn('loadStateFromStorage init error:', e); }

try {
  checkStoredAuthToken();
} catch(e) { console.warn('checkStoredAuthToken init error:', e); }

try {
  const savedGoal = localStorage.getItem('ODAK_DAILY_GOAL');
  if(savedGoal) dailyGoalMinutes = parseInt(savedGoal, 10);
  updateDailyGoalUI();
} catch(e){}

try {
  localStorage.removeItem('user_device_model_pref');
  autoDetectDevice();
} catch(e) { console.warn('autoDetectDevice init error:', e); }

try {
  applyTheme(autoMode ? isNightNow() : manualDark);
} catch(e){}

try {
  const autoChk = document.getElementById('toggle-auto');
  if(autoChk) autoChk.checked = autoMode;
  const manBox = document.getElementById('manual-theme-box');
  if(manBox) manBox.style.display = autoMode ? 'none' : 'block';
  updateManBtns();
} catch(e){}

try {
  const sndChk = document.getElementById('toggle-sound');
  if(sndChk) sndChk.checked = soundEnabled;
} catch(e){}

try {
  const remChk = document.getElementById('toggle-plan-reminders');
  if(remChk) remChk.checked = planRemindersEnabled;
  updateNotificationButtonUI();
  checkTaskReminders();
} catch(e){}

// Periyodik plan hatırlatıcı kontrolcüsü (her 10 saniyede bir kontrol)
setInterval(checkTaskReminders, 10000);

try {
  updateDateHeader();
  renderWeekStrip();
  renderMain();
  initCatInput();
  renderTreeSelectGrid();
  pickRandomQuote();
  updateSunInfo();
  renderUserProfileUI();
  renderFriends();
  restoreSavedFocusSessionIfNeeded();
  setTimeout(initRealtimeFriends, 600);
} catch(e) { console.warn('bootstrap render error:', e); }

// Alt Menü Butonları (Bottombar) Kesintisiz Tıklama ve Yönlendirme Başlatıcı
try {
  initBottomNav();
  goTo('pg-main');
} catch(e) { console.warn('initBottomNav error:', e); }

// ══════════════════════════════════════════════════════
// PROGRESSIVE WEB APP (PWA) SERVİS & OTOMATİK CANLI GÜNCELLEME YÖNETİCİSİ
// ══════════════════════════════════════════════════════
let deferredPwaPrompt = null;
let currentAppVersion = null;
let isUpdatingApp = false;

// 1. Service Worker Kaydı & Güncelleme Tetikleme (Android Chrome ve Safari Uyumlu Güvenli Başlatıcı)
const isSecureOrigin = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && isSecureOrigin) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        console.log('✅ Odak Ajandası PWA Service Worker devrede:', reg.scope);
        try { reg.update(); } catch(e){}
      }).catch((err) => {
        console.warn('PWA Service Worker kaydı:', err);
      });
    } catch(e) {
      console.warn('SW register error:', e);
    }
  });
}

// 2. Açılış İntrosu (Splash) Temizleme - Animasyon bittiğinde veya dokunulduğunda derhal kaldır
function dismissIntroSplashNow() {
  const splash = document.getElementById('app-intro-splash');
  if (splash) {
    splash.style.pointerEvents = 'none';
    splash.style.opacity = '0';
    setTimeout(() => {
      try { splash.remove(); } catch(e){}
    }, 200);
  }
}
window.dismissIntroSplashNow = dismissIntroSplashNow;
setTimeout(dismissIntroSplashNow, 850);

// 3. Güncelleme kontrolü
// Eskiden her 25 saniyede bir /api/version isteniyordu. Bu adres GitHub Pages'te
// yok (her seferinde 404). Artık tarayıcının kendi Service Worker güncelleme
// mekanizması kullanılıyor: sayfa her açıldığında ve görünür olduğunda sw.js
// kontrol edilir; sw.js değiştiyse yeni sürüm kurulur.
async function checkAppUpdate(silent = true) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
    if (!silent) showToast('Güncelleme kontrol edildi.');
  } catch (err) {
    if (!silent) showToast('⚠️ Güncelleme kontrol edilemedi');
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkAppUpdate(true);
});
try {
  const badge = document.getElementById('app-version-badge');
  if (badge) badge.textContent = 'Sürüm: odak-pwa-v14';
} catch(e){}

// 3. Kullanıcı Tarafından Manuel Zorla Güncelleme
async function forceAppUpdate() {
  showToast('🔄 Tüm önbellek temizleniyor ve güncelleniyor...');
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let r of regs) {
        try { await r.unregister(); } catch(e){}
      }
    }
  } catch(e) {
    console.warn('Cache unregister error:', e);
  }
  setTimeout(() => {
    window.location.href = window.location.pathname + '?forceUpdate=' + Date.now();
  }, 400);
}
window.forceAppUpdate = forceAppUpdate;
window.checkAppUpdate = checkAppUpdate;

// Android / Desktop Chrome PWA kurulum tetikleyicisi
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const pwaInstallBtn = document.getElementById('btn-pwa-install-app');
  if (pwaInstallBtn) {
    pwaInstallBtn.style.display = 'inline-flex';
  }
});

function triggerPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('🎉 Odak Ajandası başarıyla yüklendi!');
      }
      deferredPwaPrompt = null;
    });
  } else {
    showToast('💡 Tarayıcı menüsünden "Ana Ekrana Ekle" seçeneğini kullanabilirsiniz.');
  }
}

function copyPwaUrl() {
  const urlEl = document.getElementById('pwa-network-url');
  const url = (urlEl && urlEl.innerText.trim()) ? urlEl.innerText.trim() : window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('📋 Bağlantı panoya kopyalandı: ' + url);
    }).catch(() => {
      prompt('Bağlantıyı kopyalayın:', url);
    });
  } else {
    prompt('Bağlantıyı kopyalayın:', url);
  }
}

// Mevcut IP/Origin'e göre PWA URL göstergesini dinamik güncelle
try {
  const curOrigin = window.location.origin;
  const pwaUrlEl = document.getElementById('pwa-network-url');
  if (pwaUrlEl && curOrigin && !curOrigin.startsWith('file:') && !curOrigin.includes('localhost')) {
    pwaUrlEl.innerText = curOrigin;
  }
} catch(e){}
