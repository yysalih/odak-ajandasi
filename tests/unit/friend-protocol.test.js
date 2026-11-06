// Arkadaşlık protokolü testleri: iki gerçek istemci + "odak/#" dinleyen saldırgan.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../js/friend-protocol.js');
const { FakeBroker, memoryStorage } = require('../helpers/fake-broker.js');

let clock = Date.parse('2026-11-06T10:00:00Z');
const now = () => clock;

async function makeUser(broker, name, events = []) {
  let net;
  const transport = broker.connect((t, p) => net.handleMessage(t, p));
  net = new P.FriendNetwork({ storage: memoryStorage(), transport, now, onEvent: (type, d) => events.push({ type, d }) });
  await net.init();
  net.events = events;
  net.transport = transport;
  net.intro = { name, avatar: '🦊' };
  return net;
}

const profile = (over = {}) => ({ name: 'Ayşe', avatar: '🦊', weeklyMinutes: 120, trees: 4, status: 'idle', currentTask: '', ...over });

async function pairUp(broker) {
  const a = await makeUser(broker, 'Ayşe');
  const b = await makeUser(broker, 'Bora');
  await a.onConnected(); await b.onConnected();
  await broker.settle();
  assert.equal((await b.addFriendByCode(a.inviteCode, b.intro)).status, 'sent');
  await broker.settle();
  assert.equal(a.getState().incoming.length, 1, 'A isteği görmeli');
  assert.equal(a.getState().friends.length, 0, 'onaysız arkadaş eklenmemeli');
  await a.acceptRequest(a.getState().incoming[0].fp, a.intro);
  await broker.settle();
  return { a, b };
}

test('davet kodu: 26 karakter, yazım hatası yakalanır, karışan harfler tolere edilir', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'A');
  assert.match(a.inviteCode, /^ODAK-([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
  assert.ok(await P.parseInviteCode(a.inviteCode));
  assert.ok(await P.parseInviteCode(a.inviteCode.toLowerCase().replace(/-/g, ' ')));
  assert.ok(await P.parseInviteCode('https://site/?davet=' + a.inviteCode));
  // tek karakter değiştir -> sağlama tutmaz
  const raw = a.inviteCode.replace(/-/g, '').slice(4);
  const flipped = raw.slice(0, 5) + (raw[5] === 'A' ? 'B' : 'A') + raw.slice(6);
  assert.equal(await P.parseInviteCode('ODAK' + flipped), null);
  assert.equal(await P.parseInviteCode('ODAK-1234'), null);
});

test('arkadaşlık: istek -> onay -> iki tarafta da arkadaş, profiller şifreli akar', async () => {
  const broker = new FakeBroker();
  const { a, b } = await pairUp(broker);
  assert.equal(a.getState().friends.length, 1);
  assert.equal(b.getState().friends.length, 1);
  assert.equal(b.getState().outgoing.length, 0);

  await a.publishProfile(profile({ name: 'Ayşe', weeklyMinutes: 95 }));
  await broker.settle();
  const fa = b.getState().friends[0];
  assert.equal(fa.name, 'Ayşe');
  assert.equal(fa.weeklyMinutes, 95);

  // Broker'da hiçbir pakette isim/süre düz metin olarak yok
  for (const m of broker.log) {
    assert.ok(!m.payload.includes('Ayşe') && !m.payload.includes('Bora'), 'düz metin isim sızdı: ' + m.topic);
    assert.ok(!/weeklyMinutes/.test(m.payload));
    assert.ok(!m.topic.includes(a.inviteCode.replace(/-/g, '')));
  }
});

test('karşı taraf çevrimdışıyken eklenince istek bekler ve sonra ulaşır', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  await a.onConnected(); await broker.settle();
  // A çevrimdışı olsun: abonelikleri kaldır
  a.transport.subs.clear();
  const b = await makeUser(broker, 'Bora');
  await b.onConnected();
  await b.addFriendByCode(a.inviteCode, b.intro);
  await broker.settle();
  assert.equal(a.getState().incoming.length, 0);
  // A tekrar bağlanır -> retained istek gelir
  await a.onConnected(); await broker.settle();
  assert.equal(a.getState().incoming.length, 1);
  assert.equal(a.getState().incoming[0].name, 'Bora');
});

test('B bağlanmadan önce kod girse bile (eski hata) istek sonradan gönderilir', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  await a.onConnected(); await broker.settle();
  const b = await makeUser(broker, 'Bora');
  b.transport.subscribe = () => {}; b.transport.publish = () => {}; // bağlantı yok
  await b.addFriendByCode(a.inviteCode, b.intro);
  assert.equal(b.getState().outgoing.length, 1);
  // bağlantı geldi
  const real = broker.connect((t, p) => b.handleMessage(t, p));
  b.transport = real;
  await b.onConnected(); await broker.settle();
  assert.equal(a.getState().incoming.length, 1);
});

test('ikisi de birbirini eklerse otomatik eşleşir', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  const b = await makeUser(broker, 'Bora');
  await a.onConnected(); await b.onConnected(); await broker.settle();
  await a.addFriendByCode(b.inviteCode, a.intro);
  await b.addFriendByCode(a.inviteCode, b.intro);
  await broker.settle();
  assert.equal(a.getState().friends.length, 1);
  assert.equal(b.getState().friends.length, 1);
});

test('ret: isteği gönderen taraf bilgilendirilir, arkadaş eklenmez', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  const b = await makeUser(broker, 'Bora');
  await a.onConnected(); await b.onConnected(); await broker.settle();
  await b.addFriendByCode(a.inviteCode, b.intro); await broker.settle();
  await a.rejectRequest(a.getState().incoming[0].fp); await broker.settle();
  assert.equal(a.getState().friends.length, 0);
  assert.equal(b.getState().friends.length, 0);
  assert.equal(b.getState().outgoing.length, 0);
  assert.ok(b.events.some(e => e.type === 'request-rejected'));
});

test('SALDIRI: "odak/#" dinleyen biri içerik okuyamaz, kodları elde edemez', async () => {
  const broker = new FakeBroker();
  const seen = [];
  const spy = broker.connect((t, p) => seen.push({ t, p }));
  spy.subscribe('odak/#');
  const { a } = await pairUp(broker);
  await a.publishProfile(profile({ name: 'Ayşe', currentTask: 'Gizli tez konusu' }));
  await broker.settle();
  assert.ok(seen.length > 0);
  const all = JSON.stringify(seen);
  assert.ok(!all.includes('Gizli tez'));
  assert.ok(!all.includes('Ayşe'));
  assert.ok(!all.includes('Bora'));
});

test('SALDIRI: konu adını bilen ama davet kodunu bilmeyen biri istek gönderemez', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  await a.onConnected(); await broker.settle();
  const mallory = await makeUser(broker, 'Mallory');
  // Mallory, A'nın gelen kutusu konusunu (trafikten) biliyor ama A'nın parmak izini bilmiyor:
  // anahtarı yanlış tuzla türetir.
  const I = P._internal;
  const myPub = I.unb64u(mallory.state.identity.pub);
  const aPub = I.unb64u(a.state.identity.pub);
  const priv = await crypto.subtle.importKey('jwk', mallory.state.identity.privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const shared = await I.ecdh(priv, aPub);
  const wrongKey = await I.hkdfKey(shared, new Uint8Array(15), 'odak-v2-req');
  const topic = await P.inboxSlot(a.myFp, await P.fingerprintOf(myPub));
  const body = await I.seal(wrongKey, { name: 'Spam', avatar: '👤', ts: clock }, `req|${topic}`);
  mallory.transport.publish(topic, JSON.stringify({ v: 2, k: 'req', from: I.b64u(myPub), ...body }), true);
  await broker.settle();
  assert.equal(a.getState().incoming.length, 0);
});

test('SALDIRI: sahte profil / aşırı istatistik / tekrar oynatma reddedilir', async () => {
  const broker = new FakeBroker();
  const { a, b } = await pairUp(broker);
  const fb = a.getState().friends[0];
  const p = await b._pair(b.state.friends[fb.fp === b.myFpHex ? a.myFpHex : Object.keys(b.state.friends)[0]]);
  const send = async (obj) => {
    const body = await P._internal.seal(p.key, obj, p.mine);
    return a.handleMessage(p.mine, JSON.stringify({ v: 2, ...body }));
  };
  // Çok yüksek istatistik
  assert.equal(await send({ t: 'profile', ...profile({ weeklyMinutes: 999999 }), ts: clock }), 'rejected');
  assert.equal(await send({ t: 'profile', ...profile({ trees: -1 }), ts: clock }), 'rejected');
  assert.equal(await send({ t: 'profile', ...profile({ weeklyMinutes: 12.5 }), ts: clock }), 'rejected');
  assert.equal(await send({ t: 'profile', ...profile({ status: 'hacker' }), ts: clock }), 'rejected');
  // HTML içeren isim/avatar temizlenir ama kabul edilir (render kaçışlı)
  assert.equal(await send({ t: 'profile', ...profile({ name: '<img src=x onerror=alert(1)>', avatar: 'javascript:alert(1)' }), ts: clock + 1 }), 'profile-updated');
  assert.equal(a.state.friends[fb.fp].avatar, '👤');
  // Tekrar oynatma (aynı ts) reddedilir
  assert.equal(await send({ t: 'profile', ...profile(), ts: clock + 1 }), 'stale');
  // Kendi kanalıma (yanlış konu/AAD) taşınmış mesaj açılamaz
  const body = await P._internal.seal(p.key, { t: 'profile', ...profile(), ts: clock + 5 }, p.mine);
  assert.equal(await a.handleMessage(p.theirs, JSON.stringify({ v: 2, ...body })), 'ignored');
  // Bozuk/rastgele paket
  assert.equal(await a.handleMessage(p.mine, JSON.stringify({ v: 2, iv: 'AAAA', ct: 'BBBB' })), 'rejected');
  assert.equal(await a.handleMessage(p.mine, 'not json'), 'rejected');
  assert.equal(await a.handleMessage(p.mine, 'x'.repeat(200 * 1024)), 'ignored');
});

test('SALDIRI: sahte anahtar (parmak izi tutmayan) kabul edilmez', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  const b = await makeUser(broker, 'Bora');
  const mallory = await makeUser(broker, 'Mallory');
  await b.onConnected(); // A çevrimiçi değil, anahtarı yok
  await b.addFriendByCode(a.inviteCode, b.intro); await broker.settle();
  // Mallory A'nın anahtar konusuna kendi anahtarını yazar
  const kt = await P.keyTopic(a.myFp);
  mallory.transport.publish(kt, JSON.stringify({ v: 2, pub: mallory.state.identity.pub }), true);
  await broker.settle();
  assert.equal(b.getState().outgoing[0].pub, undefined, 'sahte anahtar kabul edildi');
  // Gerçek A gelince düzelir
  await a.onConnected(); await broker.settle();
  assert.equal(a.getState().incoming.length, 1);
});

test('SALDIRI: istenmemiş "kabul" cevabı arkadaş eklemez', async () => {
  const broker = new FakeBroker();
  const a = await makeUser(broker, 'Ayşe');
  const m = await makeUser(broker, 'Mallory');
  await a.onConnected(); await m.onConnected(); await broker.settle();
  // Mallory A'yı ekler gibi yapmadan, doğrudan A'ya "acc" yollar
  m.state.incoming[a.myFpHex] = { fp: a.myFpHex, pub: a.state.identity.pub, name: 'x' };
  await m.acceptRequest(a.myFpHex, m.intro);
  await broker.settle();
  assert.equal(a.getState().friends.length, 0);
});

test('tezahürat: geçerli emoji iletilir, sel/tekrar engellenir', async () => {
  const broker = new FakeBroker();
  const { a, b } = await pairUp(broker);
  const aFp = Object.keys(b.state.friends)[0];
  assert.equal(await b.sendCheer(aFp, '☕'), true);
  assert.equal(await b.sendCheer(aFp, '<script>'), false);
  await broker.settle();
  assert.equal(a.events.filter(e => e.type === 'cheer').length, 1);
  await b.sendCheer(aFp, '🔥'); await broker.settle(); // 5 sn dolmadı
  assert.equal(a.events.filter(e => e.type === 'cheer').length, 1);
  clock += 6000;
  await b.sendCheer(aFp, '🔥'); await broker.settle();
  assert.equal(a.events.filter(e => e.type === 'cheer').length, 2);
});

test('arkadaş silinince kanaldan çıkılır ve retained profil temizlenir', async () => {
  const broker = new FakeBroker();
  const { a, b } = await pairUp(broker);
  await a.publishProfile(profile()); await broker.settle();
  const bFp = Object.keys(a.state.friends)[0];
  const p = await a._pair(a.state.friends[bFp]);
  assert.ok(broker.retained.has(p.mine));
  await a.removeFriend(bFp); await broker.settle();
  assert.equal(a.getState().friends.length, 0);
  assert.ok(!broker.retained.has(p.mine));
  // B tekrar isterse A'ya istek olarak düşer (otomatik eklenmez)
  await b.addFriendByCode(a.inviteCode, b.intro); await broker.settle();
  // B zaten arkadaş sanıyor -> 'already'
  assert.equal(a.getState().friends.length, 0);
});

test('validateProfile sınırları', () => {
  const t = clock;
  assert.ok(P.validateProfile({ ...profile(), ts: t }, t));
  assert.equal(P.validateProfile({ ...profile({ weeklyMinutes: 10081 }), ts: t }, t), null);
  assert.equal(P.validateProfile({ ...profile({ name: '   ' }), ts: t }, t), null);
  assert.equal(P.validateProfile({ ...profile(), ts: t + 3600e3 }, t), null, 'gelecekten gelen zaman damgası');
  assert.equal(P.validateProfile({ ...profile({ currentTask: 'x'.repeat(500) }), ts: t }, t).currentTask.length, 80);
});
