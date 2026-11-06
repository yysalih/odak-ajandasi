/* ══════════════════════════════════════════════════════
   NAVİGASYON (6 EKRAN & SOL ÇEKMECE YÖNLENDİRME)
   ══════════════════════════════════════════════════════ */
const NAV_BTNS = ['nav-main','nav-forest','nav-friends','nav-stats','nav-user','nav-settings'];
const SCREENS = ['pg-main','pg-forest','pg-friends','pg-stats','pg-user','pg-settings','pg-add'];
const SCREEN_TO_NAV = {
  'pg-main': 'nav-main',
  'pg-forest': 'nav-forest',
  'pg-friends': 'nav-friends',
  'pg-stats': 'nav-stats',
  'pg-user': 'nav-user',
  'pg-settings': 'nav-settings'
};

const SCREEN_TO_DRAWER = {
  'pg-main': 'drawer-nav-main',
  'pg-forest': 'drawer-nav-forest',
  'pg-friends': 'drawer-nav-friends',
  'pg-stats': 'drawer-nav-stats',
  'pg-user': 'drawer-nav-user',
  'pg-settings': 'drawer-nav-settings'
};

/* ── SOL YAN ÇEKMECE (FOREST DRAWER) KONTROLLERİ ── */
function openSideDrawer(){
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if(!drawer || !backdrop) return;
  try {
    const allTrees = getForestTrees();
    const healthyCount = allTrees.filter(h => !h.failed && h.treeType !== '🥀').length;
    const badgeEl = document.getElementById('drawer-forest-trees-count');
    if(badgeEl) badgeEl.textContent = `${healthyCount} Canlı Ağaç`;
  } catch(e){}
  backdrop.classList.add('open');
  drawer.classList.add('open');
}

function closeSideDrawer(){
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if(backdrop) backdrop.classList.remove('open');
  if(drawer) drawer.classList.remove('open');
}

function selectDrawerTab(screenId){
  closeSideDrawer();
  goTo(screenId);
}

function selectDrawerAction(actionType){
  closeSideDrawer();
  if(actionType === 'routines'){
    openRoutinesModal();
  } else if(actionType === 'shareCard'){
    showShareCard();
  }
}

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    closeSideDrawer();
    closeDailyGoalModal();
  }
});

/* ── APPLE HOME INDICATOR (ALT ÇIKIŞ & GEÇİŞ ÇUBUĞU) KONTROLLERİ ── */
function handleHomeIndicatorClick(){
  // 1. Varsa açık yan çekmeceyi veya modalları kapat
  const drawer = document.getElementById('side-drawer');
  if(drawer && drawer.classList.contains('open')){
    closeSideDrawer();
    return;
  }
  const focOv = document.getElementById('focus-overlay');
  if(focOv && focOv.classList.contains('active')){
    if(isFocusing || isBreakMode || isShortBreak){
      minimizeFocus();
    } else {
      closeFocusOverlay();
    }
    return;
  }
  const goalModal = document.getElementById('daily-goal-modal-backdrop');
  if(goalModal && goalModal.classList.contains('active')){
    closeDailyGoalModal();
    return;
  }
  const shareModal = document.getElementById('share-modal-backdrop');
  if(shareModal && shareModal.classList.contains('active')){
    closeShareModal();
    return;
  }
  const routinesModal = document.getElementById('routines-modal-backdrop');
  if(routinesModal && routinesModal.classList.contains('active')){
    closeRoutinesModal();
    return;
  }
  const planCal = document.getElementById('plan-cal-modal-backdrop');
  if(planCal && planCal.classList.contains('active')){
    closePlanCalendarModal();
    return;
  }
  const addFriend = document.getElementById('add-friend-modal');
  if(addFriend && addFriend.classList.contains('active')){
    closeAddFriendModal();
    return;
  }

  // 2. Ana plana / ekrana dön (Apple Home çubuğu davranışı)
  const mainScreen = document.getElementById('pg-main');
  if(mainScreen && !mainScreen.classList.contains('active')){
    goTo('pg-main');
  }
}
window.handleHomeIndicatorClick = handleHomeIndicatorClick;

// Apple Home Çubuğu Yukarı Kaydırma (Swipe-Up) Hareketi
(function initAppleHomeIndicator(){
  function setup(){
    const bar = document.getElementById('apple-home-indicator') || document.querySelector('.home-indicator');
    if(!bar) return;
    let touchStartY = 0;
    bar.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    bar.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      if(touchStartY - touchEndY > 14){ // Yukarı kaydırma (Apple swipe-up)
        handleHomeIndicatorClick();
      }
    }, { passive: true });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

function goTo(id){
  if(!id) return;

  // Kullanıcı aktif odaklanmıyorsa ve sadece sesleri test ettiyse arka plan seslerini kapat
  if(!isFocusing && !isBreakMode && !isShortBreak){
    if(currentAmbientType !== 'off'){
      stopAmbientSound();
    }
    const focOv = document.getElementById('focus-overlay');
    if(focOv && focOv.classList.contains('active')){
      focOv.classList.remove('active');
    }
  }

  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if(el) el.classList.remove('active');
  });
  
  const targetEl = document.getElementById(id);
  if(targetEl) {
    targetEl.classList.add('active');
    // Ekran açıldığında kaydırma konumunu sıfırla
    targetEl.scrollTop = 0;
  }
  
  const bNav = document.getElementById('bottom-nav');
  if(bNav) bNav.style.display = 'none';
  
  // Alt menü buton aktifliğini otomatik senkronize et
  const activeNavId = SCREEN_TO_NAV[id];
  NAV_BTNS.forEach(n => {
    const el = document.getElementById(n);
    if(el) el.classList.remove('active');
  });
  if(activeNavId){
    const activeBtn = document.getElementById(activeNavId);
    if(activeBtn) activeBtn.classList.add('active');
  }

  // Sol Yan Çekmece (Forest Drawer) aktif sekme senkronizasyonu
  const activeDrawerId = SCREEN_TO_DRAWER[id];
  document.querySelectorAll('.drawer-nav-item').forEach(el => el.classList.remove('active'));
  if(activeDrawerId){
    const activeDrawerEl = document.getElementById(activeDrawerId);
    if(activeDrawerEl) activeDrawerEl.classList.add('active');
  }
  
  // Her ekranın çizim fonksiyonunu birbirinden bağımsız çalıştır (biri hata verse bile ekran geçişi asla bozulmaz)
  if(id==='pg-add') {
    try {
      const scrollArea = document.querySelector('.add-scroll-area');
      if(scrollArea) scrollArea.scrollTop = 0;
      renderTreeSelectGrid();
    } catch(e){ console.warn('renderTreeSelectGrid hatası:', e); }
  }
  if(id==='pg-main') {
    try { renderMain(); } catch(e){ console.warn('renderMain hatası:', e); }
  }
  if(id==='pg-forest') {
    try { renderForest(); } catch(e){ console.warn('renderForest hatası:', e); }
  }
  if(id==='pg-friends') {
    try { renderFriends(); } catch(e){ console.warn('renderFriends hatası:', e); }
  }
  if(id==='pg-stats') {
    try { renderStats(); } catch(e){ console.warn('renderStats hatası:', e); }
  }
  if(id==='pg-settings') {
    try { updateSunInfo(); } catch(e){}
    try { updateBadge(!document.body.classList.contains('day')); } catch(e){}
  }
  if(id==='pg-user') {
    try { updateCloudAuthUI(); } catch(e){}
    try { renderUserProfileUI(); } catch(e){}
  }
}

function navTo(sid, nid){
  goTo(sid);
}

// Global scope güvencesi (tüm inline HTML onclick çağrıları için)
window.goTo = goTo;
window.navTo = navTo;

function initBottomNav(){
  const navMap = {
    'nav-main': 'pg-main',
    'nav-forest': 'pg-forest',
    'nav-friends': 'pg-friends',
    'nav-stats': 'pg-stats',
    'nav-user': 'pg-user',
    'nav-settings': 'pg-settings'
  };
  Object.keys(navMap).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if(btn){
      const targetScreen = navMap[btnId];
      btn.onclick = function(){
        goTo(targetScreen);
      };
    }
  });
}

/* ══════════════════════════════════════════════════════
   ANA SAYFA (PLAN) & DRAG-AND-DROP SÜRÜKLE BIRAK
   ══════════════════════════════════════════════════════ */
let draggedTaskId = null;

function handleDragStart(e, id){
  draggedTaskId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.target.closest('.card').classList.add('dragging');
}
function handleDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.target.closest('.card');
  if(card) card.classList.add('drag-over');
}
function handleDragLeave(e){
  const card = e.target.closest('.card');
  if(card) card.classList.remove('drag-over');
}
function handleDrop(e, targetId){
  e.preventDefault();
  const card = e.target.closest('.card');
  if(card) card.classList.remove('drag-over');
  
  if(!draggedTaskId || draggedTaskId === targetId) return;
  
  const fromIdx = tasks.findIndex(t=>t.id === draggedTaskId);
  const toIdx = tasks.findIndex(t=>t.id === targetId);
  
  if(fromIdx !== -1 && toIdx !== -1){
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    renderMain();
    saveStateToStorage();
  }
}
function handleDragEnd(e){
  document.querySelectorAll('.card').forEach(c=>{
    c.classList.remove('dragging');
    c.classList.remove('drag-over');
  });
  draggedTaskId = null;
}

function moveTask(id, dir){
  const idx = tasks.findIndex(t=>t.id === id);
  if(idx === -1) return;
  const newIdx = idx + dir;
  if(newIdx < 0 || newIdx >= tasks.length) return;
  const [moved] = tasks.splice(idx, 1);
  tasks.splice(newIdx, 0, moved);
  renderMain();
}

function renderMain(){
  updateDateHeader();
  renderWeekStrip();

  const activeKey = toDateKey(activeDate);
  const dayTasks = (tasks || []).filter(t => !isMockStatsEntry(t) && (!t.date || t.date === activeKey));
  const unifiedToday = getUnifiedStatsList().filter(h => h.rawDate === activeKey && !h.failed);
  streakDays = calculateStreakDays();

  document.getElementById('s-total').textContent = dayTasks.length;
  document.getElementById('s-tree').textContent = unifiedToday.length;
  document.getElementById('s-focus-min').textContent = unifiedToday.reduce((a,b)=>a+(b.dur||0), 0);
  const svEl = document.getElementById('streak-val');
  if(svEl) svEl.textContent = streakDays + ' Gün';

  const list = document.getElementById('task-list');
  list.innerHTML = dayTasks.length
    ? dayTasks.map(taskCard).join('')
    : `<div class="empty"><div class="ei">🍃</div><p>Bu güne ait plan bulunmuyor.<br>Yukarıdaki Yeni Görev Planla butonundan ekle.</p></div>`;
  updateDailyGoalUI();
}

function formatTimeDot(str){
  if(!str) return '';
  return String(str).replace(':', '.');
}

function getTaskTimes(t){
  let start = formatTimeDot(t.start);
  let end = formatTimeDot(t.end);
  if(!start){
    return { start: '--.--', end: '' };
  }
  if(!end && t.dur){
    const parts = start.split('.');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if(!isNaN(h) && !isNaN(m)){
      const totalM = h * 60 + m + t.dur;
      const endH = String(Math.floor((totalM / 60) % 24)).padStart(2, '0');
      const endM = String(totalM % 60).padStart(2, '0');
      end = `${endH}.${endM}`;
    }
  }
  return { start, end };
}

function taskCard(t){
  const isDone = !!t.done;
  const treeIco = t.treeType || '🌳';
  const times = getTaskTimes(t);
  
  return `
  <div class="apple-task-card ${isDone ? 'is-done' : ''} draggable-card"
       draggable="true"
       ondragstart="handleDragStart(event, ${t.id})"
       ondragover="handleDragOver(event)"
       ondragleave="handleDragLeave(event)"
       ondrop="handleDrop(event, ${t.id})"
       ondragend="handleDragEnd(event)"
       onclick="openFocus(${t.id})">
    
    <!-- Sol Saat Sütunu (Altlı Üstlü 07.30 - 15.30) -->
    <div class="task-time-col">
      <span class="task-t-start">${times.start}</span>
      ${times.end ? `<span class="task-t-dash">-</span><span class="task-t-end">${times.end}</span>` : ''}
      ${t.start && !isDone ? `<span style="font-size:8.5px;color:var(--accent);font-weight:700;margin-top:2px;display:flex;align-items:center;gap:1px;" title="Başlangıç saatinden ~30 dk önce bildirim yapılır">🔔 30d</span>` : ''}
    </div>

    <!-- Ağaç Türü Rozeti -->
    <div class="task-leading">
      <div class="task-tree-badge" title="${treeIco} Ağacı">${treeIco}</div>
    </div>

    <!-- Görev Gövdesi -->
    <div class="task-body">
      <!-- Üst Satır: Görev Başlığı ve Silme Butonu -->
      <div class="task-row-top">
        <div class="task-title-line" title="${t.title}">${t.title}</div>
        <button class="task-del-btn" onclick="event.stopPropagation();delTask(${t.id})" title="Görevi Sil">×</button>
      </div>

      <!-- Alt Satır: Kategori/Süre (Sol) ve Bitti/Play Butonu (Sağ) - Kusursuz Hizalama -->
      <div class="task-row-bottom">
        <div class="task-bottom-left">
          ${t.cat ? `<span class="task-cat-pill">${t.cat}</span>` : ''}
          <span class="task-dur-badge">⏳ ${t.dur} dk</span>
          ${!isDone ? `<button type="button" class="task-quick-add-btn" onclick="event.stopPropagation();quickExtendTask(${t.id}, 15)" title="Süreye 15 dk ekle">+15d</button>` : ''}
        </div>

        <div class="task-bottom-right" onclick="event.stopPropagation()">
          ${!isDone ? `
            <button class="task-play-btn" onclick="openFocus(${t.id})" title="Odağı Başlat">
              <span class="play-ico">▶</span>
              <span class="play-txt">Başla</span>
            </button>
          ` : `
            <span class="task-done-pill">Bitti ✓</span>
          `}
        </div>
      </div>
    </div>

  </div>`;
}

/* ══════════════════════════════════════════════════════
   ORMANIM (GÖRSEL BAHÇE) MANTIĞI
   ══════════════════════════════════════════════════════ */
let currentForestFilter = 'all';

function getForestTrees(){
  // Ormandaki ağaçlar: Gerçekleşmiş odak geçmişi (başarılı ve pes edilenler)
  // ve tamamlanmış (done ve tree) plan görevleri.
  const cleanHistory = (focusHistory || []).filter(h => h && !isMockStatsEntry(h));
  const completedTasks = (tasks || []).filter(t => t && !isMockStatsEntry(t) && t.done && t.tree);
  
  const trees = [...cleanHistory];
  completedTasks.forEach(t => {
    const exists = trees.some(h => String(h.taskId) === String(t.id) || (h.title === t.title && !h.failed));
    if(!exists){
      trees.push({
        id: t.id,
        taskId: t.id,
        title: t.title,
        cat: t.cat || 'Genel',
        treeType: t.treeType || '🌳',
        treeName: t.treeName || 'Meşe',
        dur: Number(t.dur) || 25,
        time: t.start || '',
        date: t.date || getPastDateDisplay(0),
        rawDate: t.date || toDateKey(new Date()),
        failed: false
      });
    }
  });
  return trees;
}

function filterForest(filter){
  currentForestFilter = filter;
  ['all','oak','pine','bonsai','apple','dead'].forEach(k=>{
    const btn = document.getElementById(`ff-${k}`);
    if(btn) btn.classList.remove('active');
  });
  if(filter==='all') document.getElementById('ff-all')?.classList.add('active');
  if(filter==='🌳') document.getElementById('ff-oak')?.classList.add('active');
  if(filter==='🌲') document.getElementById('ff-pine')?.classList.add('active');
  if(filter==='🎋') document.getElementById('ff-bonsai')?.classList.add('active');
  if(filter==='🍎') document.getElementById('ff-apple')?.classList.add('active');
  if(filter==='🥀') document.getElementById('ff-dead')?.classList.add('active');
  renderForest();
}

let currentForestSlotGroups = [];

function renderForest(){
  const allTrees = getForestTrees();
  const healthyTrees = allTrees.filter(h => !h.failed && h.treeType !== '🥀');
  const deadTrees = allTrees.filter(h => h.failed || h.treeType === '🥀');

  const totalLiving = healthyTrees.length;
  const totalDead = deadTrees.length;
  const areaM2 = totalLiving * 35;
  const o2Kg = (totalLiving * 2.4).toFixed(1);

  const tTreesEl = document.getElementById('f-total-trees');
  if(tTreesEl) tTreesEl.textContent = totalLiving;

  const tAreaEl = document.getElementById('f-total-area');
  if(tAreaEl) tAreaEl.textContent = `${areaM2} m²`;

  const tO2El = document.getElementById('f-total-o2');
  if(tO2El) tO2El.textContent = `${o2Kg} kg`;

  const tDeadEl = document.getElementById('f-total-dead');
  if(tDeadEl) tDeadEl.textContent = totalDead;

  // Filtreleme:
  // - 'all' (Tümü): Canlı ve kuruyan tüm ağaçlar
  // - '🥀' (Kuruyan): Yalnızca kurumuş ağaçlar
  // - Belirli tür ('🌳', '🌲', '🎋', '🍎'): Canlı ağaçlar arasından o tür
  let filtered = [];
  if(currentForestFilter === 'all'){
    filtered = [...healthyTrees, ...deadTrees];
  } else if(currentForestFilter === '🥀'){
    filtered = [...deadTrees];
  } else {
    filtered = healthyTrees.filter(h => (h.treeType || '🌳') === currentForestFilter);
  }

  // 12 SABİT KUTU DÖNGÜSÜ:
  // Kutu sayısı daima 12'dir. Kutular full dolduğunda soldan başlayarak
  // kutulardaki ağaç sayısı 1 artırılır (×2, ×3 vb.)
  const FIXED_SLOTS = 12;
  const slotGroups = Array.from({ length: FIXED_SLOTS }, () => []);
  filtered.forEach((tree, idx) => {
    slotGroups[idx % FIXED_SLOTS].push(tree);
  });
  currentForestSlotGroups = slotGroups;

  // Kat & Doluluk Seviyesi Hesaplaması (Daima canlı ağaç sayısına göre)
  const completedRounds = Math.floor(totalLiving / FIXED_SLOTS);
  const currentRound = completedRounds + 1;
  const inCurrentRound = totalLiving % FIXED_SLOTS;
  const pct = Math.round((inCurrentRound / FIXED_SLOTS) * 100);

  // Unvan ve Seviye Metinleri
  const levelTitleEl = document.getElementById('forest-level-title');
  const levelDescEl = document.getElementById('forest-level-desc');
  if(levelTitleEl && levelDescEl){
    if(totalLiving === 0){
      levelTitleEl.textContent = '🌱 Başlangıç Fidanlığı (12 Sabit Kutu)';
      levelDescEl.textContent = totalDead > 0 
        ? `${totalDead} ağaç kurudu. Yeni bir seans başlatıp ilk kutuyu yeşert!` 
        : 'İlk odak seansını tamamlayarak 1. kutuna fidanını dik!';
    } else if(totalLiving < 12){
      levelTitleEl.textContent = '🌱 Genç Fidanlık (1. Kat)';
      levelDescEl.textContent = `12 sabit kutuda ${totalLiving}/12 canlı fidan yetişti.`;
    } else if(totalLiving < 24){
      levelTitleEl.textContent = '🌿 Gelişen Koruluk (2. Kat)';
      levelDescEl.textContent = `12 kutu doldu! Soldan başlayarak ${inCurrentRound || 12} kutuda 2. ağaçlar yetişti.`;
    } else if(totalLiving < 36){
      levelTitleEl.textContent = '🌲 Yeşil Vadi (3. Kat)';
      levelDescEl.textContent = `Her kutuda çifter ağaç yetişti! Soldan başlayarak 3. kat büyüyor (${inCurrentRound || 12}/12).`;
    } else {
      levelTitleEl.textContent = `🏞️ Kadim Orman Krallığı (${currentRound}. Kat)`;
      levelDescEl.textContent = `12 kutuda toplam ${totalLiving} canlı ağaç ile devasa bir ekosistem yarattın!`;
    }
  }

  // Parsel İlerleme Çubuğu ve Bilgisi (12 Sabit Kutu Doluluğu)
  const parcelInfoEl = document.getElementById('forest-parcel-info');
  if(parcelInfoEl){
    let roundText = '';
    if(totalLiving === 0){
      roundText = `0/12 Kutu Dolu (%0)`;
    } else if(inCurrentRound === 0){
      roundText = `12/12 Kutu Dolu (%100) · ${completedRounds}. Kat Tamamlandı!`;
    } else {
      roundText = `${inCurrentRound}/12 Kutu Dolu (%${pct}) · ${currentRound}. Kat`;
    }

    const fillPct = (totalLiving > 0 && inCurrentRound === 0) ? 100 : pct;
    parcelInfoEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;font-weight:700;margin-bottom:5px;">
        <span style="color:var(--text1);">📍 12 Sabit Parsel Bahçesi (${currentRound}. Kat)</span>
        <span style="color:var(--accent);">${roundText}</span>
      </div>
      <div style="width:100%;height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
        <div style="width:${fillPct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px;transition:width 0.4s ease;"></div>
      </div>
    `;
  }

  // 12 SABİT KUTU ÜRETİMİ (Kutu sayısı 12'de hep sabittir)
  const meadow = document.getElementById('garden-meadow');
  let slotsHtml = '';

  for(let slotIdx = 0; slotIdx < FIXED_SLOTS; slotIdx++){
    const boxTrees = slotGroups[slotIdx];
    const count = boxTrees.length;

    if(count === 0){
      // Boş Kutu
      slotsHtml += `
        <div class="garden-slot empty-slot" onclick="goTo('pg-add')" title="${slotIdx + 1}. Kutu (Boş) - Fidan dikmek için dokun">
          <span style="font-size:18px;opacity:.4;">🌱</span>
          <span class="tree-dur-tag" style="opacity:.6;">+ Dik</span>
        </div>`;
    } else if(count === 1){
      // Tek Ağaç Bulunan Kutu
      const tree = boxTrees[0];
      const isDead = (tree.failed || tree.treeType === '🥀');
      if(isDead){
        slotsHtml += `
          <div class="garden-slot dead-slot" onclick="showSlotDetail(${slotIdx})" title="${tree.title} - Kurumuş Ağaç (Dokun: Detay)">
            <span class="tree-ico" style="filter:grayscale(0.6);opacity:0.85;">🥀</span>
            <span class="tree-dur-tag" style="background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.35);">Kurudu</span>
          </div>`;
      } else {
        const ico = tree.treeType || '🌳';
        slotsHtml += `
          <div class="garden-slot" onclick="showSlotDetail(${slotIdx})" title="${tree.title} - ${tree.treeName || 'Ağaç'} (Dokun: Detay)">
            <span class="tree-ico">${ico}</span>
            <span class="tree-dur-tag">${tree.dur} dk</span>
          </div>`;
      }
    } else {
      // 12 Kutu Dolduğunda Soldan Başlayarak Sayısı Artan Kutu (×2, ×3 vb.)
      const livingInBox = boxTrees.filter(t => !t.failed && t.treeType !== '🥀');
      const allDead = livingInBox.length === 0;
      const totalSlotDur = boxTrees.reduce((a, b) => a + (b.dur || 0), 0);
      const displayTree = livingInBox.length > 0 ? livingInBox[livingInBox.length - 1] : boxTrees[count - 1];
      const ico = allDead ? '🥀' : (displayTree.treeType || '🌳');
      const titles = boxTrees.map(t => t.title).join(' · ');

      if(allDead){
        slotsHtml += `
          <div class="garden-slot dead-slot multi-slot" onclick="showSlotDetail(${slotIdx})" title="${titles} (${count} Kurumuş Ağaç - Dokun: Detay)">
            <span class="slot-count-badge dead-badge">×${count}</span>
            <span class="tree-ico" style="filter:grayscale(0.6);opacity:0.85;">🥀</span>
            <span class="tree-dur-tag" style="background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.35);">×${count} Kurudu</span>
          </div>`;
      } else {
        slotsHtml += `
          <div class="garden-slot multi-slot" onclick="showSlotDetail(${slotIdx})" title="${titles} (${count} Ağaç - Dokun: Detay)">
            <span class="slot-count-badge">×${count}</span>
            <span class="tree-ico">${ico}</span>
            <span class="tree-dur-tag">${totalSlotDur} dk</span>
          </div>`;
      }
    }
  }

  meadow.innerHTML = slotsHtml;
}

function showSlotDetail(slotIdx){
  if(!currentForestSlotGroups || !currentForestSlotGroups[slotIdx]) return;
  const boxTrees = currentForestSlotGroups[slotIdx];
  if(!boxTrees.length) return;

  if(boxTrees.length === 1){
    showTreeDetail(boxTrees[0].id);
    return;
  }

  // Çoklu Ağaç Bulunan Sabit Kutu Detayı
  const living = boxTrees.filter(t => !t.failed && t.treeType !== '🥀');
  const dead = boxTrees.filter(t => t.failed || t.treeType === '🥀');
  const allDead = living.length === 0;
  const totalMin = boxTrees.reduce((a,b)=>a+(b.dur||0), 0);
  const displayTree = living.length > 0 ? living[living.length - 1] : boxTrees[boxTrees.length - 1];
  const ico = allDead ? '🥀' : (displayTree.treeType || '🌳');

  document.getElementById('modal-tree-icon').textContent = ico;
  document.getElementById('modal-tree-title').textContent = `${slotIdx + 1}. Kutu (Toplam ×${boxTrees.length} Ağaç)`;
  document.getElementById('modal-tree-type').textContent = allDead 
    ? `Tümü Kurumuş (${boxTrees.length} Ağaç)` 
    : `${living.length} Canlı Ağaç${dead.length ? `, ${dead.length} Kurumuş` : ''} · ${totalMin} dk Odak`;

  const singleBody = document.getElementById('modal-tree-single-body');
  const multiBody = document.getElementById('modal-tree-multi-body');

  if(singleBody) singleBody.style.display = 'none';
  if(multiBody){
    multiBody.style.display = 'flex';
    multiBody.innerHTML = boxTrees.map((t, i) => {
      const isD = (t.failed || t.treeType === '🥀');
      const tIco = isD ? '🥀' : (t.treeType || '🌳');
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:10px;border:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="font-size:20px;line-height:1;">${tIco}</span>
            <div style="text-align:left;min-width:0;">
              <div style="font-weight:700;color:var(--text1);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
              <div style="font-size:10.5px;color:var(--text3);margin-top:2px;">${t.cat || 'Genel'} · ${t.date || ''} ${t.time || ''}</div>
            </div>
          </div>
          <span style="font-size:11.5px;font-weight:800;color:${isD ? 'var(--danger,#ef4444)' : 'var(--accent)'};flex-shrink:0;margin-left:8px;">
            ${isD ? 'Kurudu' : `${t.dur} dk`}
          </span>
        </div>`;
    }).join('');
  }

  document.getElementById('tree-modal-backdrop').classList.add('active');
}

function showTreeDetail(id){
  const allTrees = getForestTrees();
  const item = allTrees.find(h => String(h.id) === String(id)) || 
               (focusHistory || []).find(h => String(h.id) === String(id)) ||
               (tasks || []).find(t => String(t.id) === String(id));
  if(!item) return;

  const isDead = (item.failed || item.treeType === '🥀');
  document.getElementById('modal-tree-icon').textContent = isDead ? '🥀' : (item.treeType || '🌳');
  document.getElementById('modal-tree-title').textContent = item.title;
  document.getElementById('modal-tree-type').textContent = isDead ? 'Kurumuş Ağaç (Pes Edildi)' : `${item.treeName || 'Ağaç'} Fidanı`;
  document.getElementById('modal-tree-dur').textContent = isDead ? `${item.dur} dk (Yarım Kaldı)` : `${item.dur} dakika odak`;
  document.getElementById('modal-tree-cat').textContent = item.cat || 'Genel';
  document.getElementById('modal-tree-date').textContent = `${item.date || ''} ${item.time ? '· ' + item.time : ''}`;

  const singleBody = document.getElementById('modal-tree-single-body');
  const multiBody = document.getElementById('modal-tree-multi-body');
  if(singleBody) singleBody.style.display = 'flex';
  if(multiBody) multiBody.style.display = 'none';

  document.getElementById('tree-modal-backdrop').classList.add('active');
}

function closeTreeModal(){
  document.getElementById('tree-modal-backdrop').classList.remove('active');
  const singleBody = document.getElementById('modal-tree-single-body');
  const multiBody = document.getElementById('modal-tree-multi-body');
  if(singleBody) singleBody.style.display = 'flex';
  if(multiBody) multiBody.style.display = 'none';
}

/* ══════════════════════════════════════════════════════
   30 DAKİKA ÖNCESİ PLAN HATIRLATICI & BİLDİRİM SİSTEMİ
   ══════════════════════════════════════════════════════ */
let planRemindersEnabled = true;
let currentRemindedTask = null;

function onPlanRemindersToggle(){
  const chk = document.getElementById('toggle-plan-reminders');
  if(chk) planRemindersEnabled = chk.checked;
  saveStateToStorage();
  showAppToast(planRemindersEnabled ? 'Plan hatırlatıcıları açıldı (~30 dk önce bildirim) ⏰' : 'Plan hatırlatıcıları kapatıldı.', 'ℹ️');
}

function checkTaskReminders(){
  if(!planRemindersEnabled) return;
  const now = new Date();
  const todayKey = toDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  (tasks || []).forEach(task => {
    if(!task || task.done || !task.start) return;
    // Yalnızca bugünün görevlerini kontrol et
    if(task.date !== todayKey) return;
    // Eğer bu görev için 30 dk hatırlatması zaten yapıldıysa geç
    if(task.reminded30) return;

    const parts = task.start.split(':');
    if(parts.length < 2) return;
    const sh = parseInt(parts[0], 10);
    const sm = parseInt(parts[1], 10);
    if(isNaN(sh) || isNaN(sm)) return;

    const taskStartMin = sh * 60 + sm;
    const diff = taskStartMin - nowMin;

    // Başlangıç saatine yaklaşık 30 dakika kala (1 ile 30 dakika arası)
    if(diff > 0 && diff <= 30){
      task.reminded30 = true;
      triggerTaskReminder(task, diff);
      saveStateToStorage();
    } else if(diff <= 0){
      // Saati zaten geçmiş bir görevse sonradan tekrar hatırlatma yapmamak için işaretle
      task.reminded30 = true;
    }
  });
}

function triggerTaskReminder(task, diffMinutes = 30){
  currentRemindedTask = task;

  // 1. Sesli Tibet zili melodisi çal
  if(soundEnabled){
    try { playChimeSound(); } catch(e){}
  }

  // 2. Tarayıcı / Sistem Web Notification Bildirimi Gönder
  if("Notification" in window && Notification.permission === "granted"){
    try {
      const notif = new Notification(`⏰ Plan Hatırlatması (~${diffMinutes} dk)`, {
        body: `"${task.title}" planınız ${task.start} saatinde başlıyor. Hazırlanma vakti! 🌱`,
        icon: "https://fav.farm/⏰"
      });
      notif.onclick = function(){
        window.focus();
        if(task && task.id) openFocus(task.id);
      };
    } catch(e){}
  }

  // 3. Ekran İçi Toast Bildirimi
  showAppToast(`⏰ Plan Hatırlatması: "${task.title}" yaklaşık ${diffMinutes} dk sonra (${task.start}) başlıyor!`, '🔔');

  // 4. Ekran İçi Zengin Hatırlatma Modalı
  const modal = document.getElementById('task-reminder-modal-backdrop');
  const titleEl = document.getElementById('reminder-modal-title');
  const timeEl = document.getElementById('reminder-modal-time');
  const descEl = document.getElementById('reminder-modal-desc');

  if(titleEl) titleEl.textContent = task.title;
  if(timeEl) timeEl.innerHTML = `<span>🕒</span> ${task.start} - ${task.end || '--.--'} (${task.dur || 25} dk)`;
  if(descEl) descEl.textContent = `"${task.title}" planınız yaklaşık ${diffMinutes} dakika sonra (${task.start}) başlayacak. Masanızı ve zihninizi hazırlayın! 🌱`;

  if(modal) modal.classList.add('active');
}

function closeTaskReminderModal(){
  const m = document.getElementById('task-reminder-modal-backdrop');
  if(m) m.classList.remove('active');
}

function startRemindedTask(){
  closeTaskReminderModal();
  if(currentRemindedTask){
    goTo('pg-main');
    openFocus(currentRemindedTask.id);
  }
}

function requestNotificationPermission(){
  if(!("Notification" in window)){
    showAppToast("Tarayıcınız sistem bildirimlerini desteklemiyor. Uygulama içi hatırlatıcılar aktiftir.", "ℹ️");
    return;
  }
  Notification.requestPermission().then(permission => {
    updateNotificationButtonUI();
    if(permission === 'granted'){
      showAppToast('Sistem bildirimleri başarıyla etkinleştirildi! 🔔', '✅');
      try {
        new Notification("Odak Ajandası", {
          body: "Plan hatırlatmalarınız artık masaüstü/telefon bildirimi olarak da iletilecektir. ⏰",
          icon: "https://fav.farm/🌲"
        });
      } catch(e){}
    } else {
      showAppToast('Bildirim izni verilmedi. Uygulama içi bildirimler çalışmaya devam edecek.', 'ℹ️');
    }
  });
}

function updateNotificationButtonUI(){
  const btn = document.getElementById('btn-req-notif');
  if(!btn) return;
  if(!("Notification" in window)){
    btn.style.display = 'none';
    return;
  }
  if(Notification.permission === 'granted'){
    btn.innerHTML = '<span>✅</span> Sistem Bildirimleri Aktif';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    btn.onclick = () => showAppToast('Sistem bildirimleriniz zaten etkin durumda! 🔔', 'ℹ️');
  } else {
    btn.innerHTML = '<span>🔔</span> Sistem Bildirimlerini Aç';
    btn.onclick = requestNotificationPermission;
  }
}

function testTaskReminder(){
  const dummyTask = {
    id: Date.now(),
    title: 'Örnek Çalışma Planı',
    start: '09:00',
    end: '10:00',
    dur: 25,
    treeType: '🌳'
  };
  triggerTaskReminder(dummyTask, 30);
}

/* ══════════════════════════════════════════════════════
   GÖREV EKLEME
   ══════════════════════════════════════════════════════ */
function selectTreeType(emoji, name){
  selectedTreeEmoji = emoji;
  selectedTreeName = name;
  renderTreeSelectGrid();
}

function saveTask(){
  const title = document.getElementById('add-title').value.trim();
  if(!title){
    const ti = document.getElementById('add-title');
    ti.style.borderColor = 'var(--danger)';
    setTimeout(()=>ti.style.borderColor='',1200);
    return;
  }
  const cat = document.getElementById('add-cat').value.trim();
  let dur = parseInt(document.getElementById('add-dur').value)||25;
  dur = Math.max(1, Math.min(180, dur));
  const startVal = document.getElementById('add-start').value;
  const endVal = document.getElementById('add-end').value;
  
  tasks.push({
    id: Date.now(),
    title,
    cat,
    treeType: selectedTreeEmoji,
    treeName: selectedTreeName,
    start: startVal,
    end: endVal,
    dur,
    tree: false,
    done: false,
    reminded30: false,
    date: toDateKey(activeDate)
  });
  
  if(cat && !catSuggestions.includes(cat)) catSuggestions.push(cat);
  
  document.getElementById('add-title').value = '';
  document.getElementById('add-cat').value = '';
  document.getElementById('add-dur').value = '25';
  navTo('pg-main','nav-main');
  saveStateToStorage();
  try { renderStats(); renderForest(); } catch(e){}
  
  // Bildirim kontrolünü tetikle
  setTimeout(checkTaskReminders, 250);
  if(startVal){
    showAppToast(`"${title}" planlandı! Saatinden (~30 dk) önce hatırlatma alacaksın ⏰`, '🎯');
  } else {
    showAppToast(`"${title}" başarıyla plana eklendi! 🎯`, '✅');
  }
}

function delTask(id){
  const deletingTask = (tasks || []).find(t => String(t.id) === String(id));
  const taskTitle = deletingTask ? deletingTask.title : 'Plan';
  const isActiveFocused = (activeTask && String(activeTask.id) === String(id));

  if(isActiveFocused){
    clearInterval(timerInt);
    clearInterval(breakTimerInt);
    stopAmbientSound();
    isFocusing = false;
    isBreakMode = false;
    isShortBreak = false;
    timeLeft = 0;
    totalTime = 0;
    activeTask = null;
    hideMiniFocusBar();
    closeFocusOverlay();
    
    const ov = document.getElementById('focus-overlay');
    if(ov) ov.className = '';
    const startBtn = document.getElementById('foc-btn-start');
    if(startBtn){
      startBtn.textContent = '🌱 Tohumu Ek';
      startBtn.onclick = startFocus;
      startBtn.style.display = 'block';
    }
    const giveUpBtn = document.getElementById('foc-btn-giveup');
    if(giveUpBtn) giveUpBtn.style.display = 'none';
    const breakBtn = document.getElementById('foc-btn-pause-break');
    if(breakBtn) breakBtn.style.display = 'none';
    const resumeBtn = document.getElementById('foc-btn-resume');
    if(resumeBtn) resumeBtn.style.display = 'none';
    const waterBtn = document.getElementById('foc-btn-water');
    if(waterBtn) waterBtn.style.display = 'none';

    showAppToast(`"${taskTitle}" silindi, devam eden odaklanma sonlandırıldı. 🛑`, '🗑️');
  }

  tasks = (tasks || []).filter(t => String(t.id) !== String(id));
  renderMain();
  try { renderStats(); renderForest(); } catch(e){}
  saveStateToStorage();
}

function initCatInput(){
  const inp=document.getElementById('add-cat'),wrap=document.getElementById('cat-suggestions');
  function render(f){
    const list=catSuggestions.filter(c=>!f||c.toLowerCase().includes(f.toLowerCase()));
    if(!list.length){wrap.style.display='none';return;}
    wrap.style.display='flex';
    wrap.innerHTML=list.map(c=>`<button type="button" class="cat-pill" onclick="pickCat('${c}')">${c}</button>`).join('');
  }
  inp.addEventListener('focus',()=>render(inp.value));
  inp.addEventListener('input',()=>render(inp.value));
  inp.addEventListener('blur',()=>setTimeout(()=>{wrap.style.display='none';},200));
}
function pickCat(c){
  document.getElementById('add-cat').value=c;
  document.getElementById('cat-suggestions').style.display='none';
}
