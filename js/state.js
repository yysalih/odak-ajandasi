/* ══════════════════════════════════════════════════════
   TARİH YÖNETİMİ & HAFTALIK ŞERİT
   ══════════════════════════════════════════════════════ */
let activeDate = new Date();

function toDateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function shiftActiveDate(days){
  activeDate.setDate(activeDate.getDate() + days);
  updateDateHeader();
  renderWeekStrip();
  renderMain();
}

function resetToToday(){
  activeDate = new Date();
  updateDateHeader();
  renderWeekStrip();
  renderMain();
}

function updateDateHeader(){
  const todayKey = toDateKey(new Date());
  const activeKey = toDateKey(activeDate);
  const titleEl = document.getElementById('date-nav-title');
  const eyebrowEl = document.getElementById('plan-date-eyebrow');
  
  const formatter = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'long' });
  const formatted = formatter.format(activeDate);
  
  if(eyebrowEl) eyebrowEl.textContent = formatted;

  if(titleEl){
    if(activeKey === todayKey){
      titleEl.textContent = 'Bugün';
    } else {
      const shortFormatter = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'short', weekday:'short' });
      titleEl.textContent = shortFormatter.format(activeDate);
    }
  }
}

function renderWeekStrip(){
  const strip = document.getElementById('week-strip');
  if(!strip) return;
  const curr = new Date(activeDate);
  const dayOfWeek = curr.getDay(); // 0: Pazar, 1: Pazartesi
  const diffToMonday = curr.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  
  const monday = new Date(curr.setDate(diffToMonday));
  let html = '';
  const dayNames = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const activeKey = toDateKey(activeDate);

  for(let i=0; i<7; i++){
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dKey = toDateKey(d);
    const isActive = dKey === activeKey;
    const hasTasks = tasks.some(t => !isMockStatsEntry(t) && t.date === dKey);
    const hasTrees = getUnifiedStatsList().some(h => h.rawDate === dKey);
    
    html += `
      <div class="week-day-pill ${isActive?'active':''}" onclick="selectDate('${dKey}')">
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-num">${d.getDate()}</span>
        ${(hasTasks || hasTrees)?`<span class="week-day-dot">•</span>`:''}
      </div>`;
  }
  strip.innerHTML = html;
}

function selectDate(key){
  const parts = key.split('-');
  activeDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  updateDateHeader();
  renderWeekStrip();
  renderMain();
}

/* ══════════════════════════════════════════════════════
   PLAN EKRANI TAKVİM SEÇİCİSİ (CANLI AKIŞ TAKVİMİ)
   ══════════════════════════════════════════════════════ */
let planCalCurrentDate = new Date();
let planCalSelectedDateKey = toDateKey(new Date());

function openPlanCalendarModal(){
  planCalCurrentDate = new Date(activeDate);
  planCalSelectedDateKey = toDateKey(activeDate);
  renderPlanCalendar();
  document.getElementById('plan-cal-modal-backdrop')?.classList.add('active');
}

function closePlanCalendarModal(){
  document.getElementById('plan-cal-modal-backdrop')?.classList.remove('active');
}

function planCalShiftMonth(delta){
  planCalCurrentDate.setDate(1);
  planCalCurrentDate.setMonth(planCalCurrentDate.getMonth() + delta);
  renderPlanCalendar();
}

function planCalJumpToday(){
  planCalCurrentDate = new Date();
  planCalSelectedDateKey = toDateKey(new Date());
  renderPlanCalendar();
}

function onPlanCalendarDateClick(dKey){
  if(planCalSelectedDateKey === dKey){
    applyPlanCalendarSelection();
    return;
  }
  planCalSelectedDateKey = dKey;
  renderPlanCalendar();
}

function applyPlanCalendarSelection(){
  selectDate(planCalSelectedDateKey);
  closePlanCalendarModal();
  const parts = planCalSelectedDateKey.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  const formattedDate = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long' }).format(dt);
  showAppToast(`📅 ${formattedDate} planına geçildi`, '🌿');
}

function renderPlanCalendar(){
  const year = planCalCurrentDate.getFullYear();
  const month = planCalCurrentDate.getMonth();
  
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const monthLbl = document.getElementById('plan-cal-month-label');
  if(monthLbl) monthLbl.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1; // Pazartesi = 0
  if(startOffset < 0) startOffset = 6;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(new Date());

  const gridEl = document.getElementById('plan-cal-grid-cells');
  if(!gridEl) return;

  let html = '';

  for(let i=0; i<startOffset; i++){
    html += `<div class="cal-cell empty"></div>`;
  }

  const planUnifiedList = getUnifiedStatsList();
  for(let d=1; d<=totalDays; d++){
    const dKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const daySessions = planUnifiedList.filter(h => h.rawDate === dKey);
    const dayMin = daySessions.reduce((a,b)=>a+(b.dur||0), 0);
    const dayTasks = (tasks || []).filter(t => !isMockStatsEntry(t) && t.date === dKey);
    const isToday = dKey === todayKey;
    const isSelected = dKey === planCalSelectedDateKey;

    let focusClass = '';
    let badgeText = '';
    if(dayMin > 0){
      if(dayMin < 45) focusClass = 'has-focus-1';
      else if(dayMin < 90) focusClass = 'has-focus-2';
      else focusClass = 'has-focus-3';
      badgeText = `${dayMin}d`;
    }

    const cls = [
      'cal-cell',
      focusClass,
      isToday ? 'is-today' : '',
      isSelected ? 'is-selected' : ''
    ].filter(Boolean).join(' ');

    const hasActivity = dayTasks.length > 0 || daySessions.length > 0;

    html += `
      <div class="${cls}" onclick="onPlanCalendarDateClick('${dKey}')" title="${dKey}: ${dayTasks.length} plan, ${dayMin} dk odak">
        <span class="cal-cell-num">${d}</span>
        ${badgeText ? `<span class="cal-cell-badge">${badgeText}</span>` : ''}
        ${(hasActivity && !badgeText) ? `<span style="font-size:7px;line-height:1;color:var(--accent);margin-top:1px;">•</span>` : ''}
      </div>`;
  }

  gridEl.innerHTML = html;
  renderPlanCalendarDayDetail();
}

function renderPlanCalendarDayDetail(){
  const detailEl = document.getElementById('plan-cal-day-detail');
  if(!detailEl) return;

  const parts = planCalSelectedDateKey.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  const formattedDate = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'long' }).format(dt);
  const isToday = planCalSelectedDateKey === toDateKey(new Date());

  const planDayUnified = getUnifiedStatsList();
  const daySessions = planDayUnified.filter(h => h.rawDate === planCalSelectedDateKey);
  const totalMin = daySessions.reduce((a,b)=>a+(b.dur||0), 0);
  const treeCount = daySessions.length;
  const dayTasks = (tasks || []).filter(t => !isMockStatsEntry(t) && t.date === planCalSelectedDateKey);

  detailEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:12px;font-weight:800;color:var(--text1);">
          ${formattedDate} ${isToday ? '<span style="color:var(--accent);font-weight:700;">(Bugün)</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">
          📋 ${dayTasks.length} Görev Planı · 🌲 ${treeCount} Ağaç (${totalMin} dk)
        </div>
      </div>
      <button class="btn-primary" style="padding:7px 12px;font-size:11px;border-radius:8px;" onclick="applyPlanCalendarSelection()">
        ✓ Plana Git
      </button>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════
   VERİ YAPILARI (STATE) & OTOMATİK VERİ YEDEKLEME (LOCALSTORAGE)
   ══════════════════════════════════════════════════════ */
const STORAGE_KEY = 'odak_ajandasi_db_v2';
const todayStr = toDateKey(new Date());

function getPastDateKey(daysAgo){
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateKey(d);
}

function getPastDateDisplay(daysAgo){
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('tr-TR');
}

let tasks=[];

/*
 * ★ KALICI ODAK GEÇMİŞİ — Kullanıcı Seansları
 */
let focusHistory=[];

let inbox=[];
let catSuggestions=['İş','Atölye','Akademik','Kişisel','Yazılım'];
let streakDays=0;

const MOCK_TITLES = [
  'Fabrika Mesaisi',
  'Deri Cüzdan Dikimi',
  'YBS Seminer Sunumu',
  'Kodlama & Refactor',
  'Cüzdan Kenar Zımparası',
  'Üretim Hattı Planı',
  'Tez Araştırması & Notlar',
  'Kitap Okuma & Özet',
  'UI Tasarım İncelemesi',
  'Atölye Deri Kesimi'
];
const MOCK_IDS = [1, 2, 3, 101, 104, 105, 106, 107, 108, 109, 110];

function isMockStatsEntry(item){
  if(!item) return true;
  if(MOCK_IDS.includes(item.id)) return true;
  if(item.title && MOCK_TITLES.includes(String(item.title).trim())){
    if(item.id < 1000000 || MOCK_IDS.includes(item.id)){
      return true;
    }
  }
  return false;
}

function formatKeyToDisplayDate(key){
  if(!key) return '';
  try {
    const parts = key.split('-');
    if(parts.length === 3){
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return dt.toLocaleDateString('tr-TR');
    }
  } catch(e){}
  return key;
}

function calculateStreakDays(){
  const list = getUnifiedStatsList();
  if(!list.length) return 0;
  const daysSet = new Set(list.map(item => item.rawDate || item.date).filter(Boolean));
  if(!daysSet.size) return 0;
  
  const today = new Date();
  let streak = 0;
  let cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = toDateKey(cur);
  
  if(daysSet.has(todayKey)){
    while(daysSet.has(toDateKey(cur))){
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
  } else {
    cur.setDate(cur.getDate() - 1);
    while(daysSet.has(toDateKey(cur))){
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
  }
  return streak;
}

function getUnifiedStatsList(){
  const cleanTasks = (tasks || []).filter(t => t && !isMockStatsEntry(t));
  const cleanHistory = (focusHistory || []).filter(h => h && !isMockStatsEntry(h));

  const unified = [];
  const matchedHistoryIds = new Set();

  cleanTasks.forEach(task => {
    const rawDate = task.date || toDateKey(new Date());
    const displayDate = formatKeyToDisplayDate(rawDate);
    const timeStr = task.start ? formatTimeDot(task.start) : '';

    const match = cleanHistory.find(h => 
      !matchedHistoryIds.has(h.id) && 
      (h.taskId === task.id || (h.title === task.title && (h.rawDate === rawDate || !h.rawDate)))
    );

    if(match){
      matchedHistoryIds.add(match.id);
      unified.push({
        id: match.id,
        taskId: task.id,
        title: task.title,
        cat: match.cat || task.cat || 'Genel',
        treeType: match.treeType || task.treeType || '🌳',
        treeName: match.treeName || task.treeName || 'Meşe',
        dur: Number(match.dur) || Number(task.dur) || 25,
        time: match.time || timeStr,
        date: match.date || displayDate,
        rawDate: match.rawDate || rawDate,
        done: true,
        failed: !!match.failed,
        isTask: true
      });
    } else {
      unified.push({
        id: task.id,
        taskId: task.id,
        title: task.title,
        cat: task.cat || 'Genel',
        treeType: task.treeType || '🌳',
        treeName: task.treeName || 'Meşe',
        dur: Number(task.dur) || 25,
        time: timeStr,
        date: displayDate,
        rawDate: rawDate,
        done: !!task.done,
        failed: false,
        isTask: true
      });
    }
  });

  cleanHistory.forEach(h => {
    if(!matchedHistoryIds.has(h.id)){
      const rawDate = h.rawDate || toDateKey(new Date());
      unified.push({
        id: h.id,
        taskId: h.taskId || null,
        title: h.title || 'Odak Seansı',
        cat: h.cat || 'Genel',
        treeType: h.treeType || '🌳',
        treeName: h.treeName || 'Meşe',
        dur: Number(h.dur) || 25,
        time: h.time || '',
        date: h.date || formatKeyToDisplayDate(rawDate),
        rawDate: rawDate,
        done: !h.failed,
        failed: !!h.failed,
        isTask: false
      });
    }
  });

  return unified;
}

let selectedTreeEmoji='🌳';
let selectedTreeName='Meşe';

let activeTask=null,timerInt=null,timeLeft=0,totalTime=0,isFocusing=false;
let isBreakMode=false;

/* ══════════════════════════════════════════════════════
   1. NADİR AĞAÇLAR & BAŞARIM KİLİTLERİ (GAMIFICATION)
   ══════════════════════════════════════════════════════ */
const TREE_DEFS = [
  { emoji: '🌳', name: 'Meşe', req: null },
  { emoji: '🌲', name: 'Ulu Çam', req: null },
  { emoji: '🎋', name: 'Bonsai', req: null },
  { emoji: '🍎', name: 'Elma', req: null },
  { emoji: '🌸', name: 'Sakura', req: { type: 'streak', val: 3, label: '3 Gün Seri' } },
  { emoji: '🫒', name: 'Kadim Zeytin', req: { type: 'totalMin', val: 600, label: '10 Sa Odak' } },
  { emoji: '🌲✨', name: 'Efsanevi Sekoya', req: { type: 'totalMin', val: 3000, label: '50 Sa Odak' } }
];

function isTreeUnlocked(tree){
  if(!tree.req) return true;
  if(tree.req.type === 'streak') return calculateStreakDays() >= tree.req.val;
  if(tree.req.type === 'totalMin'){
    const totalMinAll = getUnifiedStatsList().reduce((a,b)=>a+(b.dur||0), 0);
    return totalMinAll >= tree.req.val;
  }
  return true;
}

function renderTreeSelectGrid(){
  const container = document.getElementById('tree-select-container');
  if(!container) return;

  let unlockedCount = 0;
  let html = '';

  TREE_DEFS.forEach(tree => {
    const unlocked = isTreeUnlocked(tree);
    if(unlocked) unlockedCount++;
    const isSelected = selectedTreeEmoji === tree.emoji;

    html += `
      <div class="tree-opt ${isSelected ? 'active' : ''} ${!unlocked ? 'locked' : ''}"
           onclick="handleTreeOptionClick('${tree.emoji}','${tree.name}')"
           title="${unlocked ? tree.name : 'Kilitli: ' + tree.req.label}">
        ${!unlocked ? `<span class="lock-badge">🔒</span>` : ''}
        <span class="t-ico">${tree.emoji}</span>
        <span class="t-name">${tree.name}</span>
        ${tree.req ? `<span class="t-req-lbl">${tree.req.label}</span>` : ''}
      </div>`;
  });

  container.innerHTML = html;
  const summaryEl = document.getElementById('tree-unlock-summary');
  if(summaryEl) summaryEl.textContent = `${TREE_DEFS.length} Türden ${unlockedCount}'i Açık`;
}

function handleTreeOptionClick(emoji, name){
  const tree = TREE_DEFS.find(t => t.emoji === emoji);
  if(!tree) return;
  
  if(!isTreeUnlocked(tree)){
    if(tree.req.type === 'streak'){
      alert(`🔒 ${tree.name} (${tree.emoji}) henüz kilitli!\nKilidi açmak için en az ${tree.req.val} günlük kesintisiz odak serisi yapmalısın. (Şu anki serin: ${streakDays} gün)`);
    } else {
      const currentHours = (getUnifiedStatsList().reduce((a,b)=>a+(b.dur||0), 0) / 60).toFixed(1);
      const reqHours = Math.round(tree.req.val / 60);
      alert(`🔒 ${tree.name} (${tree.emoji}) henüz kilitli!\nKilidi açmak için toplam en az ${reqHours} saat odaklanmalısın. (Şu an: ${currentHours} saat)`);
    }
    return;
  }

  selectTreeType(emoji, name);
  renderTreeSelectGrid();
}
