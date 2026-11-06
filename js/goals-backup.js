/* ══════════════════════════════════════════════════════
   2. DERİN ODAK MODU (SERT MOD & SEKME KORUMASI)
   ══════════════════════════════════════════════════════ */
let deepFocusEnabled = false;

function onDeepFocusToggle(){
  deepFocusEnabled = document.getElementById('toggle-deep-focus')?.checked || false;
  const wrap = document.getElementById('foc-deep-toggle-wrap');
  if(wrap) wrap.classList.toggle('active', deepFocusEnabled);
  
  if(deepFocusEnabled){
    showAppToast('Sert Mod Aktif! Sekmeden ayrılırsan odak tehlikeye girer ⚠️', '📴');
    // Mümkünse tam ekrana geç
    try {
      if(!document.fullscreenElement && document.documentElement.requestFullscreen){
        document.documentElement.requestFullscreen().catch(()=>{});
      }
    } catch(e){}
  } else {
    showAppToast('Sert mod kapatıldı.', 'ℹ️');
  }
}

// Sekme değiştirildiğinde veya arka plana atıldığında devreye girer
document.addEventListener('visibilitychange', () => {
  if(document.hidden && isFocusing && deepFocusEnabled){
    // Kullanıcı sekmeden ayrıldı!
    showAppToast('⚠️ Dikkat! Odak masasından ayrıldın, fidanın kurumak üzere!', '🥀');
  }
});

/* ══════════════════════════════════════════════════════
   3. GÜNLÜK HEDEF & İLERLEME HALKASI
   ══════════════════════════════════════════════════════ */
let dailyGoalMinutes = 120; // Varsayılan 2 saat (120 dk)

function updateDailyGoalUI(){
  const todayKey = toDateKey(new Date());
  const todayMinutes = getUnifiedStatsList()
    .filter(h => h.rawDate === todayKey && !h.failed)
    .reduce((sum, h) => sum + (h.dur || 0), 0);

  const target = dailyGoalMinutes || 120;
  const pct = Math.min(100, Math.round((todayMinutes / target) * 100));
  
  // 1. Sayısal Göstergeler
  const curMinEl = document.getElementById('goal-current-min');
  const totMinEl = document.getElementById('goal-total-min');
  const ringTextEl = document.getElementById('goal-ring-text');
  const targetBtnEl = document.getElementById('goal-target-btn-text');
  const remainBadgeEl = document.getElementById('goal-remain-badge');
  const statusPillEl = document.getElementById('goal-status-pill');
  const treeIconEl = document.getElementById('goal-tree-icon');
  const quoteTipEl = document.getElementById('goal-quote-tip');
  const progressBarEl = document.getElementById('goal-progress-bar');
  const circleEl = document.getElementById('goal-ring-circle');

  if(curMinEl) curMinEl.textContent = todayMinutes;
  if(totMinEl) totMinEl.textContent = `/ ${target} dk`;
  if(ringTextEl) ringTextEl.textContent = `${pct}%`;
  if(targetBtnEl) targetBtnEl.textContent = `🎯 ${target} dk`;

  // 2. Kalan Süre Rozeti
  const diff = target - todayMinutes;
  if(remainBadgeEl){
    if(diff > 0){
      const approxSessions = Math.ceil(diff / 25);
      remainBadgeEl.textContent = `${diff} dk kaldı (~${approxSessions} seans)`;
      remainBadgeEl.style.color = 'var(--accent)';
    } else if(diff === 0){
      remainBadgeEl.textContent = 'Hedefe Ulaşıldı! 🎯';
      remainBadgeEl.style.color = '#10B981';
    } else {
      remainBadgeEl.textContent = `+${Math.abs(diff)} dk aşıldı! 🔥`;
      remainBadgeEl.style.color = '#10B981';
    }
  }

  // 3. Durum Etiketi & Fidan Aşaması & İpucu
  if(statusPillEl){
    statusPillEl.classList.remove('in-progress', 'completed');
    if(pct >= 100){
      statusPillEl.textContent = '🎉 Hedefe Ulaşıldı';
      statusPillEl.classList.add('completed');
    } else if(pct >= 25){
      statusPillEl.textContent = '⚡ Ritim Yakalandı';
      statusPillEl.classList.add('in-progress');
    } else {
      statusPillEl.textContent = '🌱 Başlangıç';
    }
  }

  if(treeIconEl){
    if(pct >= 100){
      treeIconEl.textContent = '🏆';
    } else if(pct >= 75){
      treeIconEl.textContent = '🌳';
    } else if(pct >= 25){
      treeIconEl.textContent = '🌿';
    } else {
      treeIconEl.textContent = '🌱';
    }
  }

  if(quoteTipEl){
    if(pct >= 100){
      quoteTipEl.textContent = `Tebrikler! Günlük ${target} dakikalık hedefine ulaştın, ormanın serpildi! 🌟`;
    } else if(pct >= 75){
      quoteTipEl.textContent = `Hedefe çok yaklaştın, son bir hamleyle günü taçlandır! 🌳`;
    } else if(pct >= 50){
      quoteTipEl.textContent = `Yarı yolu tamamladın! Harika bir odak ritmi yakaladın. 🌿`;
    } else if(pct > 0){
      quoteTipEl.textContent = `Günün ilk tohumları filizlendi, odağını koruyarak devam et. 🌱`;
    } else {
      quoteTipEl.textContent = `Bugünün ilk fidanını dikmek için bir odak seansı başlat. 🍃`;
    }
  }

  // 4. İlerleme Çubuğu
  if(progressBarEl){
    progressBarEl.style.width = `${pct}%`;
  }

  // 5. SVG Halkası (r=22, çevre = 138.2)
  if(circleEl){
    const circumference = 2 * Math.PI * 22; // ~138.23
    const offset = circumference - (pct / 100) * circumference;
    circleEl.style.strokeDashoffset = offset;
    circleEl.style.stroke = pct >= 100 ? '#10B981' : 'var(--accent)';
  }
}

function openDailyGoalModal(){
  const modal = document.getElementById('daily-goal-modal-backdrop');
  if(!modal) return;
  const input = document.getElementById('custom-goal-input');
  const cur = dailyGoalMinutes || 120;
  if(input) {
    input.value = cur;
    updateGoalInputHint(cur);
  }
  highlightGoalPreset(cur);
  modal.classList.add('active');
}

function closeDailyGoalModal(){
  const modal = document.getElementById('daily-goal-modal-backdrop');
  if(modal) modal.classList.remove('active');
}

function selectGoalPreset(mins){
  const input = document.getElementById('custom-goal-input');
  if(input){
    input.value = mins;
    updateGoalInputHint(mins);
  }
  highlightGoalPreset(mins);
}

function highlightGoalPreset(mins){
  document.querySelectorAll('.goal-preset-btn').forEach(btn => {
    const minEl = btn.querySelector('.gp-min');
    const isMatch = minEl && minEl.textContent.trim() === `${mins} dk`;
    btn.classList.toggle('active', isMatch);
  });
}

function updateGoalInputHint(mins){
  const hintEl = document.getElementById('custom-goal-hours-hint');
  if(!hintEl) return;
  const m = parseInt(mins, 10);
  if(isNaN(m) || m <= 0){
    hintEl.textContent = '';
    return;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if(h > 0 && remM > 0){
    hintEl.textContent = `~${h} saat ${remM} dk`;
  } else if(h > 0){
    hintEl.textContent = `~${h} saat`;
  } else {
    hintEl.textContent = `${remM} dakika`;
  }
}

function saveDailyGoalModal(){
  const input = document.getElementById('custom-goal-input');
  const val = input ? parseInt(input.value, 10) : 120;
  if(!isNaN(val) && val >= 15 && val <= 1440){
    dailyGoalMinutes = val;
    localStorage.setItem('ODAK_DAILY_GOAL', dailyGoalMinutes);
    saveStateToStorage();
    updateDailyGoalUI();
    closeDailyGoalModal();
    showToast(`🎯 Günlük odak hedefi ${dailyGoalMinutes} dakika olarak ayarlandı!`);
  } else {
    showToast('⚠️ Lütfen geçerli bir süre girin (15 - 1440 dk)');
  }
}

// Geriye dönük uyumluluk
function promptChangeDailyGoal(){
  openDailyGoalModal();
}

window.updateDailyGoalUI = updateDailyGoalUI;
window.openDailyGoalModal = openDailyGoalModal;
window.closeDailyGoalModal = closeDailyGoalModal;
window.selectGoalPreset = selectGoalPreset;
window.updateGoalInputHint = updateGoalInputHint;
window.saveDailyGoalModal = saveDailyGoalModal;
window.promptChangeDailyGoal = promptChangeDailyGoal;

/* ══════════════════════════════════════════════════════
   4. HIZLI SÜRE BUTONLARI (+15, +25, +50 vb.)
   ══════════════════════════════════════════════════════ */
function setQuickDur(mins){
  const inp = document.getElementById('add-dur');
  if(inp) inp.value = mins;
  document.querySelectorAll('.quick-dur-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(mins + ' dk'));
  });
}

function quickExtendTask(taskId, addMins){
  const t = tasks.find(x => x.id === taskId);
  if(!t) return;
  if((t.dur || 25) + addMins > 180){
    showAppToast('Bir seans en fazla 180 dk olabilir.', '⚠️');
    return;
  }
  t.dur = (t.dur || 25) + addMins;
  renderMain();
  try { renderStats(); renderForest(); } catch(e){}
  saveStateToStorage();
  showAppToast(`"${t.title}" süresi +${addMins} dk uzatıldı (${t.dur} dk)! ⏳`, '⏳');
}

/* ══════════════════════════════════════════════════════
   5. VERİ YEDEKLEME & İÇE/DIŞA AKTARMA (JSON)
   ══════════════════════════════════════════════════════ */
function exportDataBackup(){
  try {
    const payload = {
      app: 'Odak Ajandası',
      exportedAt: new Date().toISOString(),
      tasks,
      focusHistory,
      inbox,
      streakDays,
      dailyNotes,
      dailyGoalMinutes,
      userRoutines
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odak-ajandasi-yedek-${toDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAppToast('Verilerin başarıyla JSON olarak indirildi! 📥', '💾');
  } catch(e){
    alert('Yedek indirilirken bir hata oluştu: ' + e.message);
  }
}

function triggerImportBackup(){
  const fileInp = document.getElementById('import-backup-input');
  if(fileInp) fileInp.click();
}

function importDataBackup(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){
    try {
      // Dosya doğrulanmadan hiçbir alan kabul edilmez (bkz. OdakCore.sanitizeBackup):
      // gelecekteki tarihler, 180 dk'dan uzun seanslar, günde 1440 dk'yı aşan toplam,
      // bozuk tarih/kimlikler atılır. Seri sayısı dosyadan alınmaz, geçmişten hesaplanır.
      const raw = JSON.parse(evt.target.result);
      const { data, report } = OdakCore.sanitizeBackup(raw, toDateKey(new Date()));
      if(data.tasks) tasks = data.tasks;
      if(data.focusHistory) focusHistory = data.focusHistory;
      if(data.inbox) inbox = data.inbox;
      if(data.dailyNotes) dailyNotes = data.dailyNotes;
      if(data.dailyGoalMinutes) dailyGoalMinutes = data.dailyGoalMinutes;
      if(data.userRoutines) userRoutines = data.userRoutines;
      streakDays = calculateStreakDays();

      saveStateToStorage();
      renderMain();
      renderStats();
      renderForest();
      updateDailyGoalUI();
      const dropped = report.tasksDropped + report.historyDropped;
      if(dropped > 0){
        showAppToast(`Yedek yüklendi. ${dropped} geçersiz kayıt atlandı.`, '⚠️');
      } else {
        showAppToast('Yedek başarıyla geri yüklendi! Verilerin güncellendi 🎉', '✅');
      }
    } catch(err){
      alert('Yedek dosyası geçersiz veya bozuk: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };
  if(file.size > 5 * 1024 * 1024){
    alert('Yedek dosyası çok büyük (en fazla 5 MB).');
    e.target.value = '';
    return;
  }
  reader.readAsText(file);
}
