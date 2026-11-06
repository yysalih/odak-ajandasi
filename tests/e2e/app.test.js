// Uçtan uca testler: gerçek Chromium + yerel statik sunucu + yerel MQTT broker.
// Çalıştırma: npm run test:e2e   (internet gerekmez)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { chromium } = require('playwright');
const { startStaticServer } = require('../helpers/static-server.js');
const { startLocalBroker } = require('../helpers/local-broker.js');

let server, broker, browser, base;

async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    // Bazı ortamlarda tarayıcı önceden kurulu ve sabit yoldadır
    if (process.env.CHROMIUM_PATH || fs.existsSync('/opt/pw-browsers/chromium')) {
      return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
    }
    throw new Error('Chromium bulunamadı. Bir kez şunu çalıştırın: npx playwright install chromium');
  }
}

test.before(async () => {
  server = await startStaticServer(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  broker = await startLocalBroker();
  browser = await launch();
});

test.after(async () => {
  await browser?.close();
  await broker?.close();
  server?.close();
});

async function openApp({ useClock = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Dış ağa çıkma: yalnızca yerel broker kullanılır
  await page.addInitScript((port) => {
    window.__ODAK_BROKERS__ = [{ id: 'local', host: '127.0.0.1', port, path: '/mqtt', ssl: false }];
  }, broker.port);
  if (useClock) await page.clock.install({ time: new Date('2026-11-06T10:00:00') });
  await page.goto(base);
  await page.waitForFunction(() => typeof renderMain === 'function' && document.getElementById('s-tree'));
  page.errors = errors;
  return { context, page };
}

async function addTask(page, title, dur) {
  await page.evaluate(() => goTo('pg-add'));
  await page.fill('#add-title', title);
  await page.fill('#add-dur', String(dur));
  await page.evaluate(() => saveTask());
}

const mainStats = page => page.evaluate(() => ({
  trees: document.getElementById('s-tree').textContent,
  mins: document.getElementById('s-focus-min').textContent,
  goal: document.getElementById('goal-ring-text').textContent,
  unlocked: TREE_DEFS.filter(isTreeUnlocked).map(t => t.name)
}));

test('hocanın senaryosu: 25 dk görev eklemek ağaç, dakika veya hedef üretmez', async () => {
  const { context, page } = await openApp();
  await addTask(page, 'Matematik', 25);
  const s = await mainStats(page);
  assert.deepEqual([s.trees, s.mins, s.goal], ['0', '0', '0%']);
  // Uzun görevler eklemek de kilit açmaz
  for (let i = 0; i < 6; i++) await addTask(page, 'Uzun ' + i, 180);
  assert.deepEqual((await mainStats(page)).unlocked, ['Meşe', 'Ulu Çam', 'Bonsai', 'Elma']);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('seans tamamlanınca sayılır, pes edilince dakika eklenmez', async () => {
  const { context, page } = await openApp({ useClock: true });
  await addTask(page, 'Kısa seans', 1);
  const id = await page.evaluate(() => tasks[0].id);
  await page.evaluate((id) => { openFocus(id); startFocus(); }, id);
  await page.clock.runFor(65_000);
  let s = await mainStats(page);
  assert.deepEqual([s.trees, s.mins], ['1', '1']);

  await addTask(page, 'Yarım kalan', 1);
  const id2 = await page.evaluate(() => tasks[1].id);
  await page.evaluate((id) => { exitFocus(); openFocus(id); startFocus(); }, id2);
  await page.clock.runFor(30_000);
  await page.evaluate(() => confirmGiveUp());
  s = await mainStats(page);
  assert.equal(s.mins, '0', 'pes edilen seans ve kurutulan ağaç sayılmamalı');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('XSS: görev başlığındaki HTML çalışmaz, düz metin görünür', async () => {
  const { context, page } = await openApp();
  const evil = '<img src=x onerror="window.__xss=1">';
  await addTask(page, evil, 25);
  await page.evaluate(() => { renderMain(); renderStats(); renderForest(); });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('.task-title-line').first().textContent(), evil);
  await context.close();
});

test('yedek içe aktarma: sahte yüksek istatistikler kabul edilmez', async () => {
  const { context, page } = await openApp();
  const today = await page.evaluate(() => toDateKey(new Date()));
  const fake = {
    focusHistory: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, title: 'Sahte', dur: 99999, rawDate: today })),
    streakDays: 999
  };
  page.on('dialog', d => d.dismiss());
  // Dosya seçme olayını taklit et (importDataBackup gerçek FileReader ile okur)
  await page.evaluate((json) => importDataBackup({ target: { files: [new File([json], 'yedek.json')], value: '' } }), JSON.stringify(fake));
  await page.waitForTimeout(300);
  const s = await mainStats(page);
  assert.equal(s.mins, '0');
  assert.equal(await page.evaluate(() => calculateStreakDays()), 0);
  await context.close();
});

test('istatistik tarih aralığı filtresi seçilen günleri gösterir', async () => {
  const { context, page } = await openApp();
  await page.evaluate(() => {
    const k = d => OdakCore.addDays(toDateKey(new Date()), d);
    focusHistory.push(
      { id: 1700000000001, title: 'Eski', dur: 30, rawDate: k(-10), treeType: '🌳' },
      { id: 1700000000002, title: 'Yakın', dur: 40, rawDate: k(-2), treeType: '🌳' },
      { id: 1700000000003, title: 'Bugün', dur: 50, rawDate: k(0), treeType: '🌳' }
    );
    goTo('pg-stats');
    document.getElementById('stats-range-from').value = k(-3);
    document.getElementById('stats-range-to').value = k(-1);
    applyStatsDateRange();
  });
  const titles = await page.locator('#history-list .stat-session-title').allTextContents();
  assert.deepEqual(titles, ['Yakın']);
  assert.match(await page.locator('#stats-boxes').textContent(), /40 dk/);
  await context.close();
});

test('arkadaş ekleme: istek -> onay -> iki tarafta liste; broker düz metin görmez', async () => {
  const a = await openApp();
  const b = await openApp();
  for (const [p, name] of [[a.page, 'Ayşe Test'], [b.page, '<img src=x onerror="window.__xss=1">']]) {
    await p.evaluate((n) => { userProfile.name = n; saveUserProfileToStorage(); }, name);
    await p.waitForFunction(() => friendNet && friendTransport && friendTransport.connectedCount() > 0, null, { timeout: 10000 });
  }
  const codeA = await a.page.evaluate(() => getMyFriendCode());
  assert.match(codeA, /^ODAK-/);

  // B, A'nın kodunu girer
  await b.page.evaluate((c) => { goTo('pg-friends'); openAddFriendModal(c); }, codeA);
  await b.page.evaluate(() => addNewFriend());

  // A isteği görür ve onaylar (onaysız eklenmez)
  await a.page.waitForFunction(() => friendNet.getState().incoming.length === 1, null, { timeout: 10000 });
  assert.equal(await a.page.evaluate(() => friendNet.getState().friends.length), 0);
  await a.page.evaluate(() => { goTo('pg-friends'); renderFriendsLeaderboard(); });
  await a.page.locator('#friends-requests-wrap button', { hasText: 'Kabul' }).click();

  await a.page.waitForFunction(() => friendNet.getState().friends.length === 1, null, { timeout: 10000 });
  await b.page.waitForFunction(() => friendNet.getState().friends.length === 1, null, { timeout: 10000 });
  // Profiller aktı mı?
  await b.page.waitForFunction(() => friendNet.getState().friends[0].name === 'Ayşe Test', null, { timeout: 10000 });
  await a.page.waitForFunction(() => /img src/.test(friendNet.getState().friends[0].name), null, { timeout: 10000 });
  await a.page.evaluate(() => { goTo('pg-friends'); renderFriendsLeaderboard(); });
  assert.equal(await a.page.evaluate(() => window.__xss), undefined, 'arkadaş adındaki HTML çalıştı');
  assert.ok((await a.page.locator('#friends-leaderboard-wrap').textContent()).includes('<img src=x'));

  // Broker'dan geçen hiçbir pakette isim düz metin değil
  const all = JSON.stringify(broker.published);
  assert.ok(broker.published.length > 0);
  assert.ok(!all.includes('Ayşe Test'));
  assert.ok(!all.includes('onerror'));
  assert.deepEqual(a.page.errors, []);
  assert.deepEqual(b.page.errors, []);
  await a.context.close();
  await b.context.close();
});
