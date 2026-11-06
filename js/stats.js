/* ══════════════════════════════════════════════════════
   ÇALIŞMA & ODAK TAKVİMİ SİSTEMİ (ÇOKLU AY VE HAFTA SENKRONİZASYONU)
   ══════════════════════════════════════════════════════ */
let calCurrentDate = new Date();
let calSelectedDateKey = toDateKey(new Date());
let isStatsCalendarOpen = false;

function toggleStatsEmbeddedCalendar(){
  isStatsCalendarOpen = !isStatsCalendarOpen;
  const calCard = document.getElementById('stats-embedded-cal-card');
  if(calCard){
    calCard.style.display = isStatsCalendarOpen ? 'block' : 'none';
  }
  updateStatsDateHeader();
  if(isStatsCalendarOpen){
    renderCalendar();
  }
}

function shiftStatsDate(days){
  if(currentStatsScope === 'month'){
    calShiftMonth(days);
    return;
  }
  const parts = calSelectedDateKey.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  d.setDate(d.getDate() + (currentStatsScope === 'week' ? days * 7 : days));
  calSelectedDateKey = toDateKey(d);
  calCurrentDate = new Date(d);
  if(currentStatsScope !== 'week' && currentStatsScope !== 'month'){
    currentStatsScope = 'today';
  }
  renderStats();
}

function updateStatsDateHeader(){
  const todayKey = toDateKey(new Date());
  const titleEl = document.getElementById('stats-date-nav-title');
  const subEl = document.getElementById('stats-date-nav-sub');
  const chevronEl = document.getElementById('stats-date-chevron');
  if(!titleEl || !subEl) return;

  const parts = calSelectedDateKey.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  const formatter = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'short' });
  const formatted = formatter.format(dt);
  const isToday = calSelectedDateKey === todayKey;

  if(currentStatsScope === 'today'){
    titleEl.textContent = isToday ? `Bugün, ${formatted}` : formatted;
    subEl.textContent = isStatsCalendarOpen 
      ? 'Seçili günün analizi · Takvimi kapatmak için dokun ✕' 
      : 'Günün canlı odak karnesi · Takvim için dokun 📅';
  } else if(currentStatsScope === 'week'){
    const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    titleEl.textContent = `Bu Hafta (${monthNames[calCurrentDate.getMonth()]})`;
    subEl.textContent = isStatsCalendarOpen 
      ? 'Haftalık toplam performans · Takvimi kapat ✕' 
      : 'Haftalık odak özeti · Takvim için dokun 📅';
  } else if(currentStatsScope === 'month'){
    const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    titleEl.textContent = `${monthNames[calCurrentDate.getMonth()]} ${calCurrentDate.getFullYear()}`;
    subEl.textContent = isStatsCalendarOpen 
      ? 'Aylık odak dökümü · Takvimi kapat ✕' 
      : 'Aylık toplam çalışma · Takvim için dokun 📅';
  } else {
    titleEl.textContent = 'Tüm Zamanlar';
    subEl.textContent = isStatsCalendarOpen 
      ? 'Genel performans dökümü · Takvimi kapat ✕' 
      : 'Tüm seanslar ve genel analiz · Takvim için dokun 📅';
  }

  if(chevronEl){
    chevronEl.textContent = isStatsCalendarOpen ? '▴' : '▾';
  }
}

function calShiftMonth(delta){
  calCurrentDate.setDate(1);
  calCurrentDate.setMonth(calCurrentDate.getMonth() + delta);
  
  // Eğer Bugün veya Hafta modundaysak, o ayın istatistiğine geç
  if(currentStatsScope !== 'all'){
    currentStatsScope = 'month';
  }
  
  // Seçili tarihi yeni ayın 1'i yap
  const y = calCurrentDate.getFullYear();
  const m = String(calCurrentDate.getMonth() + 1).padStart(2, '0');
  calSelectedDateKey = `${y}-${m}-01`;

  renderStats();
}

function calJumpToday(){
  calCurrentDate = new Date();
  calSelectedDateKey = toDateKey(new Date());
  currentStatsScope = 'today';
  renderStats();
}

function selectCalendarDate(dateKey){
  calSelectedDateKey = dateKey;
  const parts = dateKey.split('-');
  calCurrentDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  currentStatsScope = 'today'; // Tıklanan günün karnesini göster
  renderStats();
}

function renderCalendar(){
  const year = calCurrentDate.getFullYear();
  const month = calCurrentDate.getMonth();
  
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const monthLbl = document.getElementById('cal-month-label');
  if(monthLbl) monthLbl.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1; // Pazartesi = 0
  if(startOffset < 0) startOffset = 6;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(new Date());

  const gridEl = document.getElementById('cal-grid-cells');
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
    const isSelected = dKey === calSelectedDateKey;

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
      <div class="${cls}" onclick="selectCalendarDate('${dKey}')" title="${dKey}: ${dayTasks.length} plan, ${dayMin} dk odak">
        <span class="cal-cell-num">${d}</span>
        ${badgeText ? `<span class="cal-cell-badge">${badgeText}</span>` : ''}
        ${(hasActivity && !badgeText) ? `<span style="font-size:7px;line-height:1;color:var(--accent);margin-top:1px;">•</span>` : ''}
      </div>`;
  }

  gridEl.innerHTML = html;
  renderSelectedDayDetail();
}

function renderSelectedDayDetail(){
  const detailEl = document.getElementById('cal-selected-day-detail');
  if(!detailEl) return;

  const parts = calSelectedDateKey.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  const formattedDate = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'short' }).format(dt);
  const isToday = calSelectedDateKey === toDateKey(new Date());

  const unifiedList = getUnifiedStatsList();
  const daySessions = unifiedList.filter(h => h.rawDate === calSelectedDateKey);
  const totalMin = daySessions.reduce((a,b)=>a+(b.dur||0), 0);
  const treeCount = daySessions.length;
  const dayTasks = (tasks || []).filter(t => !isMockStatsEntry(t) && t.date === calSelectedDateKey);
  const dayNote = dailyNotes[calSelectedDateKey];

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
      <button class="btn-primary" style="padding:7px 12px;font-size:11px;border-radius:8px;" onclick="selectDate('${calSelectedDateKey}');navTo('pg-main','nav-main')">
        📋 Plana Git
      </button>
    </div>
    ${dayNote ? `
      <div style="margin-top:8px;padding:6px 10px;background:var(--surface);border-left:3px solid var(--accent);border-radius:6px;font-size:11px;font-style:italic;color:var(--text1);">
        “${dayNote}”
      </div>` : ''}
    ${daySessions.length ? `
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">
        ${daySessions.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 9px;font-size:11px;">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
              <span>${s.treeType || '🌳'}</span>
              <span style="font-weight:700;color:var(--text1);word-break:break-word;">${s.title}</span>
              ${s.cat ? `<span class="tag" style="padding:0 5px;font-size:9px;">${s.cat}</span>` : ''}
            </div>
            <span style="font-weight:800;color:var(--accent);flex-shrink:0;">${s.dur} dk · ${s.time || ''}</span>
          </div>
        `).join('')}
      </div>` : `
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">
        Bu tarihte kayıtlı odak çalışması yok. 🌱
      </div>
    `}
  `;
}

/* ══════════════════════════════════════════════════════
   HATASIZ ZAMAN HESAPLAMALI VE SIFIR TAŞMALI İSTATİSTİK SİSTEMİ
   ══════════════════════════════════════════════════════ */
let selectedStatsCategory = null;

function toggleCategoryFilter(catName){
  if(selectedStatsCategory === catName){
    selectedStatsCategory = null;
  } else {
    selectedStatsCategory = catName;
  }
  renderStats();
}

function clearCategoryFilter(){
  selectedStatsCategory = null;
  renderStats();
}
let currentStatsScope = 'all';

function setStatsScope(scope){
  currentStatsScope = scope;
  if(scope === 'today'){
    calCurrentDate = new Date();
    calSelectedDateKey = toDateKey(new Date());
  } else if(scope === 'month'){
    // Ay moduna geçildiğinde seçili ayı takvimde göster
    calCurrentDate = new Date();
  } else if(scope === 'week'){
    calCurrentDate = new Date();
  }
  renderStats();
}

function renderStats(){
  const todayKey = toDateKey(new Date());
  
  // 1. Önce Takvimi Çiz ve Tarih Başlığını Güncelle
  renderCalendar();
  updateStatsDateHeader();

  // Aktif filtre butonunu ve buton etiketini tam senkronize et
  const todayKeyStr = toDateKey(new Date());
  const todayBtn = document.getElementById('stf-today');
  if(todayBtn){
    if(currentStatsScope === 'today' && calSelectedDateKey !== todayKeyStr){
      const parts = calSelectedDateKey.split('-');
      const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
      const dayShort = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'short' }).format(dt);
      todayBtn.textContent = dayShort;
    } else {
      todayBtn.textContent = 'Bugün';
    }
  }

  ['all','month','week','today'].forEach(s => {
    const el = document.getElementById('stf-' + s);
    if(el) el.classList.toggle('active', s === currentStatsScope);
  });

  // Takvimde görüntülenen calCurrentDate baz alınarak ay ve hafta hesaplanır
  const viewYear = calCurrentDate.getFullYear();
  const viewMonth = calCurrentDate.getMonth();
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  // Hafta başlangıcı (Pazartesi) ve bitişi (Pazar)
  const refDate = new Date(calCurrentDate);
  const dayOfWeek = refDate.getDay();
  const diffToMon = refDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const mon = new Date(refDate);
  mon.setDate(diffToMon);
  mon.setHours(0,0,0,0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23,59,59,999);
  
  const monKey = toDateKey(mon);
  const sunKey = toDateKey(sun);

  // Kapsam Filtrelemesi: Planlanan Görevler ve Odak Seansları Birleşik İstatistiği
  let scopedHistory = getUnifiedStatsList();
  streakDays = calculateStreakDays();
  let metricLabel = 'Seri';
  let metricVal = `${streakDays} gün`;
  let metricSub = '🔥 kesintisiz';

  if(currentStatsScope === 'today'){
    const activeDayKey = calSelectedDateKey || todayKey;
    scopedHistory = scopedHistory.filter(h => h.rawDate === activeDayKey);
    
    metricLabel = (activeDayKey === todayKey) ? 'Bugün' : 'Seçili Gün';
    metricVal = `${scopedHistory.length} seans`;
    metricSub = `${scopedHistory.reduce((a,b)=>a+(b.dur||0),0)} dk odak`;
  } else if(currentStatsScope === 'week'){
    scopedHistory = scopedHistory.filter(h => h.rawDate >= monKey && h.rawDate <= sunKey);
    const uniqueDays = new Set(scopedHistory.map(h => h.rawDate)).size;
    metricLabel = 'Haftalık';
    metricVal = `${uniqueDays} gün`;
    metricSub = '🌱 aktif gün';
  } else if(currentStatsScope === 'month'){
    scopedHistory = scopedHistory.filter(h => h.rawDate && h.rawDate.startsWith(monthPrefix));
    const uniqueDays = new Set(scopedHistory.map(h => h.rawDate)).size;
    metricLabel = 'Aylık';
    metricVal = `${uniqueDays} gün`;
    metricSub = '🌱 aktif gün';
  } else {
    metricLabel = 'Seri';
    metricVal = `${streakDays} gün`;
    metricSub = '🔥 kesintisiz';
  }

  // 1. Özet İstatistik Kutuları
  const totalMin = scopedHistory.reduce((acc, h) => acc + (h.dur || 0), 0);
  const totalTrees = scopedHistory.filter(h => !h.failed && h.treeType !== '🥀').length;
  const timeFormatted = totalMin >= 120 
    ? `${(totalMin / 60).toFixed(1)} sa` 
    : `${totalMin} dk`;

  const boxesEl = document.getElementById('stats-boxes');
  if(boxesEl){
    boxesEl.innerHTML = `
      <div class="stat-box">
        <span class="slabel">Toplam Odak</span>
        <span class="sval" style="color:var(--accent);">${timeFormatted}</span>
        <span class="ssub">⏱️ ${totalMin} dk</span>
      </div>
      <div class="stat-box">
        <span class="slabel">Ağaç</span>
        <span class="sval">${totalTrees}</span>
        <span class="ssub">🌳 yetişen</span>
      </div>
      <div class="stat-box">
        <span class="slabel">${metricLabel}</span>
        <span class="sval">${metricVal}</span>
        <span class="ssub">${metricSub}</span>
      </div>`;
  }

  // 2. Kategori Bazlı Dağılım Kartı (Tıklanabilir ve İnteraktif)
  const catBarsEl = document.getElementById('stats-cat-bars');
  if(catBarsEl){
    if(!scopedHistory.length){
      catBarsEl.innerHTML = `<div style="font-size:12px;color:var(--text3);text-align:center;padding:14px 0;">Bu dönemde henüz kategori verisi bulunmuyor. 🌱</div>`;
    } else {
      const catMap = {};
      scopedHistory.forEach(h => {
        const c = h.cat || 'Genel';
        if(!catMap[c]) catMap[c] = { dur: 0, count: 0, trees: [] };
        catMap[c].dur += (h.dur || 0);
        if(!h.failed && h.treeType !== '🥀'){
          catMap[c].count += 1;
          if(h.treeType && !catMap[c].trees.includes(h.treeType)) catMap[c].trees.push(h.treeType);
        }
      });

      const catList = Object.keys(catMap).map(name => ({
        name,
        dur: catMap[name].dur,
        count: catMap[name].count,
        trees: catMap[name].trees,
        pct: totalMin > 0 ? Math.round((catMap[name].dur / totalMin) * 100) : 0
      })).sort((a,b) => b.dur - a.dur);

      catBarsEl.innerHTML = catList.map(item => {
        const isSelected = selectedStatsCategory === item.name;
        return `
          <div class="stat-cat-row ${isSelected ? 'active-cat' : ''}" onclick="toggleCategoryFilter('${item.name}')" title="Bu kategoriyi filtrelemek için dokun">
            <div class="stat-cat-header">
              <div class="stat-cat-left">
                <span style="font-size:16px;">${item.trees[0] || '🏷️'}</span>
                <span class="stat-cat-name">${item.name}</span>
                ${isSelected ? '<span style="font-size:10px;background:var(--accent);color:#0E1612;padding:1px 5px;border-radius:4px;font-weight:800;">✓ Aktif</span>' : ''}
              </div>
              <div class="stat-cat-right">
                <span class="stat-cat-dur">${item.dur} dk</span>
                <span class="stat-cat-pct">%${item.pct}</span>
              </div>
            </div>
            <div class="stat-bar-track">
              <div class="stat-bar-fill" style="width:${item.pct}%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);font-weight:600;">
              <span>🌳 ${item.count} ağaç</span>
              <span>${item.trees.slice(0,4).join(' ')}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Eğer bir kategori seçiliyse, seansları ve günleri o kategoriye filtrele
  let displayHistory = [...scopedHistory];
  if(selectedStatsCategory){
    displayHistory = displayHistory.filter(h => (h.cat || 'Genel') === selectedStatsCategory);
  }

  // 3. Günlük Odak Dökümü
  const dailyEl = document.getElementById('stats-daily-breakdown');
  if(dailyEl){
    let filterBannerHtml = '';
    if(selectedStatsCategory){
      filterBannerHtml = `
        <div class="cat-filter-banner" onclick="clearCategoryFilter()" title="Filtreyi kaldırmak için dokun">
          <span>🏷️ "${selectedStatsCategory}" Filtresi (${displayHistory.length} Seans)</span>
          <span>✕ Kaldır</span>
        </div>`;
    }

    if(!displayHistory.length){
      dailyEl.innerHTML = filterBannerHtml + `<div style="font-size:12px;color:var(--text3);text-align:center;padding:14px 0;">Bu aralıkta kayıtlı gün bulunamadı. 🌱</div>`;
    } else {
      const dayMap = {};
      displayHistory.forEach(h => {
        const raw = h.rawDate || todayKey;
        if(!dayMap[raw]){
          dayMap[raw] = {
            rawDate: raw,
            dateLabel: h.date || raw,
            totalMin: 0,
            trees: [],
            count: 0
          };
        }
        dayMap[raw].totalMin += (h.dur || 0);
        dayMap[raw].count += 1;
        if(h.treeType) dayMap[raw].trees.push(h.treeType);
      });

      const dayList = Object.values(dayMap).sort((a,b) => b.rawDate.localeCompare(a.rawDate));

      dailyEl.innerHTML = filterBannerHtml + dayList.map(d => {
        let titleLabel = d.dateLabel;
        if(d.rawDate === todayKey){
          titleLabel = `Bugün (${d.dateLabel})`;
        } else {
          try {
            const parts = d.rawDate.split('-');
            const dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            titleLabel = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'long', weekday:'short' }).format(dt);
          } catch(e){}
        }

        const treeIcons = d.trees.slice(0, 5).join(' ') + (d.trees.length > 5 ? ` +${d.trees.length - 5}` : '');

        return `
          <div class="stat-day-card-row" onclick="selectCalendarDate('${d.rawDate}')" title="Takvimde detayını incelemek için dokun">
            <div class="stat-day-left-col">
              <div class="stat-day-title-txt">${titleLabel}</div>
              <div class="stat-day-sub-txt">
                <span>🌳 ${d.count} ağaç</span>
                <span style="opacity:0.4;">·</span>
                <span>${treeIcons}</span>
              </div>
            </div>
            <div class="stat-day-right-col">
              <div class="stat-day-min-badge">${d.totalMin} dk</div>
              <div style="font-size:10px;color:var(--text3);font-weight:600;">odak</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Tüm Seanslar Geçmişi Listesi (Tıklayınca Detay Modalı Açar)
  const hl = document.getElementById('history-list');
  if(hl){
    if(!displayHistory.length){
      hl.innerHTML = `<div class="empty"><div class="ei">📭</div><p>Bu aralıkta kayıtlı plan veya odak bulunmuyor.</p></div>`;
    } else {
      hl.innerHTML = [...displayHistory].reverse().map(h => `
        <div class="stat-session-card-row" onclick="showTreeDetail('${h.id}')" title="Plan ve odak detayını görmek için dokun">
          <div class="stat-session-tree" style="font-size:26px;">${h.treeType || '🌳'}</div>
          <div class="stat-session-col">
            <div class="stat-session-top">
              <span class="stat-session-title">${h.title}</span>
              <span class="stat-session-dur">${h.dur} dk</span>
            </div>
            <div class="stat-session-bot">
              <span class="stat-session-cat">🏷️ ${h.cat || 'Genel'} · ${h.treeName || 'Ağaç'}</span>
              <span>${h.time || ''} · ${h.date || ''}</span>
            </div>
          </div>
        </div>`).join('');
    }
  }
}
