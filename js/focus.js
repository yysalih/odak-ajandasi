/* ══════════════════════════════════════════════════════
   TAM EKRAN ODAKLANMA & MOLA DÖNGÜSÜ (ARKA PLAN DESTEKLİ)
   ══════════════════════════════════════════════════════ */
const TREE_GROWTH_STAGES=['🌱','🌿','🌲','🌳'];

let sessionBreaksLeft = 1;
let isShortBreak = false;
let breakTimerInt = null;
let shortBreakTimeLeft = 180; // 3 dakika
let focusTargetEndTime = null;
let shortBreakTargetEndTime = null;
let coverCanvasEl = null;
let lastCoverDataUrl = null;

function getAbsoluteAssetUrl(relPath) {
  try {
    return new URL(relPath, window.location.href).href;
  } catch(e) {
    return relPath;
  }
}

function generateFocusCoverImage(curTimeLeft, curTotalTime, taskTitle, treeIco, treeNm, isBreak) {
  try {
    if (!coverCanvasEl) {
      coverCanvasEl = document.createElement('canvas');
      coverCanvasEl.width = 512;
      coverCanvasEl.height = 512;
    }
    const ctx = coverCanvasEl.getContext('2d');
    if (!ctx) return null;

    const w = 512, h = 512;
    const cx = w / 2, cy = h / 2 - 8;
    const r = 160;

    // 1. Zemin - Koyu Lüks Degrade
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    if (isBreak) {
      bgGrad.addColorStop(0, '#1A1208');
      bgGrad.addColorStop(0.5, '#120C04');
      bgGrad.addColorStop(1, '#080502');
    } else {
      bgGrad.addColorStop(0, '#0D1A14');
      bgGrad.addColorStop(0.5, '#09120E');
      bgGrad.addColorStop(1, '#050A07');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Parıltı / Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 220);
    if (isBreak) {
      glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
      glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    } else {
      glowGrad.addColorStop(0, 'rgba(82, 199, 133, 0.3)');
      glowGrad.addColorStop(1, 'rgba(82, 199, 133, 0)');
    }
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Üst Başlık
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if ('letterSpacing' in ctx) { try { ctx.letterSpacing = '1px'; } catch(e){} }
    ctx.fillText('🌿 ODAK AJANDASI', cx, 48);

    // 4. Halka Zemin (Track)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isBreak ? 'rgba(245, 158, 11, 0.15)' : 'rgba(82, 199, 133, 0.15)';
    ctx.lineWidth = 12;
    ctx.stroke();

    // 5. Dekoratif Parlak Halka
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
    const arcGrad = ctx.createLinearGradient(0, 0, w, h);
    if (isBreak) {
      arcGrad.addColorStop(0, '#F59E0B');
      arcGrad.addColorStop(1, '#FBBF24');
      ctx.strokeStyle = arcGrad;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
    } else {
      arcGrad.addColorStop(0, '#10B981');
      arcGrad.addColorStop(1, '#52C785');
      ctx.strokeStyle = arcGrad;
      ctx.shadowColor = 'rgba(82, 199, 133, 0.65)';
    }
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();

    // 6. Merkez Ağaç Emojisi
    ctx.font = '82px -apple-system, BlinkMacSystemFont, "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(treeIco || '🌱', cx, cy - 38);

    // 7. Hedef Süre / Rozet
    const totalMin = Math.max(1, Math.round(curTotalTime / 60));
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(isBreak ? '3 DAKİKA' : `${totalMin} DAKİKA`, cx, cy + 38);

    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = isBreak ? '#FDE68A' : '#A7F3D0';
    ctx.fillText(isBreak ? '☕ DİNLENME MOLASI' : '🎯 HEDEF ODAKLANMA', cx, cy + 70);

    // 8. Görev Adı Kapsülü
    const tTitle = taskTitle || 'Odak Seansı';
    const displayTitle = tTitle.length > 22 ? tTitle.substring(0, 20) + '…' : tTitle;
    
    ctx.font = '600 17px "Plus Jakarta Sans", -apple-system, sans-serif';
    const textWidth = ctx.measureText(displayTitle).width;
    const pillW = Math.min(320, Math.max(140, textWidth + 36));
    const pillH = 34;
    const pillX = cx - pillW / 2;
    const pillY = cy + 104;
    
    ctx.save();
    ctx.fillStyle = isBreak ? 'rgba(245, 158, 11, 0.16)' : 'rgba(82, 199, 133, 0.16)';
    ctx.strokeStyle = isBreak ? 'rgba(245, 158, 11, 0.45)' : 'rgba(82, 199, 133, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, 17);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = isBreak ? '#FDE68A' : '#A7F3D0';
    ctx.font = '600 17px -apple-system, sans-serif';
    ctx.fillText(displayTitle, cx, pillY + pillH / 2);

    // 9. Alt Bilgi
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 15px -apple-system, sans-serif';
    ctx.fillText(isBreak ? '☕ Derin nefes al • Dinlen' : `🌲 ${treeNm || 'Ağacın'} büyüyor • Canlı Takip`, cx, 472);

    return coverCanvasEl.toDataURL('image/png');
  } catch(e) {
    console.warn('Canvas cover hatası:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════
// KİLİT EKRANI & ARKA PLAN MOTORU (OTOMATİK DEVREYE GİRME & SIFIR ÇAKIŞMA)
// ══════════════════════════════════════════════════════
let lastLockScreenMinute = -1;

function ensureLockScreenAudio() {
  // Eğer zaten bir ambiyans sesi (yağmur, kafe vb.) çalıyorsa ekstra dummy audio açma
  if (currentAmbientType !== 'off' && ambientAudioEl && !ambientAudioEl.paused) {
    stopLockScreenAudio();
    return;
  }

  let bgAudio = document.getElementById('bg-focus-audio');
  if (!bgAudio) {
    bgAudio = new Audio();
    bgAudio.id = 'bg-focus-audio';
    bgAudio.loop = true;
    bgAudio.playsInline = true;
    bgAudio.src = 'sounds/silence.m4a';
    document.body.appendChild(bgAudio);
  }

  if (!bgAudio._pauseAttached) {
    // WhatsApp ses kaydı, telefon araması veya harici ses başlatıldığında sistem audio'yu duraklatabilir
    bgAudio.addEventListener('pause', () => {
      console.log('bgAudio sistem/WhatsApp tarafından duraklatıldı. Sayaç arka planda tam zaman damgasıyla güvenle sürmeye devam ediyor.');
    });
    bgAudio._pauseAttached = true;
  }

  bgAudio.volume = 0.05; // Fısıltı seviyesi sessizlik frekansı (iOS/Android kilit ekranı oynatıcısını 100% uyanık tutar)
  try {
    if (bgAudio.paused || bgAudio.ended) {
      bgAudio.currentTime = 0;
    }
    const p = bgAudio.play();
    if (p !== undefined) {
      p.then(() => {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch(err => {
        console.warn('bgAudio çalma uyarısı:', err);
      });
    }
  } catch(e) {}
}

function stopLockScreenAudio() {
  const bgAudio = document.getElementById('bg-focus-audio');
  if (bgAudio) {
    try {
      bgAudio.pause();
      bgAudio.currentTime = 0;
    } catch(e) {}
  }
}

function initLockScreenMediaSession(forceNewCover = false) {
  if (!('mediaSession' in navigator) || !isFocusing) return;

  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  const taskTitle = activeTask?.title || 'Odak Seansı';
  const treeIco = isShortBreak ? '☕' : (activeTask?.treeType || '🌳');
  const treeNm = isShortBreak ? 'Kısa Mola' : (activeTask?.treeName || 'Fidan');

  let stateTitle = '';
  let artistText = '';
  let albumText = '';

  if (isShortBreak) {
    const bm = String(Math.floor(shortBreakTimeLeft / 60)).padStart(2, '0');
    const bs = String(shortBreakTimeLeft % 60).padStart(2, '0');
    stateTitle = `☕ ${bm}:${bs} • ${taskTitle}`;
    artistText = 'Odak Ajandası • Dinlenme Molası';
    albumText = `Mola: ${bm}:${bs}`;
  } else {
    stateTitle = `🌿 ${m}:${s} • ${taskTitle}`;
    artistText = `${treeIco} ${treeNm} Büyüyor • Odak Ajandası`;
    albumText = `Kalan: ${m}:${s} • Hedef: ${Math.round(totalTime / 60)} dk`;
    document.title = `(${m}:${s}) 🌿 Odak Ajandası`;
  }

  const curTime = isShortBreak ? shortBreakTimeLeft : timeLeft;
  const curTotal = isShortBreak ? 180 : totalTime;
  if (forceNewCover || !lastCoverDataUrl) {
    const newCover = generateFocusCoverImage(curTime, curTotal, taskTitle, treeIco, treeNm, isShortBreak);
    if (newCover) {
      lastCoverDataUrl = newCover;
    }
  }

  const artworks = [];
  if (lastCoverDataUrl) {
    artworks.push({ src: lastCoverDataUrl, sizes: '512x512', type: 'image/png' });
  }
  artworks.push({ src: getAbsoluteAssetUrl('icons/icon-512.png'), sizes: '512x512', type: 'image/png' });
  artworks.push({ src: getAbsoluteAssetUrl('icons/icon-192.png'), sizes: '192x192', type: 'image/png' });
  artworks.push({ src: getAbsoluteAssetUrl('icons/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' });

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: stateTitle,
      artist: artistText,
      album: albumText,
      artwork: artworks
    });

    // Pürüzsüz akış: Sadece başlatıldığında/açıldığında bir kere pozisyonu bildir
    // Sürekli döngüde çağırmak işletim sisteminin 60 FPS kendi sayacı ile çakışıp "bir ileri bir geri" titremeye yol açıyordu
    syncLockScreenPosition();

    if ('playbackState' in navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing';
    }
  } catch(e) {}
}

function syncLockScreenPosition() {
  if (!('mediaSession' in navigator) || !isFocusing) return;
  try {
    if ('setPositionState' in navigator.mediaSession) {
      const curDuration = isShortBreak ? 180 : totalTime;
      const rawPos = isShortBreak 
        ? Math.max(0, 180 - shortBreakTimeLeft)
        : Math.max(0, totalTime - timeLeft);
      const curPosition = Math.min(Math.max(0, curDuration - 0.01), rawPos);
      navigator.mediaSession.setPositionState({
        duration: Math.max(1, curDuration),
        playbackRate: 1.0,
        position: curPosition
      });
    }
  } catch(e) {}
}

function updateLockScreenTitleOnly() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');

  if (isShortBreak) {
    const bm = String(Math.floor(shortBreakTimeLeft / 60)).padStart(2, '0');
    const bs = String(shortBreakTimeLeft % 60).padStart(2, '0');
    document.title = `(${bm}:${bs}) ☕ Mola • Odak Ajandası`;
  } else {
    document.title = `(${m}:${s}) 🌿 Odak Ajandası`;
  }

  // App Badge API desteği varsa uygulama simgesi üzerindeki sayıyı güncelle (Chrome Android & iOS PWA)
  if ('setAppBadge' in navigator && isFocusing) {
    try {
      const mins = Math.max(1, Math.ceil(timeLeft / 60));
      navigator.setAppBadge(mins).catch(() => {});
    } catch(e) {}
  }

  if (!('mediaSession' in navigator) || !isFocusing) return;

  // iOS SpringBoard çöküşünü ve IPC yükünü önlemek için sadece tam dakika değiştiğinde metadata güncelle
  const curMin = Math.floor(timeLeft / 60);
  if (curMin === lastLockScreenMinute) return;
  lastLockScreenMinute = curMin;

  const taskTitle = activeTask?.title || 'Odak Seansı';
  let stateTitle = `🌿 ${m}:${s} • ${taskTitle}`;
  let albumText = `Kalan: ${m}:${s} • Hedef: ${Math.round(totalTime / 60)} dk`;

  try {
    if (navigator.mediaSession.metadata) {
      navigator.mediaSession.metadata.title = stateTitle;
      navigator.mediaSession.metadata.album = albumText;
    }
  } catch(e) {}
}

function updateLockScreenMediaSession(forceNewCover = false) {
  if (forceNewCover) {
    initLockScreenMediaSession(true);
  } else {
    updateLockScreenTitleOnly();
  }
}

function clearLockScreenMediaSession() {
  document.title = 'Odak Ajandası';
  lastLockScreenMinute = -1;
  if ('clearAppBadge' in navigator) {
    try { navigator.clearAppBadge().catch(() => {}); } catch(e) {}
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = null;
      if ('playbackState' in navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch(e) {}
  }
}

if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('pause', () => {
      if (isFocusing && !isShortBreak) {
        takeQuickBreak();
      }
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (isFocusing && isShortBreak) {
        resumeFocusFromBreak();
      }
    });
  } catch(e) {}
}

function saveActiveFocusSessionState() {
  if (!isFocusing) {
    localStorage.removeItem('ODAK_ACTIVE_FOCUS');
    return;
  }
  try {
    const data = {
      isFocusing: true,
      targetEndTime: focusTargetEndTime,
      totalTime: totalTime,
      timeLeft: timeLeft,
      startTime: Date.now() - (totalTime - timeLeft) * 1000,
      taskId: activeTask ? activeTask.id : null,
      taskTitle: activeTask ? activeTask.title : null,
      treeType: activeTask ? activeTask.treeType : '🌳',
      treeName: activeTask ? activeTask.treeName : 'Meşe',
      isShortBreak: isShortBreak,
      shortBreakTargetEndTime: shortBreakTargetEndTime,
      sessionBreaksLeft: sessionBreaksLeft
    };
    localStorage.setItem('ODAK_ACTIVE_FOCUS', JSON.stringify(data));
  } catch(e) {}
}

function showLockScreenOngoingNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!isFocusing) return;

  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  const taskTitle = activeTask?.title || 'Odak Seansı';
  const treeIco = isShortBreak ? '☕' : (activeTask?.treeType || '🌳');

  const finishDate = new Date(focusTargetEndTime || (Date.now() + timeLeft * 1000));
  const finishStr = finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const title = isShortBreak 
    ? `☕ Mola Devam Ediyor (${m}:${s})` 
    : `${treeIco} Odaklanma Devam Ediyor (${m}:${s})`;

  const options = {
    body: `🎯 ${taskTitle} • 🏁 Tahmini Bitiş: ${finishStr}\n🌿 Telefonunu kapatsan da sayaç tam zamanında devam eder.`,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'odak-active-session',
    renotify: false,
    silent: true
  };

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch(e) {}
}

function closeLockScreenOngoingNotification() {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.getNotifications({ tag: 'odak-active-session' }).then(notifs => {
          notifs.forEach(n => n.close());
        }).catch(() => {});
      }).catch(() => {});
    }
  } catch(e) {}
}

function sendFocusCompletionNotification(taskTitle, treeType, treeName) {
  closeLockScreenOngoingNotification();
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = `🎉 Tebrikler! ${taskTitle || 'Odak Seansı'} Tamamlandı!`;
  const options = {
    body: `${treeType || '🌳'} ${treeName || 'Yeni Ağacın'} ormanına eklendi. Harika bir iş çıkardın!`,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'odak-completed'
  };
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch(e) {}
}

function handleVisibilityOrFocusSync() {
  if (!isFocusing) {
    if (localStorage.getItem('ODAK_ACTIVE_FOCUS')) {
      restoreSavedFocusSessionIfNeeded();
    }
    return;
  }
  if (isBreakMode) return;
  
  const now = Date.now();
  if (isShortBreak && shortBreakTargetEndTime) {
    shortBreakTimeLeft = Math.max(0, Math.ceil((shortBreakTargetEndTime - now) / 1000));
    updateBreakTimerDisplay();
    updateMiniFocusTimer();
    updateLockScreenTitleOnly();
    if (shortBreakTimeLeft <= 0) {
      clearInterval(breakTimerInt);
      playChimeSound();
      showAppToast('⏰ Mola süresi bitti! Odak devam ediyor.', '🌿');
      resumeFocusFromBreak();
    }
  } else if (focusTargetEndTime) {
    timeLeft = Math.max(0, Math.ceil((focusTargetEndTime - now) / 1000));
    updateFocTimer();
    updateMiniFocusTimer();
    const pct = Math.min(1, Math.max(0, (totalTime - timeLeft) / totalTime));
    setFocArc(pct);
    updateTreeStage(pct);
    updateLockScreenTitleOnly();
    if (timeLeft <= 0) {
      completeFocus();
    }
  }
}

function restoreSavedFocusSessionIfNeeded() {
  try {
    const raw = localStorage.getItem('ODAK_ACTIVE_FOCUS');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (!session || !session.targetEndTime) return;

    const now = Date.now();
    // 24 saatten eski oturumları temizle
    if (session.startTime && (now - session.startTime > 86400000)) {
      localStorage.removeItem('ODAK_ACTIVE_FOCUS');
      return;
    }

    if (session.taskId) {
      activeTask = tasks.find(t => t.id === session.taskId) || null;
    }
    if (!activeTask) {
      activeTask = {
        id: session.taskId || 'restored-task',
        title: session.taskTitle || 'Odaklanma Seansı',
        dur: Math.round((session.totalTime || 1500) / 60),
        treeType: session.treeType || '🌳',
        treeName: session.treeName || 'Meşe'
      };
    }

    totalTime = session.totalTime || 1500;

    if (now >= session.targetEndTime) {
      // Uygulama kapalıyken süre dolmuş! Ağacı ver ve tamamla!
      localStorage.removeItem('ODAK_ACTIVE_FOCUS');
      timeLeft = 0;
      isFocusing = true;
      document.getElementById('focus-overlay').classList.add('active');
      completeFocus();
      setTimeout(() => {
        showAppToast('🎉 Odaklanma süren başarıyla tamamlandı, yeni ağacın ormanına eklendi!', '🌲');
      }, 1000);
    } else {
      // Süre henüz bitmemiş, kaldığı yerden geri yükle!
      timeLeft = Math.max(1, Math.round((session.targetEndTime - now) / 1000));
      focusTargetEndTime = session.targetEndTime;
      sessionBreaksLeft = typeof session.sessionBreaksLeft === 'number' ? session.sessionBreaksLeft : 1;
      
      document.getElementById('foc-title').textContent = activeTask.title;
      document.getElementById('focus-overlay').classList.add('active');
      document.getElementById('bottom-nav').style.display = 'none';
      
      startFocus(true);
      setTimeout(() => {
        showAppToast(`🌿 Odaklanma seansın devam ediyor (${Math.ceil(timeLeft/60)} dk kaldı)!`, '⏳');
      }, 1000);
    }
  } catch(e) {
    console.warn('Aktif odak seansı geri yükleme hatası:', e);
  }
}

function updateTopBackButton(){
  const backBtn = document.getElementById('foc-btn-back');
  if(!backBtn) return;
  if(isFocusing || isBreakMode || isShortBreak){
    backBtn.innerHTML = `<span style="font-size:11px;line-height:1;display:inline-flex;align-items:center;">▼</span> Küçült (Arka Planda Sürsün)`;
    backBtn.onclick = minimizeFocus;
  } else {
    backBtn.innerHTML = `<span style="font-size:13px;line-height:1;display:inline-flex;align-items:center;">←</span> Plana Dön`;
    backBtn.onclick = closeFocusOverlay;
  }
}

function initSessionBreaks(){
  // 50 dk ve üzeri uzun görevlerde 2 mola hakkı, diğerlerinde 1 mola hakkı
  sessionBreaksLeft = (activeTask && activeTask.dur >= 50) ? 2 : 1;
  isShortBreak = false;
  clearInterval(breakTimerInt);
  stopAmbientSound();
  updateBreakButtonUI();
}

function updateBreakButtonUI(){
  const btn = document.getElementById('foc-btn-pause-break');
  const badge = document.getElementById('foc-break-badge');
  if(!btn || !badge) return;
  badge.textContent = `${sessionBreaksLeft} Hak`;
  if(sessionBreaksLeft > 0){
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  } else {
    btn.style.opacity = '0.45';
    btn.style.pointerEvents = 'none';
  }
}

function openFocus(id){
  const ovEl = document.getElementById('focus-overlay');
  if(ovEl) ovEl.scrollTop = 0;
  const wrapEl = document.getElementById('foc-tree-wrap');
  if(wrapEl) wrapEl.scrollTop = 0;
  if((isFocusing || isBreakMode || isShortBreak) && activeTask && activeTask.id === id){
    maximizeFocus();
    return;
  }
  if((isFocusing || isBreakMode || isShortBreak) && activeTask && activeTask.id !== id){
    const remainingM = Math.floor(timeLeft/60);
    const remainingS = String(timeLeft%60).padStart(2,'0');
    if(!confirm(`Şu an "${activeTask.title}" üzerinde odaklanıyorsun (${remainingM}:${remainingS} kaldı).\nMevcut seansı sonlandırıp yeni göreve geçmek istiyor musun?`)){
      return;
    }
    clearInterval(timerInt);
    clearInterval(breakTimerInt);
    stopAmbientSound();
    stopLockScreenAudio();
    clearLockScreenMediaSession();
    localStorage.removeItem('ODAK_ACTIVE_FOCUS');
    isFocusing = false;
    isBreakMode = false;
    isShortBreak = false;
    hideMiniFocusBar();
  }

  activeTask = tasks.find(t=>t.id===id);
  if(!activeTask) return;
  unlockAudioContext();
  isBreakMode = false;
  isShortBreak = false;
  clearInterval(breakTimerInt);
  stopAmbientSound();
  document.getElementById('foc-title').textContent = activeTask.title;
  totalTime = activeTask.dur * 60;
  resetFocusUI();
  pickRandomQuote();
  updateTopBackButton();
  document.getElementById('focus-overlay').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
  hideMiniFocusBar();
}

function startFocus(resumeExisting = false){
  unlockAudioContext();
  isFocusing = true;
  if(!resumeExisting){
    timeLeft = totalTime;
    focusTargetEndTime = Date.now() + totalTime * 1000;
  } else {
    if(!focusTargetEndTime || focusTargetEndTime <= Date.now()){
      focusTargetEndTime = Date.now() + timeLeft * 1000;
    }
  }
  
  // Bildirim izni sor (Kullanıcı etkileşimi anında)
  if ("Notification" in window && Notification.permission === "default") {
    try { Notification.requestPermission().catch(()=>{}); } catch(e){}
  }

  // Service Worker'a zamanlayıcı bitişini bildir (uygulama kapansa bile bildirim gelsin)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_FOCUS_COMPLETION',
        targetEndTime: focusTargetEndTime,
        taskTitle: activeTask?.title,
        treeType: activeTask?.treeType,
        treeName: activeTask?.treeName
      });
    } catch(e){}
  }

  saveActiveFocusSessionState();
  
  // Uygulamadan çıkıldığında medya kartı otomatik açılacaktır; uygulama içindeyken ses çalınmaz
  if (document.hidden) {
    ensureLockScreenAudio();
    initLockScreenMediaSession(true);
    showLockScreenOngoingNotification();
  } else {
    stopLockScreenAudio();
  }

  document.getElementById('foc-btn-start').style.display = 'none';
  
  // Kısa Mola butonunu hazırla ve göster
  const breakBtn = document.getElementById('foc-btn-pause-break');
  if(breakBtn){
    breakBtn.style.display = 'flex';
    updateBreakButtonUI();
  }
  const resumeBtn = document.getElementById('foc-btn-resume');
  if(resumeBtn) resumeBtn.style.display = 'none';

  const giveUpBtn = document.getElementById('foc-btn-giveup');
  giveUpBtn.textContent = '🥀 Pes Et';
  giveUpBtn.onclick = giveUpFocus;
  giveUpBtn.style.display = 'block';
  document.getElementById('foc-btn-water').style.display = 'none';
  document.getElementById('foc-msg').textContent = 'Ağacın büyüyor — odaklan ve üret!';
  document.getElementById('foc-ring').className = 'foc-ring growing';
  
  const initPct = (totalTime - timeLeft) / totalTime;
  setFocArc(initPct);
  updateTreeStage(initPct);
  updateFocTimer();
  updateMiniFocusTimer();
  updateTopBackButton();
  
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    const now = Date.now();
    let computedSec = timeLeft;
    if (focusTargetEndTime) {
      computedSec = Math.max(0, Math.ceil((focusTargetEndTime - now) / 1000));
    } else {
      computedSec = Math.max(0, timeLeft - 1);
    }
    
    // Strict monotonic countdown: can only decrease, prevents any jumping back and forth
    if (computedSec < timeLeft) {
      timeLeft = computedSec;
      updateFocTimer();
      updateMiniFocusTimer();
      const pct = Math.min(1, Math.max(0, (totalTime - timeLeft) / totalTime));
      setFocArc(pct);
      updateTreeStage(pct);
      updateLockScreenTitleOnly();
      saveActiveFocusSessionState();
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInt);
      completeFocus();
    }
  }, 250);
}

function takeQuickBreak(){
  if(!isFocusing || isBreakMode || isShortBreak) return;
  if(sessionBreaksLeft <= 0){
    showAppToast('Bu seanstaki tüm mola haklarını kullandın! ⏳', '⚠️');
    return;
  }

  sessionBreaksLeft--;
  isShortBreak = true;
  clearInterval(timerInt);

  shortBreakTimeLeft = 180; // 3 dakika
  shortBreakTargetEndTime = Date.now() + 180 * 1000;
  saveActiveFocusSessionState();
  
  if (document.hidden) {
    ensureLockScreenAudio();
    initLockScreenMediaSession(true);
    showLockScreenOngoingNotification();
  }
  
  const ov = document.getElementById('focus-overlay');
  ov.className = 'active state-pause-break';

  document.getElementById('foc-state-lbl').textContent = '☕ KISA MOLA (ODAK DURAKLATILDI)';
  document.getElementById('foc-tree').textContent = '☕';
  document.getElementById('foc-ring').className = 'foc-ring pause-break';
  document.getElementById('foc-arc').className = 'foc-prog-bar pause-break';
  document.getElementById('foc-timer').className = 'foc-timer pause-break';
  document.getElementById('foc-msg').textContent = 'Derin bir nefes al, suyunu iç. 3 dakika sonra odak devam edecek.';

  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'block';

  updateBreakTimerDisplay();
  updateTopBackButton();
  showAppToast('☕ 3 dakikalık kısa mola başladı. Dinlen!', '☕');

  clearInterval(breakTimerInt);
  stopAmbientSound();
  breakTimerInt = setInterval(() => {
    const now = Date.now();
    let computedSec = shortBreakTimeLeft;
    if (shortBreakTargetEndTime) {
      computedSec = Math.max(0, Math.ceil((shortBreakTargetEndTime - now) / 1000));
    } else {
      computedSec = Math.max(0, shortBreakTimeLeft - 1);
    }
    
    if (computedSec < shortBreakTimeLeft) {
      shortBreakTimeLeft = computedSec;
      updateBreakTimerDisplay();
      updateMiniFocusTimer();
      updateLockScreenTitleOnly();
      saveActiveFocusSessionState();
    }
    
    if (shortBreakTimeLeft <= 0) {
      clearInterval(breakTimerInt);
      stopAmbientSound();
      playChimeSound();
      showAppToast('⏰ Mola süresi bitti! Odak devam ediyor.', '🌿');
      resumeFocusFromBreak();
    }
  }, 250);
}

function updateBreakTimerDisplay(){
  const m = String(Math.floor(shortBreakTimeLeft / 60)).padStart(2, '0');
  const s = String(shortBreakTimeLeft % 60).padStart(2, '0');
  const minEl = document.getElementById('foc-time-min');
  const secEl = document.getElementById('foc-time-sec');
  const timerEl = document.getElementById('foc-timer');
  if (minEl && secEl) {
    if (minEl.textContent !== m) minEl.textContent = m;
    if (secEl.textContent !== s) secEl.textContent = s;
  } else if (timerEl) {
    timerEl.innerHTML = `<span class="foc-time-part foc-time-min" id="foc-time-min">${m}</span><span class="foc-time-colon">:</span><span class="foc-time-part foc-time-sec" id="foc-time-sec">${s}</span>`;
  }
  const pct = (180 - shortBreakTimeLeft) / 180;
  setFocArc(pct);
}

function resumeFocusFromBreak(){
  clearInterval(breakTimerInt);
  stopAmbientSound();
  isShortBreak = false;
  shortBreakTargetEndTime = null;

  focusTargetEndTime = Date.now() + timeLeft * 1000;
  saveActiveFocusSessionState();

  const ov = document.getElementById('focus-overlay');
  ov.className = 'active';

  document.getElementById('foc-state-lbl').textContent = 'ODAKLANILAN GÖREV';
  if(activeTask && activeTask.title){
    document.getElementById('foc-title').textContent = activeTask.title;
  }
  document.getElementById('foc-ring').className = 'foc-ring growing';
  document.getElementById('foc-arc').className = 'foc-prog-bar';
  document.getElementById('foc-timer').className = 'foc-timer';
  document.getElementById('foc-msg').textContent = 'Ağacın büyüyor — odaklan ve üret!';

  // Ana ağaç emojisini ve aşamasını geri yükle
  const pct = (totalTime - timeLeft) / totalTime;
  setFocArc(pct);
  updateTreeStage(pct);
  updateFocTimer();

  document.getElementById('foc-btn-resume').style.display = 'none';
  const breakBtn = document.getElementById('foc-btn-pause-break');
  if(breakBtn) breakBtn.style.display = 'flex';
  updateBreakButtonUI();

  updateTopBackButton();
  showAppToast('🌿 Odak seansına devam ediliyor!', '🌱');
  
  // Service Worker'a yeni bitişi bildir
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_FOCUS_COMPLETION',
        targetEndTime: focusTargetEndTime,
        taskTitle: activeTask?.title,
        treeType: activeTask?.treeType,
        treeName: activeTask?.treeName
      });
    } catch(e){}
  }

  if (document.hidden) {
    ensureLockScreenAudio();
    initLockScreenMediaSession(true);
    showLockScreenOngoingNotification();
  } else {
    stopLockScreenAudio();
  }

  // Ana odak zamanlayıcısını kaldığı yerden devam ettir
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    const now = Date.now();
    let computedSec = timeLeft;
    if (focusTargetEndTime) {
      computedSec = Math.max(0, Math.ceil((focusTargetEndTime - now) / 1000));
    } else {
      computedSec = Math.max(0, timeLeft - 1);
    }
    
    if (computedSec < timeLeft) {
      timeLeft = computedSec;
      updateFocTimer();
      updateMiniFocusTimer();
      const curPct = Math.min(1, Math.max(0, (totalTime - timeLeft) / totalTime));
      setFocArc(curPct);
      updateTreeStage(curPct);
      updateLockScreenTitleOnly();
      saveActiveFocusSessionState();
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInt);
      completeFocus();
    }
  }, 250);
}

function minimizeFocus(){
  document.getElementById('focus-overlay').classList.remove('active');
  const bn = document.getElementById('bottom-nav');
  if(bn) bn.style.display = 'none';
  showMiniFocusBar();
  showAppToast(`"${activeTask?.title || 'Odak'}" arka planda devam ediyor ⏳`, '🌿');
}

function maximizeFocus(){
  hideMiniFocusBar();
  document.getElementById('focus-overlay').classList.add('active');
  const bn = document.getElementById('bottom-nav');
  if(bn) bn.style.display = 'none';
  updateTopBackButton();
}

function closeFocusOverlay(){
  document.getElementById('focus-overlay').classList.remove('active');
  const bn = document.getElementById('bottom-nav');
  if(bn) bn.style.display = 'none';
  if(!isFocusing && !isBreakMode && !isShortBreak && currentAmbientType !== 'off'){
    stopAmbientSound();
  }
}

function showMiniFocusBar(){
  const bar = document.getElementById('mini-focus-bar');
  if(!bar) return;
  const curTime = isShortBreak ? shortBreakTimeLeft : timeLeft;
  const m = String(Math.floor(curTime / 60)).padStart(2, '0');
  const s = String(curTime % 60).padStart(2, '0');
  
  document.getElementById('mfb-title').textContent = activeTask?.title || 'Odak Seansı';
  document.getElementById('mfb-timer').textContent = `${m}:${s}`;
  document.getElementById('mfb-tree').textContent = isShortBreak ? '☕' : (isBreakMode ? '💧' : (activeTask?.treeType || '🌱'));
  document.getElementById('mfb-sub').textContent = isShortBreak ? 'Kısa Mola Veriliyor…' : (isBreakMode ? 'Mola Veriliyor…' : 'Odak Arka Planda Sürüyor');
  
  bar.style.display = 'flex';
}

function updateMiniFocusTimer(){
  const timerEl = document.getElementById('mfb-timer');
  if(timerEl && (isFocusing || isBreakMode || isShortBreak)){
    const curTime = isShortBreak ? shortBreakTimeLeft : timeLeft;
    const m = String(Math.floor(curTime / 60)).padStart(2, '0');
    const s = String(curTime % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }
}

function hideMiniFocusBar(){
  const bar = document.getElementById('mini-focus-bar');
  if(bar) bar.style.display = 'none';
}

function openGiveUpModal(){
  const allTrees = getForestTrees();
  const healthyCount = allTrees.filter(h => !h.failed && h.treeType !== '🥀').length;
  const titleEl = document.getElementById('giveup-modal-title');
  const descEl = document.getElementById('giveup-modal-desc');
  const subEl = document.getElementById('giveup-modal-sub');
  
  if(healthyCount > 0){
    if(titleEl) titleEl.textContent = 'Dikkat: Ormanından 1 Ağaç Eksilecek!';
    if(descEl) descEl.innerHTML = `Pes edersen bu seanstaki fidanın kuruyacak ve ormanındaki yetişmiş <strong>1 canlı ağaç kuruyacak (-1 🌲)</strong>.`;
    if(subEl) subEl.textContent = `(Mevcut ormanındaki ${healthyCount} canlı ağaçtan 1 tanesi kuruyacak.)`;
  } else {
    if(titleEl) titleEl.textContent = 'Pes Etmek Üzere misin?';
    if(descEl) descEl.innerHTML = `Pes edersen bu seanstaki fidanın kuruyacak ve harcadığın odak emeği kaybolacak.`;
    if(subEl) subEl.textContent = `(Şu an ormanında yetişmiş canlı ağaç olmadığı için sadece mevcut fidan kurur.)`;
  }
  const modal = document.getElementById('giveup-modal-backdrop');
  if(modal) modal.classList.add('active');
}

function closeGiveUpModal(){
  const modal = document.getElementById('giveup-modal-backdrop');
  if(modal) modal.classList.remove('active');
}

function giveUpFocus(){
  openGiveUpModal();
}

function confirmGiveUp(){
  closeGiveUpModal();

  // Ormanından son sağlıklı ağacı bul ve kurut (-1 Canlı Ağaç)
  let removedTreeInfo = null;
  
  // 1. Önce focusHistory içindeki son sağlıklı ağaca bak
  let lastHealthyHistoryIdx = -1;
  for(let i = focusHistory.length - 1; i >= 0; i--){
    const h = focusHistory[i];
    if(h && !h.failed && h.treeType !== '🥀'){
      lastHealthyHistoryIdx = i;
      break;
    }
  }

  if(lastHealthyHistoryIdx !== -1){
    const target = focusHistory[lastHealthyHistoryIdx];
    removedTreeInfo = { title: target.title, treeType: target.treeType, treeName: target.treeName };
    target.failed = true;
    target.treeType = '🥀';
    target.treeName = 'Kurumuş ' + (target.treeName || 'Ağaç');
  } else {
    // 2. Eğer focusHistory'de yoksa tasks içindeki tamamlanmış ağaca bak
    const completedTask = (tasks || []).slice().reverse().find(t => t && t.done && t.tree && !t.failed);
    if(completedTask){
      removedTreeInfo = { title: completedTask.title, treeType: completedTask.treeType, treeName: completedTask.treeName };
      completedTask.done = false;
      completedTask.tree = false;
      completedTask.failed = true;
    }
  }

  // Fidanın kurumasını çalıştır
  failFocus(removedTreeInfo);
}

function restartFocus(){
  const ov = document.getElementById('focus-overlay');
  ov.className = 'active';
  document.getElementById('foc-timer').className = 'foc-timer';
  resetFocusUI();
  startFocus();
}

function failFocus(removedTreeInfo){
  clearInterval(timerInt);
  clearInterval(breakTimerInt);
  stopAmbientSound();
  stopLockScreenAudio();
  clearLockScreenMediaSession();
  closeLockScreenOngoingNotification();
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try { navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_FOCUS_COMPLETION' }); } catch(e){}
  }
  localStorage.removeItem('ODAK_ACTIVE_FOCUS');
  isFocusing = false;
  isBreakMode = false;
  isShortBreak = false;
  focusTargetEndTime = null;
  shortBreakTargetEndTime = null;
  hideMiniFocusBar();

  const ov = document.getElementById('focus-overlay');
  ov.className = 'active state-dead';
  document.getElementById('foc-ring').className = 'foc-ring dead';
  const tree = document.getElementById('foc-tree');
  tree.textContent = '🥀';
  tree.classList.add('pop');
  document.getElementById('foc-arc').classList.add('dead');
  document.getElementById('foc-timer').className = 'foc-timer dead';
  const statusTxt = document.getElementById('foc-status-text');
  const cardEl = document.getElementById('foc-timer-card');
  if(statusTxt) statusTxt.textContent = 'PES EDİLDİ';
  if(cardEl) cardEl.className = 'foc-timer-card dead';
  
  if(removedTreeInfo){
    document.getElementById('foc-msg').innerHTML = `<span style="color:var(--danger);font-weight:700;">Pes ettin:</span> 1 ağaç (${removedTreeInfo.treeName || 'Ağaç'} ${removedTreeInfo.treeType || '🌲'}) kurudu ve ormanından eksildi!`;
  } else {
    document.getElementById('foc-msg').textContent = 'Odaktan vazgeçtin — fidanın kurudu.';
  }
  
  // Kurumuş fidanı/seansı geçmişe ve ormana kaydet
  const elapsedSec = Math.max(0, totalTime - timeLeft);
  const durMin = Math.max(1, Math.round(elapsedSec / 60));
  const now = new Date();
  focusHistory.push({
    id: Date.now(),
    taskId: activeTask?.id || null,
    title: activeTask?.title || 'Odak Seansı',
    cat: activeTask?.cat || '',
    treeType: '🥀',
    treeName: 'Kurumuş Ağaç',
    dur: durMin,
    time: now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}),
    date: now.toLocaleDateString('tr-TR'),
    rawDate: toDateKey(now),
    failed: true
  });

  if(activeTask){
    activeTask.tree = false;
    activeTask.done = false;
  }

  saveStateToStorage();
  renderMain();
  renderForest();
  try { renderStats(); } catch(e){}

  if(currentAuthToken){
    forceCloudSyncPush({
      title: activeTask?.title || 'Odak Seansı',
      cat: activeTask?.cat || '',
      dur: durMin,
      treeType: '🥀',
      treeName: 'Kurumuş Ağaç',
      time: now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}),
      failed: true
    });
  }

  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'none';
  document.getElementById('foc-btn-water').style.display = 'none';
  
  const sb = document.getElementById('foc-btn-start');
  sb.textContent = '🌱 Yeniden Başla';
  sb.style.display = 'block';
  sb.onclick = restartFocus;

  const giveUpBtn = document.getElementById('foc-btn-giveup');
  giveUpBtn.textContent = '📋 Plana Geri Dön';
  giveUpBtn.style.display = 'block';
  giveUpBtn.onclick = exitFocus;
  
  updateTopBackButton();
  if(removedTreeInfo){
    showAppToast(`🪓 -1 Canlı Ağaç (${removedTreeInfo.treeName || 'Ağaç'}) kurudu!`, '🪓');
  } else {
    showAppToast('🥀 Odak sonlandırıldı. Fidanın kurudu.', '🥀');
  }
  setTimeout(()=>tree.classList.remove('pop'),600);
}

function updateTreeStage(pct){
  const idx = Math.min(3, Math.floor(pct * 4));
  const tree = document.getElementById('foc-tree');
  const targetEmoji = (idx === 3) ? (activeTask?.treeType || '🌳') : TREE_GROWTH_STAGES[idx];
  
  if(tree.textContent !== targetEmoji){
    tree.textContent = targetEmoji;
    tree.classList.remove('pop');
    void tree.offsetWidth;
    tree.classList.add('pop');
    setTimeout(()=>tree.classList.remove('pop'),600);
  }
  for(let i=0; i<4; i++){
    const el = document.getElementById(`stage-${i}`);
    if(!el) continue;
    el.className = 'foc-stage';
    if(i < idx) el.classList.add('done-s');
    if(i === idx) el.classList.add('active-s');
  }
}

function completeFocus(){
  clearInterval(timerInt);
  clearInterval(breakTimerInt);
  stopAmbientSound();
  stopLockScreenAudio();
  clearLockScreenMediaSession();
  closeLockScreenOngoingNotification();
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try { navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_FOCUS_COMPLETION' }); } catch(e){}
  }
  localStorage.removeItem('ODAK_ACTIVE_FOCUS');
  isFocusing = false;
  isBreakMode = false;
  isShortBreak = false;
  focusTargetEndTime = null;
  shortBreakTargetEndTime = null;
  hideMiniFocusBar();

  const statusTxt = document.getElementById('foc-status-text');
  const cardEl = document.getElementById('foc-timer-card');
  if(statusTxt) statusTxt.textContent = 'TAMAMLANDI 🎉';
  if(cardEl) cardEl.className = 'foc-timer-card';

  sendFocusCompletionNotification(activeTask?.title, activeTask?.treeType, activeTask?.treeName);

  playChimeSound();

  const durMin = Math.round(totalTime / 60);
  const now = new Date();
  const treeIco = activeTask?.treeType || '🌳';
  const treeNm = activeTask?.treeName || 'Meşe';

  focusHistory.push({
    id: Date.now(),
    taskId: activeTask?.id || null,
    title: activeTask?.title || 'Odak Seansı',
    cat: activeTask?.cat || '',
    treeType: treeIco,
    treeName: treeNm,
    dur: durMin,
    time: now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}),
    date: now.toLocaleDateString('tr-TR'),
    rawDate: toDateKey(now)
  });

  if(activeTask){
    activeTask.tree = true;
    activeTask.done = true;
  }
  saveStateToStorage();
  renderMain();
  try { publishMyLiveProfile(); } catch(e){}
  try { renderFriendsLeaderboard(); } catch(e){}

  const ov = document.getElementById('focus-overlay');
  ov.className = 'active state-done';
  document.getElementById('foc-ring').className = 'foc-ring done';
  const tree = document.getElementById('foc-tree');
  tree.textContent = treeIco;
  tree.classList.add('pop');
  document.getElementById('foc-timer').className = 'foc-timer done';
  if(statusTxt) statusTxt.textContent = 'TAMAMLANDI';
  if(cardEl) cardEl.className = 'foc-timer-card';
  document.getElementById('foc-msg').textContent = '🎉 Harika! Ağacın yetişti ve ormanına eklendi.';
  
  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'none';
  document.getElementById('foc-btn-giveup').style.display = 'none';
  updateTopBackButton();
  
  for(let i=0; i<4; i++){
    const el = document.getElementById(`stage-${i}`);
    if(el) el.className = 'foc-stage done-s';
  }
  
  const waterBtn = document.getElementById('foc-btn-water');
  waterBtn.style.display = 'block';
  
  const sb = document.getElementById('foc-btn-start');
  sb.textContent = '✓ Tamamla ve Plana Dön';
  sb.style.display = 'block';
  sb.onclick = exitFocus;
  setTimeout(()=>tree.classList.remove('pop'),600);

  // Arka planda tamamlandıysa kullanıcıya toast ile duyur
  if(!ov.classList.contains('active')){
    showAppToast(`🎉 "${activeTask?.title}" tamamlandı! Ağacın ormanına eklendi.`, treeIco);
  }
}

function startWateringBreak(){
  isBreakMode = true;
  isFocusing = false;
  isShortBreak = false;
  clearInterval(timerInt);
  clearInterval(breakTimerInt);
  stopAmbientSound();
  updateTopBackButton();
  
  const ov = document.getElementById('focus-overlay');
  ov.className = 'active state-break';
  
  document.getElementById('foc-state-lbl').textContent = 'Mola & Dinlenme';
  document.getElementById('foc-title').textContent = '💧 Fidanı Sulama Zamanı';
  
  const ring = document.getElementById('foc-ring');
  ring.className = 'foc-ring break-mode';
  
  const arc = document.getElementById('foc-arc');
  arc.className = 'foc-prog-bar break-bar';
  
  const tree = document.getElementById('foc-tree');
  tree.textContent = '🚿';
  tree.classList.add('pop');
  
  const timerEl = document.getElementById('foc-timer');
  timerEl.className = 'foc-timer break-timer';
  
  document.getElementById('foc-stages-bar').style.visibility = 'hidden';
  const nb1 = document.getElementById('foc-note-box');
  if(nb1) nb1.style.display = 'none';
  document.getElementById('foc-msg').textContent = 'Derin bir nefes al… Zihnini dinlendir.';
  
  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'none';
  document.getElementById('foc-btn-water').style.display = 'none';
  document.getElementById('foc-btn-giveup').style.display = 'none';

  const sb = document.getElementById('foc-btn-start');
  sb.textContent = '✓ Molayı Bitir ve Plana Dön';
  sb.onclick = exitFocus;
  
  let breakTime = 300;
  totalTime = breakTime;
  timeLeft = breakTime;
  updateFocTimer();
  setFocArc(0);
  
  timerInt = setInterval(()=>{
    timeLeft--;
    updateFocTimer();
    updateMiniFocusTimer();
    const pct = (totalTime - timeLeft) / totalTime;
    setFocArc(pct);
    if(timeLeft <= 0){
      clearInterval(timerInt);
      isBreakMode = false;
      hideMiniFocusBar();
      playChimeSound();
      document.getElementById('foc-msg').textContent = '✨ Mola tamamlandı! Enerjin tazelendi.';
      tree.textContent = '🌟';
      if(!ov.classList.contains('active')){
        showAppToast('💧 5 dakikalık mola tamamlandı! Enerjin yenilendi.', '✨');
      }
    }
  }, 1000);
}

function exitFocus(){
  clearInterval(timerInt);
  clearInterval(breakTimerInt);
  stopAmbientSound();
  isFocusing = false;
  isBreakMode = false;
  isShortBreak = false;
  hideMiniFocusBar();
  
  document.getElementById('focus-overlay').className = '';
  const bn = document.getElementById('bottom-nav');
  if(bn) bn.style.display = 'none';
  document.getElementById('foc-stages-bar').style.visibility = 'visible';
  const nb2 = document.getElementById('foc-note-box');
  if(nb2) nb2.style.display = 'block';
  
  const sb = document.getElementById('foc-btn-start');
  sb.textContent = '🌱 Tohumu Ek';
  sb.onclick = startFocus;

  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'none';
  document.getElementById('foc-btn-giveup').style.display = 'none';
  document.getElementById('foc-btn-water').style.display = 'none';
  
  navTo('pg-main','nav-main');
}

function resetFocusUI(){
  clearInterval(timerInt);
  clearInterval(breakTimerInt);
  stopAmbientSound();
  stopLockScreenAudio();
  clearLockScreenMediaSession();
  localStorage.removeItem('ODAK_ACTIVE_FOCUS');
  isFocusing = false;
  isBreakMode = false;
  isShortBreak = false;
  focusTargetEndTime = null;
  shortBreakTargetEndTime = null;
  timeLeft = totalTime;
  updateFocTimer();
  setFocArc(0);
  hideMiniFocusBar();
  updateTopBackButton();
  initSessionBreaks();
  
  const statusTxt = document.getElementById('foc-status-text');
  const cardEl = document.getElementById('foc-timer-card');
  if(statusTxt) statusTxt.textContent = 'HAZIR';
  if(cardEl) cardEl.className = 'foc-timer-card';
  
  document.getElementById('foc-state-lbl').textContent = 'ODAKLANILAN GÖREV';
  if(activeTask && activeTask.title){
    document.getElementById('foc-title').textContent = activeTask.title;
  }
  document.getElementById('foc-stages-bar').style.visibility = 'visible';
  const nb3 = document.getElementById('foc-note-box');
  if(nb3) nb3.style.display = 'block';
  document.getElementById('foc-ring').className = 'foc-ring';
  document.getElementById('foc-tree').textContent = '🌱';
  document.getElementById('foc-timer').className = 'foc-timer';
  document.getElementById('foc-arc').className = 'foc-prog-bar';
  document.getElementById('foc-msg').textContent = 'Odağını topla ve tohumu ek.';
  
  document.getElementById('foc-btn-start').style.display = 'block';
  document.getElementById('foc-btn-start').textContent = '🌱 Tohumu Ek';
  document.getElementById('foc-btn-start').onclick = startFocus;
  document.getElementById('foc-btn-pause-break').style.display = 'none';
  document.getElementById('foc-btn-resume').style.display = 'none';
  document.getElementById('foc-btn-giveup').style.display = 'none';
  document.getElementById('foc-btn-water').style.display = 'none';
  
  for(let i=0; i<4; i++){
    const el = document.getElementById(`stage-${i}`);
    if(el) el.className = 'foc-stage';
  }
}

function updateFocTimer(){
  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  const minEl = document.getElementById('foc-time-min');
  const secEl = document.getElementById('foc-time-sec');
  const timerEl = document.getElementById('foc-timer');
  if (minEl && secEl) {
    if (minEl.textContent !== m) minEl.textContent = m;
    if (secEl.textContent !== s) secEl.textContent = s;
  } else if (timerEl) {
    timerEl.innerHTML = `<span class="foc-time-part foc-time-min" id="foc-time-min">${m}</span><span class="foc-time-colon">:</span><span class="foc-time-part foc-time-sec" id="foc-time-sec">${s}</span>`;
  }
  
  const statusTxt = document.getElementById('foc-status-text');
  const cardEl = document.getElementById('foc-timer-card');
  if(statusTxt){
    if(isShortBreak){
      statusTxt.textContent = 'KISA MOLA';
      if(cardEl) cardEl.className = 'foc-timer-card pause-break';
    } else if(isFocusing){
      statusTxt.textContent = 'CANLI ODAK';
      if(cardEl) cardEl.className = 'foc-timer-card';
    } else {
      statusTxt.textContent = 'HAZIR';
      if(cardEl) cardEl.className = 'foc-timer-card';
    }
  }
}
function setFocArc(pct){
  const c = 2 * Math.PI * 120;
  const a = document.getElementById('foc-arc');
  a.style.strokeDasharray = c;
  a.style.strokeDashoffset = c * (1 - pct);
}

/* ══════════════════════════════════════════════════════
   HIZLI NOT (ZİHİN KUTUSU)
   ══════════════════════════════════════════════════════ */
function saveNote(){
  const inp = document.getElementById('foc-note-inp');
  if(!inp) return;
  const v = inp.value.trim();
  if(!v) return;
  inbox.push({text:v, done:false});
  inp.value = '';
  const t = document.getElementById('note-toast');
  if(t){
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 2000);
  }
}

/* ══════════════════════════════════════════════════════
   ZİHİN KUTUSU (PLAN İÇİNE GÖMÜLÜ & HIZLI NOT HAVUZU)
   ══════════════════════════════════════════════════════ */
let isMainInboxCollapsed = false;

function toggleMainInboxCollapse(){
  isMainInboxCollapsed = !isMainInboxCollapsed;
  const body = document.getElementById('plan-inbox-body');
  const icon = document.getElementById('inbox-toggle-icon');
  if(body) body.style.display = isMainInboxCollapsed ? 'none' : 'block';
  if(icon) icon.style.transform = isMainInboxCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
}

function addQuickInboxNote(){
  const inp = document.getElementById('quick-inbox-inp');
  if(!inp) return;
  const text = inp.value.trim();
  if(!text) return;
  inbox.push({ id: Date.now(), text, done: false, date: toDateKey(new Date()) });
  inp.value = '';
  renderMainInbox();
  saveStateToStorage();
  showAppToast('📌 Not Zihin Kutusu\'na kaydedildi.', '📝');
}

function convertInboxToTask(idx){
  const item = inbox[idx];
  if(!item) return;
  const now = new Date();
  const startStr = `${String(now.getHours()).padStart(2,'0')}.${String(now.getMinutes()).padStart(2,'0')}`;
  const endD = new Date(now.getTime() + 25*60000);
  const endStr = `${String(endD.getHours()).padStart(2,'0')}.${String(endD.getMinutes()).padStart(2,'0')}`;

  const newTask = {
    id: Date.now(),
    title: item.text,
    cat: 'Genel',
    treeType: '🌳',
    treeName: 'Meşe',
    dur: 25,
    start: startStr,
    end: endStr,
    tree: true,
    done: false,
    date: toDateKey(activeDate)
  };

  tasks.push(newTask);
  item.done = true;
  renderMain();
  saveStateToStorage();
  showAppToast(`"${item.text}" bugünün planına eklendi! 🎯`, '✅');
}

function checkNote(i){
  if(inbox[i]){
    inbox[i].done = true;
    renderMainInbox();
    saveStateToStorage();
  }
}

function deleteInboxNote(i){
  if(inbox[i]){
    inbox.splice(i, 1);
    renderMainInbox();
    saveStateToStorage();
  }
}

function clearInbox(){
  inbox = inbox.map(n=>({...n, done:true}));
  renderMainInbox();
  saveStateToStorage();
}

function renderMainInbox(){
  const alive = inbox.filter(n=>!n.done);
  const badge = document.getElementById('inbox-badge-count');
  if(badge) badge.textContent = alive.length;

  const list = document.getElementById('main-inbox-list');
  if(!list) return;

  if(!alive.length){
    list.innerHTML = `<div style="text-align:center;padding:12px;font-size:11.5px;color:var(--text3);">Zihin kutun tertemiz. Aklına gelen fikirleri buradan not alabilirsin 🌿</div>`;
    return;
  }

  list.innerHTML = alive.map((n) => {
    const realIdx = inbox.indexOf(n);
    return `
      <div class="ibox-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:var(--bg3);border-radius:10px;margin-bottom:6px;border:1px solid var(--border);">
        <span style="font-size:12.5px;color:var(--text1);font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;">${n.text}</span>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button type="button" class="btn-routine-pill" style="margin:0;padding:3px 8px;font-size:10.5px;background:var(--accent-light);color:var(--accent);border-color:transparent;" onclick="convertInboxToTask(${realIdx})" title="Bugünün Planına Ekle">
            📅 Plana Al
          </button>
          <button type="button" style="background:transparent;border:none;color:var(--text3);font-size:14px;padding:3px 6px;cursor:pointer;" onclick="deleteInboxNote(${realIdx})" title="Sil">✕</button>
        </div>
      </div>
    `;
  }).join('');
}
