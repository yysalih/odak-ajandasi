/*
 * friend-protocol.js — Arkadaşlık protokolü (DOM yok, Node'da test edilir).
 *
 * NEDEN YENİDEN YAZILDI
 * Eski sürüm herkese açık bir MQTT broker'ına (broker.emqx.io) şifresiz JSON
 * yolluyordu. Konu adları "odak/users/v1/ODAK-1234" biçimindeydi ve kodlar
 * yalnızca 4 haneliydi. Herhangi biri "odak/#" konusuna abone olup tüm
 * kullanıcıların isim/süre/görev bilgisini okuyabiliyor, herkese sahte
 * profil, sahte eşleşme ve mesaj gönderebiliyordu.
 *
 * YENİ MODEL (broker'a güvenilmez; o sadece bir posta kutusu)
 *  1. Her cihaz bir ECDH P-256 anahtar çifti üretir (WebCrypto).
 *  2. Davet kodu = SHA-256(açık anahtar)'ın ilk 15 baytı (120 bit) + 1 bayt
 *     sağlama. Kod tahmin edilemez; aynı zamanda karşı tarafın anahtarını
 *     doğrulamak için parmak izidir.
 *  3. Konu adları parmak izinin hash'idir; konuyu gören kişi kodu elde edemez.
 *  4. Arkadaşlık isteği, alıcının parmak izi ile tuzlanmış (HKDF salt) bir
 *     anahtarla şifrelenir. Kodu bilmeyen biri konu adını görse bile alıcının
 *     açabileceği bir istek üretemez.
 *  5. İstek kabul edilene kadar arkadaş listesine HİÇBİR ŞEY eklenmez.
 *  6. Eşleşen iki kişi ECDH ile ortak anahtar türetir; profil ve "tezahürat"
 *     mesajları AES-GCM ile şifrelenir ve kimliği doğrulanır. Konu adı
 *     AAD olarak eklendiği için mesaj başka konuya taşınamaz.
 *  7. Gelen her profil sıkı doğrulanır (aralık dışı sayı → mesaj reddedilir).
 *
 * KALAN SINIRLAR (README'de de yazıyor)
 *  - Broker hâlâ ortak ve herkese açık: şifreli paketleri ve hangi hash'li
 *    konunun ne zaman aktif olduğunu (meta veri) görebilir, mesaj silebilir
 *    veya trafiği boğabilir (DoS). İçeriği okuyamaz / taklit edemez.
 *  - Arkadaşın gönderdiği istatistik onun cihazının beyanıdır. Sunucu
 *    tarafında doğrulama olmadan bir kişinin kendi istatistiğini şişirmesi
 *    tamamen engellenemez; sadece makul aralık dışı değerler reddedilir.
 *  - Davet kodunu ele geçiren biri istek gönderebilir (ama onay gerekir).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OdakFriendProtocol = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const Core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.OdakCore;
  const subtle = (root.crypto || globalThis.crypto).subtle;
  const getRandomValues = (a) => (root.crypto || globalThis.crypto).getRandomValues(a);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const PREFIX = 'odak/v2';
  const FP_LEN = 15;                    // 120 bit parmak izi
  const MAX_PAYLOAD = 100 * 1024;       // 100 KB üstü paket hiç açılmaz
  const CHEER_EMOJIS = ['☕', '🙌', '🔥'];
  const STATUSES = ['focus', 'break', 'idle'];
  const MAX_WEEK_MIN = 7 * 24 * 60;     // bir haftada fiziksel üst sınır

  /* ---------- Kodlama yardımcıları ---------- */

  function b64u(bytes) {
    let s = '';
    const b = new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('b64');
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function hex(bytes) {
    return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
  }
  function concat(...arrs) {
    const len = arrs.reduce((a, x) => a + x.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
    return r === 0;
  }

  // Crockford base32: elle yazarken karışan harfler (O/0, I/L/1) tolere edilir.
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function base32(bytes) {
    let bits = 0, val = 0, out = '';
    for (const byte of bytes) {
      val = (val << 8) | byte; bits += 8;
      while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function unbase32(str, nBytes) {
    let bits = 0, val = 0;
    const out = [];
    for (const ch of str) {
      const i = B32.indexOf(ch);
      if (i < 0) return null;
      val = (val << 5) | i; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    }
    return out.length >= nBytes ? new Uint8Array(out.slice(0, nBytes)) : null;
  }

  async function sha256(bytes) {
    return new Uint8Array(await subtle.digest('SHA-256', bytes));
  }

  /* ---------- Davet kodu ---------- */

  async function fingerprintOf(pubRaw) {
    return (await sha256(pubRaw)).slice(0, FP_LEN);
  }

  async function inviteCodeFromFp(fp) {
    const check = (await sha256(fp))[0];
    const s = base32(concat(fp, new Uint8Array([check]))); // 16 bayt -> 26 karakter
    return 'ODAK-' + s.match(/.{1,4}/g).join('-');
  }

  // Kullanıcının yazdığı/yapıştırdığı kodu çözer. Hatalıysa null döner.
  async function parseInviteCode(input) {
    if (typeof input !== 'string') return null;
    let s = input.toUpperCase();
    // Paylaşım linki yapıştırıldıysa ?davet=... kısmını al
    const m = s.match(/DAVET=([A-Z0-9-]+)/);
    if (m) s = m[1];
    s = s.replace(/^\s*ODAK/, '').replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
    if (s.length !== 26) return null;
    const bytes = unbase32(s, FP_LEN + 1);
    if (!bytes) return null;
    const fp = bytes.slice(0, FP_LEN);
    if ((await sha256(fp))[0] !== bytes[FP_LEN]) return null; // yazım hatası
    return fp;
  }

  /* ---------- Anahtarlar ---------- */

  async function generateIdentity() {
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
    const privJwk = await subtle.exportKey('jwk', kp.privateKey);
    return { privJwk, pub: b64u(pubRaw) };
  }

  async function importPriv(jwk) {
    return subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  }

  async function importPub(pubRaw) {
    if (!(pubRaw instanceof Uint8Array) || pubRaw.length !== 65 || pubRaw[0] !== 4) throw new Error('pub');
    return subtle.importKey('raw', pubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  }

  async function ecdh(privKey, pubRaw) {
    const pub = await importPub(pubRaw); // geçersiz eğri noktası burada hata verir
    return new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, privKey, 256));
  }

  async function hkdfKey(ikm, salt, info) {
    const base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function hkdfBits(ikm, salt, info, bits) {
    const base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) }, base, bits));
  }

  async function seal(key, obj, aad) {
    const iv = getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64u(iv), ct: b64u(ct) };
  }
  async function open(key, msg, aad) {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(msg.iv), additionalData: enc.encode(aad) }, key, unb64u(msg.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* ---------- Konu adları ---------- */

  async function topicHash(label, bytes) {
    return hex((await sha256(concat(enc.encode(label), bytes))).slice(0, 16));
  }
  const keyTopic = async fp => `${PREFIX}/k/${await topicHash('key', fp)}`;
  const inboxBase = async fp => `${PREFIX}/i/${await topicHash('inbox', fp)}`;
  // Her gönderenin alıcı kutusunda kendi alt konusu olur, böylece "retained"
  // istekler birbirinin üzerine yazmaz ve alıcı çevrimdışıyken bile bekler.
  async function inboxSlot(toFp, fromFp) {
    return `${await inboxBase(toFp)}/${(await topicHash('slot', fromFp)).slice(0, 12)}`;
  }

  /* ---------- Profil doğrulama ---------- */

  // Arkadaştan gelen profil: aralık dışı herhangi bir alan → tüm mesaj reddedilir.
  function validateProfile(p, nowMs) {
    if (!p || typeof p !== 'object') return null;
    const name = Core.cleanText(p.name, 40);
    if (!name) return null;
    if (!Core.isIntInRange(p.weeklyMinutes, 0, MAX_WEEK_MIN)) return null;
    if (!Core.isIntInRange(p.trees, 0, 100000)) return null;
    if (!STATUSES.includes(p.status)) return null;
    if (typeof p.ts !== 'number' || p.ts > nowMs + 5 * 60 * 1000 || p.ts < nowMs - 365 * 864e5) return null;
    return {
      name,
      avatar: Core.normalizeAvatar(p.avatar),
      weeklyMinutes: p.weeklyMinutes,
      trees: p.trees,
      status: p.status,
      currentTask: Core.cleanText(p.currentTask, 80),
      ts: p.ts
    };
  }

  function validateIntro(p) {
    if (!p || typeof p !== 'object') return null;
    const name = Core.cleanText(p.name, 40);
    if (!name) return null;
    return { name, avatar: Core.normalizeAvatar(p.avatar) };
  }

  /* ---------- Ana sınıf ---------- */

  /**
   * opts.storage   : { get(key) -> obj|null, set(key, obj) }
   * opts.transport : { subscribe(topic), unsubscribe(topic), publish(topic, str, retained) }
   * opts.now       : () => ms (testlerde sabitlenebilir)
   * opts.onEvent   : (type, detail) => void   (UI bildirimleri)
   */
  class FriendNetwork {
    constructor(opts) {
      this.storage = opts.storage;
      this.transport = opts.transport;
      this.now = opts.now || (() => Date.now());
      this.onEvent = opts.onEvent || (() => {});
      this.storageKey = opts.storageKey || 'ODAK_FRIENDS_V2';
      this.state = null;
      this.priv = null;
      this.myPubRaw = null;
      this.myFp = null;
      this.inviteCode = '';
      this.routes = new Map();        // topic -> { kind, fp }
      this.rate = new Map();          // topic -> [timestamps]
      this.pairCache = new Map();     // fp -> { key, topicA, topicB, mine, theirs }
    }

    async init() {
      let st = this.storage.get(this.storageKey);
      if (!st || !st.identity || !st.identity.privJwk) {
        st = { identity: await generateIdentity(), friends: {}, incoming: {}, outgoing: {} };
      }
      st.friends = st.friends || {}; st.incoming = st.incoming || {}; st.outgoing = st.outgoing || {};
      this.state = st;
      this.priv = await importPriv(st.identity.privJwk);
      this.myPubRaw = unb64u(st.identity.pub);
      this.myFp = await fingerprintOf(this.myPubRaw);
      this.myFpHex = hex(this.myFp);
      this.inviteCode = await inviteCodeFromFp(this.myFp);
      this._save();
      return this;
    }

    _save() { this.storage.set(this.storageKey, this.state); }
    _emit(type, detail) { try { this.onEvent(type, detail); } catch (e) { /* UI hatası protokolü bozmasın */ } }

    getState() {
      const mapF = f => ({ ...f });
      return {
        inviteCode: this.inviteCode,
        friends: Object.values(this.state.friends).map(mapF),
        incoming: Object.values(this.state.incoming).map(mapF),
        outgoing: Object.values(this.state.outgoing).map(mapF)
      };
    }

    /* --- Bağlantı kurulduğunda (her broker için) çağrılır --- */
    async onConnected() {
      // 1) Kendi açık anahtarımı yayınla (retained). Açık anahtar gizli değildir.
      await this._sub(await keyTopic(this.myFp), { kind: 'ownkey' });
      this.transport.publish(await keyTopic(this.myFp), JSON.stringify({ v: 2, pub: b64u(this.myPubRaw) }), true);
      // 2) Gelen kutum
      const ib = await inboxBase(this.myFp);
      this.routes.set(ib + '/+', { kind: 'inbox' });
      this.transport.subscribe(ib + '/+');
      // 3) Bekleyen giden istekler: anahtar alınmadıysa anahtar konusunu dinle, alındıysa isteği yeniden gönder
      for (const o of Object.values(this.state.outgoing)) await this._progressOutgoing(o);
      // 4) Arkadaş kanalları
      for (const f of Object.values(this.state.friends)) await this._subscribePair(f);
    }

    async _sub(topic, route) {
      this.routes.set(topic, route);
      this.transport.subscribe(topic);
    }

    /* --- Arkadaş ekleme (davet kodu ile) --- */
    async addFriendByCode(code, intro) {
      const fp = await parseInviteCode(code);
      if (!fp) return { status: 'invalid' };
      const fpHex = hex(fp);
      if (fpHex === this.myFpHex) return { status: 'self' };
      if (this.state.friends[fpHex]) return { status: 'already', friend: this.state.friends[fpHex] };
      if (this.state.incoming[fpHex]) { await this.acceptRequest(fpHex, intro); return { status: 'accepted' }; }
      const o = this.state.outgoing[fpHex] || { fp: fpHex, code: await inviteCodeFromFp(fp), createdAt: this.now() };
      o.intro = validateIntro(intro) || { name: 'Odak Kullanıcısı', avatar: '👤' };
      this.state.outgoing[fpHex] = o;
      this._save();
      await this._progressOutgoing(o);
      return { status: 'sent' };
    }

    async _progressOutgoing(o) {
      const fp = hexToBytes(o.fp);
      if (!o.pub) {
        await this._sub(await keyTopic(fp), { kind: 'key', fp: o.fp });
        return;
      }
      const theirPub = unb64u(o.pub);
      const shared = await ecdh(this.priv, theirPub);
      const key = await hkdfKey(shared, fp, 'odak-v2-req');
      const topic = await inboxSlot(fp, this.myFp);
      const body = await seal(key, { ...o.intro, ts: this.now() }, `req|${topic}`);
      this.transport.publish(topic, JSON.stringify({ v: 2, k: 'req', from: b64u(this.myPubRaw), ...body }), true);
      o.sentAt = this.now();
      this._save();
    }

    cancelOutgoing(fpHex) {
      if (!this.state.outgoing[fpHex]) return;
      const fp = hexToBytes(fpHex);
      delete this.state.outgoing[fpHex];
      this._save();
      inboxSlot(fp, this.myFp).then(t => this.transport.publish(t, '', true)); // retained isteği temizle
    }

    /* --- Gelen istek: kabul / ret --- */
    async acceptRequest(fpHex, intro) {
      const req = this.state.incoming[fpHex];
      if (!req) return false;
      const theirPub = unb64u(req.pub);
      const theirFp = hexToBytes(fpHex);
      const shared = await ecdh(this.priv, theirPub);
      const key = await hkdfKey(shared, theirFp, 'odak-v2-acc');
      const topic = await inboxSlot(theirFp, this.myFp);
      const myIntro = validateIntro(intro) || { name: 'Odak Kullanıcısı', avatar: '👤' };
      const body = await seal(key, { ...myIntro, ts: this.now(), ok: true }, `acc|${topic}`);
      this.transport.publish(topic, JSON.stringify({ v: 2, k: 'acc', from: b64u(this.myPubRaw), ...body }), true);
      this.transport.publish(await inboxSlot(this.myFp, theirFp), '', true); // isteği kutumdan sil
      delete this.state.incoming[fpHex];
      delete this.state.outgoing[fpHex];
      const f = this._makeFriend(fpHex, req.pub, req);
      this._save();
      await this._subscribePair(f);
      this._emit('friend-added', f);
      return true;
    }

    async rejectRequest(fpHex) {
      const req = this.state.incoming[fpHex];
      if (!req) return false;
      const theirFp = hexToBytes(fpHex);
      const shared = await ecdh(this.priv, unb64u(req.pub));
      const key = await hkdfKey(shared, theirFp, 'odak-v2-acc');
      const topic = await inboxSlot(theirFp, this.myFp);
      const body = await seal(key, { ok: false, ts: this.now() }, `rej|${topic}`);
      this.transport.publish(topic, JSON.stringify({ v: 2, k: 'rej', from: b64u(this.myPubRaw), ...body }), true);
      this.transport.publish(await inboxSlot(this.myFp, theirFp), '', true);
      delete this.state.incoming[fpHex];
      this._save();
      return true;
    }

    async removeFriend(fpHex) {
      const f = this.state.friends[fpHex];
      if (!f) return;
      const p = await this._pair(f);
      this.transport.publish(p.mine, '', true);          // kendi retained profilimi kanaldan sil
      this.transport.unsubscribe(p.theirs);
      this.transport.unsubscribe(p.theirs + '/c');
      delete this.state.friends[fpHex];
      this.pairCache.delete(fpHex);
      this._save();
    }

    _makeFriend(fpHex, pub, intro) {
      const f = this.state.friends[fpHex] || { fp: fpHex, pub, addedAt: this.now() };
      f.pub = pub;
      f.code = f.code || null;
      f.name = f.name || (intro && intro.name) || 'Odak Kullanıcısı';
      f.avatar = f.avatar || (intro && intro.avatar) || '👤';
      f.weeklyMinutes = f.weeklyMinutes || 0;
      f.trees = f.trees || 0;
      f.status = f.status || 'idle';
      f.currentTask = f.currentTask || '';
      f.lastProfileTs = f.lastProfileTs || 0;
      f.lastCheerTs = f.lastCheerTs || 0;
      this.state.friends[fpHex] = f;
      inviteCodeFromFp(hexToBytes(fpHex)).then(c => { f.code = c; this._save(); });
      return f;
    }

    /* --- Eşleşmiş arkadaş kanalı --- */
    async _pair(f) {
      let p = this.pairCache.get(f.fp);
      if (p) return p;
      const shared = await ecdh(this.priv, unb64u(f.pub));
      const both = [this.myFpHex, f.fp].sort().join(':');
      const key = await hkdfKey(shared, enc.encode('odak-v2-pair'), both);
      const tid = hex(await hkdfBits(shared, enc.encode('odak-v2-topic'), both, 128));
      const myRole = this.myFpHex < f.fp ? 'a' : 'b';
      const theirRole = myRole === 'a' ? 'b' : 'a';
      p = { key, mine: `${PREFIX}/p/${tid}/${myRole}`, theirs: `${PREFIX}/p/${tid}/${theirRole}` };
      this.pairCache.set(f.fp, p);
      return p;
    }

    async _subscribePair(f) {
      const p = await this._pair(f);
      await this._sub(p.theirs, { kind: 'pair', fp: f.fp });
      await this._sub(p.theirs + '/c', { kind: 'cheer', fp: f.fp });
      if (this.lastProfile) await this._publishProfileTo(f, this.lastProfile);
    }

    // Tüm arkadaşlara güncel profilimi gönder (retained: arkadaşım sonradan açsa da görür)
    async publishProfile(profile) {
      this.lastProfile = profile;
      this.lastIntro = validateIntro(profile) || this.lastIntro;
      for (const f of Object.values(this.state.friends)) await this._publishProfileTo(f, profile);
    }

    async _publishProfileTo(f, profile) {
      const p = await this._pair(f);
      const body = await seal(p.key, { t: 'profile', ...profile, ts: this.now() }, p.mine);
      this.transport.publish(p.mine, JSON.stringify({ v: 2, ...body }), true);
    }

    async sendCheer(fpHex, emoji) {
      const f = this.state.friends[fpHex];
      if (!f || !CHEER_EMOJIS.includes(emoji)) return false;
      const p = await this._pair(f);
      const topic = p.mine + '/c';
      const body = await seal(p.key, { t: 'cheer', emoji, ts: this.now() }, topic);
      this.transport.publish(topic, JSON.stringify({ v: 2, ...body }), false);
      return true;
    }

    /* --- Gelen mesajlar --- */
    _rateOk(topic) {
      const now = this.now();
      const arr = (this.rate.get(topic) || []).filter(t => now - t < 10000);
      arr.push(now);
      this.rate.set(topic, arr);
      return arr.length <= 20; // konu başına 10 sn'de en fazla 20 mesaj işlenir
    }

    _route(topic) {
      if (this.routes.has(topic)) return this.routes.get(topic);
      const slash = topic.lastIndexOf('/');
      const parent = topic.slice(0, slash) + '/+';
      const r = this.routes.get(parent);
      return r && r.kind === 'inbox' ? r : null;
    }

    async handleMessage(topic, payload) {
      try {
        if (typeof payload !== 'string' || !payload || payload.length > MAX_PAYLOAD) return 'ignored';
        const route = this._route(topic);
        if (!route) return 'ignored';
        if (!this._rateOk(topic)) return 'rate-limited';
        const msg = JSON.parse(payload);
        if (!msg || msg.v !== 2) return 'ignored';
        switch (route.kind) {
          case 'key': return await this._onKey(route.fp, msg);
          case 'inbox': return await this._onInbox(topic, msg);
          case 'pair': return await this._onPair(route.fp, topic, msg);
          case 'cheer': return await this._onCheer(route.fp, topic, msg);
          default: return 'ignored';
        }
      } catch (e) {
        return 'rejected'; // çözülemeyen / bozuk / sahte paket sessizce düşer
      }
    }

    async _onKey(fpHex, msg) {
      const o = this.state.outgoing[fpHex];
      if (!o || o.pub) return 'ignored';
      const pubRaw = unb64u(msg.pub);
      // Anahtar, davet kodundaki parmak iziyle eşleşmeli; yoksa sahte anahtardır.
      if (!bytesEqual(await fingerprintOf(pubRaw), hexToBytes(fpHex))) return 'rejected';
      await importPub(pubRaw);
      o.pub = b64u(pubRaw);
      this._save();
      await this._progressOutgoing(o);
      this._emit('request-sent', { fp: fpHex });
      return 'key-accepted';
    }

    async _onInbox(topic, msg) {
      if (!['req', 'acc', 'rej'].includes(msg.k)) return 'ignored';
      const pubRaw = unb64u(msg.from);
      const fromFp = await fingerprintOf(pubRaw);
      const fromHex = hex(fromFp);
      if (fromHex === this.myFpHex) return 'ignored';
      // Konu, bu gönderene ait kutu olmalı (başkasının kutusuna yazılmış paket kabul edilmez)
      if (topic !== await inboxSlot(this.myFp, fromFp)) return 'rejected';
      const shared = await ecdh(this.priv, pubRaw);

      if (msg.k === 'req') {
        // Anahtar MY parmak izimle tuzlanır: davet kodumu bilmeyen biri bu paketi üretemez.
        const key = await hkdfKey(shared, this.myFp, 'odak-v2-req');
        const intro = validateIntro(await open(key, msg, `req|${topic}`));
        if (!intro) return 'rejected';
        if (this.state.friends[fromHex] || this.state.outgoing[fromHex]) {
          // Zaten arkadaşız (karşı taraf listesini sıfırlamış olabilir) ya da
          // ikimiz de birbirimizi eklemişiz: tekrar onay istemeden kabul et.
          // İkimiz de birbirimizi eklemişiz: kabul et.
          const myIntro = (this.state.outgoing[fromHex] && this.state.outgoing[fromHex].intro) || this.lastIntro;
          this.state.incoming[fromHex] = { fp: fromHex, pub: b64u(pubRaw), ...intro, ts: this.now() };
          await this.acceptRequest(fromHex, myIntro);
          return 'auto-accepted';
        }
        const isNew = !this.state.incoming[fromHex];
        this.state.incoming[fromHex] = { fp: fromHex, pub: b64u(pubRaw), ...intro, ts: this.now() };
        this._save();
        if (isNew) this._emit('request-received', this.state.incoming[fromHex]);
        return 'request-stored';
      }

      // acc / rej: yalnızca BENİM gönderdiğim bir isteğe cevap olarak kabul edilir.
      const o = this.state.outgoing[fromHex];
      if (!o) { this.transport.publish(topic, '', true); return 'ignored'; }
      const key = await hkdfKey(shared, this.myFp, 'odak-v2-acc');
      const body = await open(key, msg, `${msg.k}|${topic}`);
      this.transport.publish(topic, '', true); // cevabı kutumdan temizle
      delete this.state.outgoing[fromHex];
      if (msg.k === 'rej' || !body.ok) {
        this._save();
        this._emit('request-rejected', { fp: fromHex });
        return 'rejected-by-peer';
      }
      const intro = validateIntro(body) || {};
      const f = this._makeFriend(fromHex, b64u(pubRaw), intro);
      this._save();
      await this._subscribePair(f);
      this._emit('friend-added', f);
      return 'friend-added';
    }

    async _onPair(fpHex, topic, msg) {
      const f = this.state.friends[fpHex];
      if (!f) return 'ignored';
      const p = await this._pair(f);
      const data = await open(p.key, msg, topic);
      if (!data || data.t !== 'profile') return 'rejected';
      const prof = validateProfile(data, this.now());
      if (!prof) return 'rejected';
      if (prof.ts <= f.lastProfileTs) return 'stale'; // tekrar (replay) / eski paket
      Object.assign(f, prof, { lastProfileTs: prof.ts });
      this._save();
      this._emit('profile', f);
      return 'profile-updated';
    }

    async _onCheer(fpHex, topic, msg) {
      const f = this.state.friends[fpHex];
      if (!f) return 'ignored';
      const p = await this._pair(f);
      const data = await open(p.key, msg, topic);
      if (!data || data.t !== 'cheer' || !CHEER_EMOJIS.includes(data.emoji)) return 'rejected';
      const now = this.now();
      if (typeof data.ts !== 'number' || data.ts <= f.lastCheerTs || Math.abs(now - data.ts) > 2 * 60 * 1000) return 'stale';
      if (now - (f.lastCheerShownAt || 0) < 5000) return 'rate-limited'; // bildirim seli olmasın
      f.lastCheerTs = data.ts;
      f.lastCheerShownAt = now;
      this._save();
      this._emit('cheer', { fp: fpHex, name: f.name, emoji: data.emoji });
      return 'cheer';
    }
  }

  function hexToBytes(h) {
    if (typeof h !== 'string' || !/^[0-9a-f]*$/.test(h) || h.length % 2) throw new Error('hex');
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }

  return {
    FriendNetwork,
    parseInviteCode, inviteCodeFromFp, fingerprintOf, validateProfile,
    keyTopic, inboxBase, inboxSlot,
    _internal: { b64u, unb64u, hex, hexToBytes, base32, unbase32, generateIdentity, ecdh, seal, open, hkdfKey }
  };
});
