/*
 * core.js — DOM'a dokunmayan saf yardımcı fonksiyonlar.
 *
 * Bu dosyadaki her şey hem tarayıcıda (window.OdakCore) hem de Node'da
 * (require('./js/core.js')) çalışır. Böylece istatistik hesabı, girdi
 * doğrulama ve HTML kaçışı birim testleriyle kontrol edilebilir.
 * Testler: tests/unit/core.test.js
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OdakCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- HTML kaçışı ---------- */

  // innerHTML içine giren her kullanıcı/uzak veri bu fonksiyondan geçmeli.
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  // Görünmez kontrol karakterlerini atar, boşlukları sadeleştirir, uzunluğu sınırlar.
  function cleanText(value, maxLen) {
    if (typeof value !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    const s = value.replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(s).slice(0, maxLen).join('');
  }

  /* ---------- Avatar ---------- */

  const MAX_AVATAR_DATA_URL = 60000; // ~45 KB görsel; uygulama 128x128 JPEG üretir (~5-10 KB)
  const DATA_IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

  // Avatar ya kısa bir emoji/metin ya da base64 data:image URL olabilir.
  // http(s), javascript:, blob: vb. kabul edilmez (izleme pikseli / XSS riski).
  function normalizeAvatar(av) {
    if (typeof av !== 'string' || !av) return '👤';
    if (av.startsWith('data:')) {
      return (av.length <= MAX_AVATAR_DATA_URL && DATA_IMG_RE.test(av)) ? av : '👤';
    }
    const t = cleanText(av, 4);
    if (!t || /[<>&"'`=\\/]/.test(t) || /[A-Za-z0-9]/.test(t)) return '👤';
    return t;
  }

  function isImageAvatar(av) {
    return typeof av === 'string' && av.startsWith('data:image/');
  }

  /* ---------- Tarih ---------- */

  function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isValidDateKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function dateKeyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = dateKeyToDate(key);
    d.setDate(d.getDate() + n);
    return toDateKey(d);
  }

  function formatKeyTR(key) {
    if (!isValidDateKey(key)) return '';
    return dateKeyToDate(key).toLocaleDateString('tr-TR');
  }

  /* ---------- Oturum listesi ve istatistik ---------- */

  const MAX_SESSION_MIN = 180;      // tek seans en fazla 3 saat (görev ekranındaki sınır)
  const MAX_DAY_MIN = 24 * 60;      // bir günde en fazla 1440 dk odak olabilir

  /*
   * İstatistiklerin TEK kaynağı: gerçekten yaşanmış odak seansları.
   *
   * ESKİ HATA: planlanan her görev (done=false olsa bile) bu listeye
   * "seans" olarak ekleniyordu. Bu yüzden 25 dk'lık bir görev eklemek,
   * seans başlatılmadan 1 ağaç + 25 dk + günlük hedefin %21'i olarak
   * sayılıyor, ağaç kilitleri de çalışmadan açılıyordu.
   *
   * YENİ KURAL:
   *  - focusHistory'deki kayıtlar (tamamlanan ve pes edilen seanslar) sayılır.
   *  - Plan görevleri SAYILMAZ. Tek istisna: eski sürümden kalan, done ve
   *    tree işaretli olup geçmiş kaydı bulunmayan görevler (geriye uyumluluk).
   */
  function buildSessionList(tasks, focusHistory, opts) {
    const isExcluded = (opts && opts.isExcluded) || (() => false);
    const fallbackKey = (opts && opts.todayKey) || toDateKey(new Date());
    const list = [];
    const coveredTaskIds = new Set();

    (Array.isArray(focusHistory) ? focusHistory : []).forEach(h => {
      if (!h || typeof h !== 'object' || isExcluded(h)) return;
      const rawDate = isValidDateKey(h.rawDate) ? h.rawDate : fallbackKey;
      const failed = !!h.failed || h.treeType === '🥀';
      if (h.taskId !== undefined && h.taskId !== null && !failed) coveredTaskIds.add(String(h.taskId));
      list.push({
        id: h.id,
        taskId: h.taskId ?? null,
        title: typeof h.title === 'string' && h.title ? h.title : 'Odak Seansı',
        cat: h.cat || 'Genel',
        treeType: h.treeType || '🌳',
        treeName: h.treeName || 'Meşe',
        dur: clampInt(h.dur, 0, MAX_SESSION_MIN, 0),
        time: h.time || '',
        date: h.date || formatKeyTR(rawDate),
        rawDate,
        done: !failed,
        failed,
        isTask: false
      });
    });

    (Array.isArray(tasks) ? tasks : []).forEach(t => {
      if (!t || typeof t !== 'object' || isExcluded(t)) return;
      if (!(t.done && t.tree) || t.failed) return;           // sadece tamamlanmış (eski veri)
      if (coveredTaskIds.has(String(t.id))) return;           // zaten geçmişte kayıtlı
      const rawDate = isValidDateKey(t.date) ? t.date : fallbackKey;
      list.push({
        id: t.id,
        taskId: t.id,
        title: t.title || 'Odak Seansı',
        cat: t.cat || 'Genel',
        treeType: t.treeType || '🌳',
        treeName: t.treeName || 'Meşe',
        dur: clampInt(t.dur, 0, MAX_SESSION_MIN, 0),
        time: t.start || '',
        date: formatKeyTR(rawDate),
        rawDate,
        done: true,
        failed: false,
        isTask: true
      });
    });

    return list;
  }

  function successful(list) {
    return list.filter(s => s && !s.failed);
  }

  function sumMinutes(list) {
    return list.reduce((a, s) => a + (Number(s.dur) || 0), 0);
  }

  // [fromKey, toKey] dahil aralık. Biri boşsa o yönde sınırsız.
  function inRange(list, fromKey, toKey) {
    return list.filter(s => (!fromKey || s.rawDate >= fromKey) && (!toKey || s.rawDate <= toKey));
  }

  // Seri: bugün (yoksa dün) geriye doğru, en az bir BAŞARILI seans olan ardışık gün sayısı.
  function calculateStreak(list, todayKey) {
    const days = new Set(successful(list).map(s => s.rawDate));
    let cur = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
    let streak = 0;
    while (days.has(cur)) { streak++; cur = addDays(cur, -1); }
    return streak;
  }

  function isTreeUnlocked(tree, list, todayKey) {
    if (!tree || !tree.req) return true;
    if (tree.req.type === 'streak') return calculateStreak(list, todayKey) >= tree.req.val;
    if (tree.req.type === 'totalMin') return sumMinutes(successful(list)) >= tree.req.val;
    return false; // bilinmeyen koşul: güvenli taraf, kilitli
  }

  // Son 7 gün (bugün dahil) başarılı odak dakikası — arkadaş sıralaması için.
  function weeklyMinutes(list, todayKey) {
    return sumMinutes(successful(inRange(list, addDays(todayKey, -6), todayKey)));
  }

  /* ---------- Sayı yardımcıları ---------- */

  function clampInt(v, min, max, fallback) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function isIntInRange(v, min, max) {
    return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  }

  /* ---------- Yedek (JSON) içe aktarma doğrulaması ---------- */

  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ALLOWED_TREES = ['🌳', '🌲', '🎋', '🍎', '🌸', '🫒', '🌲✨', '🥀'];
  const MAX_ITEMS = 20000;

  function sanitizeTask(t) {
    if (!t || typeof t !== 'object') return null;
    const id = Number(t.id);
    const title = cleanText(t.title, 120);
    if (!Number.isFinite(id) || !title) return null;
    if (t.date !== undefined && !isValidDateKey(t.date)) return null;
    return {
      id,
      title,
      cat: cleanText(t.cat, 40),
      treeType: ALLOWED_TREES.includes(t.treeType) && t.treeType !== '🥀' ? t.treeType : '🌳',
      treeName: cleanText(t.treeName, 40) || 'Meşe',
      start: typeof t.start === 'string' && TIME_RE.test(t.start) ? t.start : '',
      end: typeof t.end === 'string' && TIME_RE.test(t.end) ? t.end : '',
      dur: clampInt(t.dur, 1, MAX_SESSION_MIN, 25),
      tree: !!t.tree,
      done: !!t.done,
      failed: !!t.failed,
      reminded30: !!t.reminded30,
      date: t.date
    };
  }

  function sanitizeHistory(h, todayKey) {
    if (!h || typeof h !== 'object') return null;
    const id = Number(h.id);
    if (!Number.isFinite(id)) return null;
    if (!isValidDateKey(h.rawDate) || h.rawDate > todayKey) return null; // gelecekte seans olamaz
    if (!isIntInRange(Number(h.dur), 1, MAX_SESSION_MIN)) return null;
    const failed = !!h.failed || h.treeType === '🥀';
    return {
      id,
      taskId: h.taskId === null || h.taskId === undefined ? null : Number(h.taskId),
      title: cleanText(h.title, 120) || 'Odak Seansı',
      cat: cleanText(h.cat, 40),
      treeType: failed ? '🥀' : (ALLOWED_TREES.includes(h.treeType) ? h.treeType : '🌳'),
      treeName: cleanText(h.treeName, 40) || (failed ? 'Kurumuş Ağaç' : 'Meşe'),
      dur: Number(h.dur),
      time: typeof h.time === 'string' && /^\d{2}[:.]\d{2}$/.test(h.time) ? h.time : '',
      date: formatKeyTR(h.rawDate),
      rawDate: h.rawDate,
      failed
    };
  }

  /*
   * Kullanıcının yüklediği yedek dosyasını doğrular.
   * Bozuk/aşırı kayıtları atar; günlük toplam 1440 dk'yı aşan seansları reddeder.
   * Dönüş: { data, report: { tasksDropped, historyDropped } }
   * Dosya tamamen anlamsızsa hata fırlatır.
   */
  function sanitizeBackup(raw, todayKey) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Yedek bir JSON nesnesi değil.');
    const today = todayKey || toDateKey(new Date());
    const report = { tasksDropped: 0, historyDropped: 0 };
    const out = {};

    if (raw.tasks !== undefined) {
      if (!Array.isArray(raw.tasks) || raw.tasks.length > MAX_ITEMS) throw new Error('tasks alanı geçersiz.');
      out.tasks = [];
      raw.tasks.forEach(t => { const c = sanitizeTask(t); if (c) out.tasks.push(c); else report.tasksDropped++; });
    }

    if (raw.focusHistory !== undefined) {
      if (!Array.isArray(raw.focusHistory) || raw.focusHistory.length > MAX_ITEMS) throw new Error('focusHistory alanı geçersiz.');
      const perDay = {};
      out.focusHistory = [];
      raw.focusHistory.forEach(h => {
        const c = sanitizeHistory(h, today);
        if (!c) { report.historyDropped++; return; }
        perDay[c.rawDate] = (perDay[c.rawDate] || 0) + c.dur;
        if (perDay[c.rawDate] > MAX_DAY_MIN) { report.historyDropped++; perDay[c.rawDate] -= c.dur; return; }
        out.focusHistory.push(c);
      });
    }

    if (raw.inbox !== undefined) {
      if (!Array.isArray(raw.inbox)) throw new Error('inbox alanı geçersiz.');
      out.inbox = raw.inbox.slice(0, 1000).map((n, i) => {
        const text = cleanText(typeof n === 'string' ? n : n && n.text, 500);
        if (!text) return null;
        const id = n && Number.isFinite(Number(n.id)) ? Number(n.id) : i + 1;
        return { id, text, done: !!(n && n.done), date: n && isValidDateKey(n.date) ? n.date : today };
      }).filter(Boolean);
    }

    if (raw.dailyNotes !== undefined) {
      if (!raw.dailyNotes || typeof raw.dailyNotes !== 'object' || Array.isArray(raw.dailyNotes)) throw new Error('dailyNotes alanı geçersiz.');
      out.dailyNotes = {};
      Object.keys(raw.dailyNotes).slice(0, 5000).forEach(k => {
        if (isValidDateKey(k) && typeof raw.dailyNotes[k] === 'string') out.dailyNotes[k] = cleanText(raw.dailyNotes[k], 1000);
      });
    }

    if (raw.dailyGoalMinutes !== undefined) {
      out.dailyGoalMinutes = clampInt(raw.dailyGoalMinutes, 15, 1440, 120);
    }

    if (raw.userRoutines !== undefined) {
      if (!Array.isArray(raw.userRoutines)) throw new Error('userRoutines alanı geçersiz.');
      out.userRoutines = raw.userRoutines.slice(0, 100).map(r => {
        if (!r || typeof r !== 'object') return null;
        const title = cleanText(r.title, 120);
        if (!title) return null;
        return {
          id: cleanText(String(r.id ?? ''), 40) || 'r_' + Math.random().toString(36).slice(2, 9),
          title,
          cat: cleanText(r.cat, 40) || 'Genel',
          dur: clampInt(r.dur, 1, MAX_SESSION_MIN, 30),
          start: typeof r.start === 'string' && TIME_RE.test(r.start) ? r.start : '08:30',
          end: typeof r.end === 'string' && TIME_RE.test(r.end) ? r.end : '09:00',
          treeType: ALLOWED_TREES.includes(r.treeType) && r.treeType !== '🥀' ? r.treeType : '🌳',
          treeName: cleanText(r.treeName, 40) || 'Meşe'
        };
      }).filter(Boolean);
    }

    // Not: streakDays ve arkadaş listesi yedekten ALINMAZ. Seri her zaman
    // seans geçmişinden yeniden hesaplanır; arkadaşlık anahtarları cihaza özeldir.
    return { data: out, report };
  }

  return {
    escapeHtml, cleanText,
    normalizeAvatar, isImageAvatar,
    toDateKey, isValidDateKey, dateKeyToDate, addDays, formatKeyTR,
    buildSessionList, successful, sumMinutes, inRange, calculateStreak, isTreeUnlocked, weeklyMinutes,
    clampInt, isIntInRange,
    sanitizeBackup, sanitizeTask, sanitizeHistory,
    MAX_SESSION_MIN, MAX_DAY_MIN, ALLOWED_TREES
  };
});
