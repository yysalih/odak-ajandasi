/* HTML kaçış yardımcıları (bkz. js/core.js).
   esc(v)   : metni innerHTML içine güvenle koymak için.
   jsArg(v) : inline onclick="fn(...)" içine güvenle string argüman koymak için. */
const esc = OdakCore.escapeHtml;
function jsArg(v){ return esc(JSON.stringify(String(v ?? ''))); }

/* ══════════════════════════════════════════════════════
   GÜNEŞ DOĞUM / BATIM HESAPLAMA (TÜRKİYE / İSTANBUL)
   ══════════════════════════════════════════════════════ */
function calcSunTimes(d){
  const lat=41,lon=29,tz=3;
  const s=new Date(d.getFullYear(),0,0);
  const doy=Math.floor((d-s)/864e5);
  const B=(360/365)*(doy-81)*Math.PI/180;
  const decl=23.45*Math.sin(B)*Math.PI/180;
  const latR=lat*Math.PI/180;
  const cosHA=-Math.tan(latR)*Math.tan(decl);
  const HA=Math.acos(Math.min(1,Math.max(-1,cosHA)))*180/Math.PI;
  const noon=12-(lon-15*tz)/15;
  return{sunrise:noon-HA/15, sunset:noon+HA/15};
}
function isNightNow(){
  const n=new Date(),{sunrise,sunset}=calcSunTimes(n),h=n.getHours()+n.getMinutes()/60;
  return h<sunrise||h>=sunset;
}
function fmtH(h){
  return `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h-Math.floor(h))*60)).padStart(2,'0')}`;
}

let autoMode=true,manualDark=true,soundEnabled=true;

function applyTheme(night){
  document.body.classList.toggle('day',!night);
  updateBadge(night);
  const metaTheme = document.getElementById('theme-color-meta');
  if(metaTheme) metaTheme.content = night ? '#0F1115' : '#EFECE6';
}
function updateBadge(night){
  // Rozet kaldırıldığı için fonksiyon no-op olarak korunur
}
function onAutoToggle(){
  autoMode=document.getElementById('toggle-auto').checked;
  const manBox = document.getElementById('manual-theme-box');
  if(manBox) manBox.style.display = autoMode ? 'none' : 'block';
  if(autoMode){
    applyTheme(isNightNow());
  } else {
    applyTheme(manualDark);
    updateManBtns();
  }
}
function setManual(m){
  manualDark=(m==='dark');
  applyTheme(manualDark);
  updateManBtns();
}
function updateManBtns(){
  document.getElementById('tbtn-dark')?.classList.toggle('active-t',manualDark);
  document.getElementById('tbtn-light')?.classList.toggle('active-t',!manualDark);
}
function updateSunInfo(){
  const el=document.getElementById('sun-info');
  if(el){
    const{sunrise,sunset}=calcSunTimes(new Date());
    el.textContent=`İstanbul: Doğum ${fmtH(sunrise)} · Batım ${fmtH(sunset)}`;
  }
}
function onSoundToggle(){
  const chk = document.getElementById('toggle-sound');
  soundEnabled = chk ? chk.checked : true;
  saveStateToStorage();
  if(soundEnabled){
    unlockAudioContext();
    playChimeSound();
    showAppToast('Sesli uyarılar açıldı 🔔', '🔔');
  } else {
    showAppToast('Sesli uyarılar kapatıldı 🔕', '🔕');
  }
}
setInterval(()=>{if(autoMode)applyTheme(isNightNow());},60000);


/* Canlı Saat */
function updateClock(){
  const n=new Date();
  const clk=document.getElementById('status-clock');
  if(clk)clk.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
setInterval(updateClock,1000);
updateClock();

/* ══════════════════════════════════════════════════════
   AKILLI OTOMATİK CİHAZ, ÇENTİK & BOYUTLANDIRMA MOTORU
   (Apple Dinamik Ada, Çentikli, Geniş Çerçeveli SE, Samsung & Android)
   ══════════════════════════════════════════════════════ */
let currentPhoneModel = 'dev-island';
let isAutoDeviceMode = true;

const DEVICE_MODELS = {
  'dev-island': {
    name: 'Apple Dinamik Ada (iPhone 14/15/16 Pro)',
    platform: 'ios',
    hasNotch: true,
    safeTop: 54,
    cutoutType: 'island'
  },
  'dev-notch': {
    name: 'Apple Klasik Çentik (iPhone X - 14)',
    platform: 'ios',
    hasNotch: true,
    safeTop: 46,
    cutoutType: 'notch'
  },
  'dev-bezel': {
    name: 'Apple Geniş Çerçeveli (iPhone SE / 8 / 7)',
    platform: 'ios',
    hasNotch: false,
    safeTop: 24,
    cutoutType: 'bezel'
  },
  'dev-android': {
    name: 'Samsung Galaxy & Modern Android',
    platform: 'android',
    hasNotch: false,
    safeTop: 40,
    cutoutType: 'punchhole'
  }
};

function switchPhoneModel(model){
  applyDeviceModel(model);
}

function applyDeviceModel(model){
  if(!DEVICE_MODELS[model]) model = 'dev-island';
  currentPhoneModel = model;
  
  const shell = document.getElementById('phone-shell');
  if(shell){
    shell.className = 'phone ' + model;
  }
  
  const modelConfig = DEVICE_MODELS[model];
  document.documentElement.style.setProperty('--foc-safe-top', modelConfig.safeTop + 'px');
  
  // Ayarlar sayfasındaki seçim durumunu güncelle
  updateDeviceSelectorUI(model);
}

function autoDetectDevice(){
  const shell = document.getElementById('phone-shell');
  const ua = navigator.userAgent || '';
  
  // 1. İşletim Sistemi ve Donanım Tespiti (Arka Planda %100 Otomatik)
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser|SM-|SAMSUNG/i.test(ua);
  
  // PWA Standalone (İndirilmiş Yerel Uygulama) veya Gerçek Mobil Tarayıcı
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || 
                       (window.navigator && window.navigator.standalone === true) || 
                       Boolean(document.referrer && document.referrer.includes('android-app://'));
  
  // Ekran Ölçüleri ve En-Boy Oranı
  const scr = window.screen || {};
  const screenH = Math.max(scr.height || window.innerHeight || 0, scr.width || window.innerWidth || 0);
  const screenW = Math.min(scr.height || window.innerHeight || 0, scr.width || window.innerWidth || 0);
  const aspect = screenW > 0 ? (screenH / screenW) : 2.16;

  let detectedModel = 'dev-island';
  isAutoDeviceMode = true;

  if (isAndroid || isSamsung) {
    // Samsung veya diğer modern Android telefonlar (Kamera deliği punch-hole)
    detectedModel = 'dev-android';
  } else if (isIOS) {
    // Apple Ekosistemi:
    // a) Geniş Çerçeveli Modeller (iPhone SE 2/3, iPhone 8/7/6s vb.)
    // iPhone SE en-boy oranı 16:9 = 1.77'dir (aspect < 1.95) veya ekran yüksekliği <= 667px
    if (aspect < 1.95 || screenH <= 667) {
      detectedModel = 'dev-bezel';
    } 
    // b) Dinamik Ada (iPhone 14 Pro, 15 ve 16 serisi: ekran yüksekliği >= 852 veya aspect >= 2.15)
    else if (screenH >= 852 || aspect >= 2.15) {
      detectedModel = 'dev-island';
    } 
    // c) Klasik Çentikli Apple (iPhone X, XR, XS, 11, 12, 13, 14)
    else {
      detectedModel = 'dev-notch';
    }
  } else {
    // Masaüstü ekranında varsayılan amiral gemisi deneyimi
    if(window.innerWidth <= 420) {
      detectedModel = aspect > 2.0 ? 'dev-island' : 'dev-bezel';
    } else {
      detectedModel = 'dev-island';
    }
  }

  applyDeviceModel(detectedModel);

  // Standalone PWA ve gerçek mobil sınıflarını ekle
  document.documentElement.classList.toggle('is-standalone-app', isStandalone);
  document.body.classList.toggle('device-ios', isIOS);
  document.body.classList.toggle('device-android', isAndroid);
  document.body.classList.toggle('device-samsung', isSamsung);
}

function setDeviceModelChoice(choice){
  if(choice === 'auto'){
    localStorage.removeItem('user_device_model_pref');
    isAutoDeviceMode = true;
    autoDetectDevice(true);
    showAppToast('Telefon modeli otomatik algılandı ve uyarlandı ⚡', '📱');
  } else {
    localStorage.setItem('user_device_model_pref', choice);
    isAutoDeviceMode = false;
    applyDeviceModel(choice);
    const mInfo = DEVICE_MODELS[choice];
    showAppToast(`Görünüm uyarlandı: ${mInfo ? mInfo.name : choice}`, '📱');
  }
}

function updateDeviceSelectorUI(activeModel){
  const pref = localStorage.getItem('user_device_model_pref');
  const isAuto = !pref;
  
  const pills = {
    'auto': document.getElementById('dpill-auto'),
    'dev-island': document.getElementById('dpill-island'),
    'dev-notch': document.getElementById('dpill-notch'),
    'dev-bezel': document.getElementById('dpill-bezel'),
    'dev-android': document.getElementById('dpill-android')
  };
  
  Object.keys(pills).forEach(k => {
    if(pills[k]){
      pills[k].classList.remove('active');
    }
  });
  
  if(isAuto && pills['auto']){
    pills['auto'].classList.add('active');
  } else if(pills[activeModel]){
    pills[activeModel].classList.add('active');
  }
  
  const descEl = document.getElementById('device-detect-desc');
  if(descEl){
    const curName = DEVICE_MODELS[activeModel]?.name || 'Varsayılan';
    descEl.textContent = isAuto 
      ? `⚡ Otomatik algılandı: ${curName}. Telefon ekranına, çentiğine ve çerçevesine tam uyumlu.`
      : `Seçili model: ${curName}. Ekran boyutlandırması ve çentik sabitlendi.`;
  }
}

window.addEventListener('resize', () => {
  if(isAutoDeviceMode) autoDetectDevice();
});
window.addEventListener('orientationchange', () => {
  if(isAutoDeviceMode) autoDetectDevice();
});

/* ══════════════════════════════════════════════════════
   SESLİ UYARI & TİBET ZİLİ (GELİŞMİŞ WEB AUDIO ENGINE)
   ══════════════════════════════════════════════════════ */
let appAudioContext = null;

function getAppAudioContext(){
  if(!appAudioContext){
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(AudioCtx){
      appAudioContext = new AudioCtx();
    }
  }
  if(appAudioContext && appAudioContext.state === 'suspended'){
    appAudioContext.resume().catch(()=>{});
  }
  return appAudioContext;
}

function unlockAudioContext(){
  try {
    const ctx = getAppAudioContext();
    if(ctx && ctx.state === 'suspended'){
      ctx.resume().catch(()=>{});
    }
  } catch(e){}
}

// Kullanıcının sayfadaki ilk dokunuş veya tıklamasında ses motorunu anında aç
['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach(ev => {
  window.addEventListener(ev, unlockAudioContext, { passive: true });
});

function playChimeSound(){
  if(!soundEnabled) return;
  try {
    const ctx = getAppAudioContext();
    if(!ctx) return;

    const playTone = () => {
      try {
        const now = ctx.currentTime;
        
        // 528 Hz temel ton (Solfeggio zihinsel dinginlik frekansı) + 1056 Hz oktav harmonisi + 792 Hz berraklık
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const gain3 = ctx.createGain();
        const masterGain = ctx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(528, now);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1056, now);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(792, now);
        
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.40, now + 0.04);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
        
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.18, now + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        gain3.gain.setValueAtTime(0, now);
        gain3.gain.linearRampToValueAtTime(0.10, now + 0.02);
        gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

        masterGain.gain.setValueAtTime(1.0, now);
        
        osc1.connect(gain1);
        osc2.connect(gain2);
        osc3.connect(gain3);

        gain1.connect(masterGain);
        gain2.connect(masterGain);
        gain3.connect(masterGain);

        masterGain.connect(ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc3.start(now);

        osc1.stop(now + 3.3);
        osc2.stop(now + 2.1);
        osc3.stop(now + 1.5);
      } catch(innerErr){
        console.warn('playTone error:', innerErr);
      }
    };

    if(ctx.state === 'suspended'){
      ctx.resume().then(playTone).catch(playTone);
    } else {
      playTone();
    }
    
    if(navigator.vibrate) {
      try { navigator.vibrate([220, 80, 220]); } catch(e){}
    }
  } catch(e) {
    console.log('Audio error:', e);
  }
}
