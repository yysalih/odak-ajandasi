// Çalıştırma: npm test   (veya: node --test tests/unit)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/core.js');

const TODAY = '2026-11-06';
const TREES = [
  { emoji: '🌳', name: 'Meşe', req: null },
  { emoji: '🌸', name: 'Sakura', req: { type: 'streak', val: 3 } },
  { emoji: '🫒', name: 'Kadim Zeytin', req: { type: 'totalMin', val: 600 } }
];

const plannedTask = (over = {}) => ({ id: 1, title: 'Tez', dur: 25, date: TODAY, done: false, tree: false, ...over });
const session = (over = {}) => ({ id: Date.now() + Math.random(), taskId: 1, title: 'Tez', dur: 25, rawDate: TODAY, treeType: '🌳', ...over });

test('hocanın senaryosu: sadece görev eklemek ağaç/dakika/hedef üretmez', () => {
  const list = C.buildSessionList([plannedTask()], [], { todayKey: TODAY });
  assert.equal(list.length, 0);
  assert.equal(C.sumMinutes(C.successful(list)), 0);
});

test('uzun görevler çalışılmadan ağaç kilidi açamaz', () => {
  const tasks = Array.from({ length: 10 }, (_, i) => plannedTask({ id: i + 1, dur: 180 }));
  const list = C.buildSessionList(tasks, [], { todayKey: TODAY });
  assert.equal(C.isTreeUnlocked(TREES[2], list, TODAY), false);
  assert.equal(C.isTreeUnlocked(TREES[1], list, TODAY), false);
  assert.equal(C.isTreeUnlocked(TREES[0], list, TODAY), true);
});

test('tamamlanan seans sayılır, görev+geçmiş çift sayılmaz', () => {
  const tasks = [plannedTask({ done: true, tree: true })];
  const history = [session()];
  const list = C.buildSessionList(tasks, history, { todayKey: TODAY });
  assert.equal(list.length, 1);
  assert.equal(C.sumMinutes(C.successful(list)), 25);
});

test('eski sürüm verisi: geçmişi olmayan tamamlanmış görev yine sayılır', () => {
  const list = C.buildSessionList([plannedTask({ done: true, tree: true })], [], { todayKey: TODAY });
  assert.equal(list.length, 1);
  assert.equal(list[0].isTask, true);
});

test('pes edilen seanslar dakikaya, seriye ve kilide eklenmez', () => {
  const history = [
    session({ rawDate: TODAY, failed: true, treeType: '🥀', dur: 180 }),
    session({ rawDate: C.addDays(TODAY, -1), failed: true, treeType: '🥀', dur: 180 }),
    session({ rawDate: C.addDays(TODAY, -2), failed: true, treeType: '🥀', dur: 180 }),
    session({ rawDate: C.addDays(TODAY, -3), failed: true, treeType: '🥀', dur: 180 })
  ];
  const list = C.buildSessionList([], history, { todayKey: TODAY });
  assert.equal(C.sumMinutes(C.successful(list)), 0);
  assert.equal(C.calculateStreak(list, TODAY), 0);
  assert.equal(C.isTreeUnlocked(TREES[1], list, TODAY), false);
  assert.equal(C.isTreeUnlocked(TREES[2], list, TODAY), false);
});

test('seri: bugün yoksa dünden geriye sayar, boşlukta durur', () => {
  const h = [
    session({ rawDate: C.addDays(TODAY, -1) }),
    session({ rawDate: C.addDays(TODAY, -2) }),
    session({ rawDate: C.addDays(TODAY, -4) })
  ];
  const list = C.buildSessionList([], h, { todayKey: TODAY });
  assert.equal(C.calculateStreak(list, TODAY), 2);
  const list2 = C.buildSessionList([], [...h, session({ rawDate: TODAY })], { todayKey: TODAY });
  assert.equal(C.calculateStreak(list2, TODAY), 3);
  assert.equal(C.isTreeUnlocked(TREES[1], list2, TODAY), true);
});

test('haftalık dakika son 7 günü (bugün dahil) sayar', () => {
  const h = [session({ rawDate: TODAY, dur: 30 }), session({ rawDate: C.addDays(TODAY, -6), dur: 20 }), session({ rawDate: C.addDays(TODAY, -7), dur: 100 })];
  assert.equal(C.weeklyMinutes(C.buildSessionList([], h, { todayKey: TODAY }), TODAY), 50);
});

test('tarih aralığı filtresi uçları dahil eder', () => {
  const h = ['2026-11-01', '2026-11-03', '2026-11-05'].map(d => session({ rawDate: d }));
  const list = C.buildSessionList([], h, { todayKey: TODAY });
  assert.deepEqual(C.inRange(list, '2026-11-01', '2026-11-03').map(s => s.rawDate), ['2026-11-01', '2026-11-03']);
  assert.equal(C.inRange(list, '2026-11-04', '').length, 1);
});

test('escapeHtml tüm tehlikeli karakterleri kaçışlar', () => {
  const evil = `<img src=x onerror="alert('x')">\`&`;
  const out = C.escapeHtml(evil);
  assert.ok(!/[<>"'`]/.test(out));
  assert.equal(out, '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&#96;&amp;');
  assert.equal(C.escapeHtml(null), '');
});

test('normalizeAvatar sadece emoji veya base64 data:image kabul eder', () => {
  assert.equal(C.normalizeAvatar('🦊'), '🦊');
  assert.equal(C.normalizeAvatar('x" onerror="alert(1)'), '👤');
  assert.equal(C.normalizeAvatar('javascript:alert(1)'), '👤');
  assert.equal(C.normalizeAvatar('https://evil.example/track.png'), '👤');
  assert.equal(C.normalizeAvatar('data:image/svg+xml;base64,PHN2Zz4='), '👤');
  assert.equal(C.normalizeAvatar('data:image/png;base64,iVBORw0KGgo="><script>'), '👤');
  assert.equal(C.normalizeAvatar('data:image/jpeg;base64,' + 'A'.repeat(70000)), '👤');
  const ok = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  assert.equal(C.normalizeAvatar(ok), ok);
});

test('yedek içe aktarma: sahte ve aşırı kayıtlar atılır', () => {
  const raw = {
    tasks: [plannedTask(), { id: 'abc', title: '' }, plannedTask({ id: 2, date: '2026-02-31' })],
    focusHistory: [
      session({ id: 1 }),                                  // geçerli
      session({ id: 2, dur: 99999 }),                      // aşırı süre
      session({ id: 3, rawDate: '2099-01-01' }),           // gelecek tarih
      session({ id: 4, rawDate: 'not-a-date' }),           // bozuk tarih
      ...Array.from({ length: 10 }, (_, i) => session({ id: 100 + i, rawDate: '2026-11-01', dur: 180 })) // 1800 dk > 1440
    ],
    streakDays: 9999,
    friendsList: [{ name: '<script>', weeklyMinutes: 1e9 }],
    dailyGoalMinutes: -5
  };
  const { data, report } = C.sanitizeBackup(raw, TODAY);
  assert.equal(data.tasks.length, 1);
  assert.equal(report.tasksDropped, 2);
  assert.equal(data.focusHistory.filter(h => h.rawDate === TODAY).length, 1);
  assert.equal(C.sumMinutes(data.focusHistory.filter(h => h.rawDate === '2026-11-01')), 1440);
  assert.equal(report.historyDropped, 3 + 2);
  assert.equal('streakDays' in data, false);
  assert.equal('friendsList' in data, false);
  assert.equal(data.dailyGoalMinutes, 15);
});

test('yedek içe aktarma: nesne olmayan dosya reddedilir', () => {
  assert.throws(() => C.sanitizeBackup([]), /JSON nesnesi/);
  assert.throws(() => C.sanitizeBackup({ tasks: 'x' }), /tasks/);
});

test('cleanText kontrol karakterlerini ve yön değiştirme karakterlerini atar', () => {
  assert.equal(C.cleanText('a\u0000b‮c  d', 10), 'abc d');
  assert.equal(C.cleanText('🌳'.repeat(50), 3), '🌳🌳🌳');
});
