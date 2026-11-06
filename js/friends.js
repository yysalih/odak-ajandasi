/* ══════════════════════════════════════════════════════
   ARKADAŞLAR — arayüz + MQTT bağlantısı
   Protokol ve güvenlik modeli: js/friend-protocol.js (ve testleri)
   ══════════════════════════════════════════════════════ */

// İki herkese açık broker'a AYNI ANDA bağlanılır ve her mesaj ikisine de
// gönderilir. Eskiden biri bağlanamazsa diğerine geçiliyordu; iki arkadaş
// farklı broker'a düşünce birbirini hiç göremiyordu (arkadaş ekleme hatası).
// window.__ODAK_BROKERS__ yalnızca uçtan uca testlerde yerel broker vermek için kullanılır.
const FRIEND_BROKERS = (Array.isArray(window.__ODAK_BROKERS__) && window.__ODAK_BROKERS__) || [
  { id: 'emqx', host: 'broker.emqx.io', port: 8084, path: '/mqtt', ssl: true },
  { id: 'hivemq', host: 'broker.hivemq.com', port: 8884, path: '/mqtt', ssl: true }
];

class PahoMultiTransport {
  constructor(brokers, onMessage, onConnected, onStatus){
    this.brokers = brokers;
    this.onMessage = onMessage;
    this.onConnected = onConnected;
    this.onStatus = onStatus || (() => {});
    this.clients = new Map();   // id -> { client, connected }
    this.subs = new Set();
  }
  connectedCount(){
    return [...this.clients.values()].filter(c => c.connected).length;
  }
  start(){
    if(typeof Paho === 'undefined' || !Paho.MQTT){ this.onStatus('Bağlantı kütüphanesi yüklenemedi'); return; }
    this.brokers.forEach(b => this._connect(b));
  }
  _connect(b){
    const prev = this.clients.get(b.id);
    if(prev && (prev.connected || prev.connecting)) return;
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), x => x.toString(16).padStart(2,'0')).join('');
    const client = new Paho.MQTT.Client(b.host, b.port, b.path, 'odak_' + rand); // istemci kimliği rastgele, kullanıcıya bağlı değil
    const entry = { client, connected: false, connecting: true, retry: (prev && prev.retry) || 0 };
    this.clients.set(b.id, entry);
    client.onConnectionLost = () => {
      entry.connected = false; entry.connecting = false;
      this.onStatus();
      this._scheduleRetry(b, entry);
    };
    client.onMessageArrived = (m) => {
      let payload = '';
      try { payload = m.payloadString; } catch(e){ return; }
      this.onMessage(m.destinationName, payload);
    };
    try {
      client.connect({
        useSSL: b.ssl !== false, timeout: 8, keepAliveInterval: 30, cleanSession: true,
        onSuccess: () => {
          entry.connected = true; entry.connecting = false; entry.retry = 0;
          this.subs.forEach(t => { try { client.subscribe(t, { qos: 1 }); } catch(e){} });
          this.onStatus();
          this.onConnected(b.id);
        },
        onFailure: () => {
          entry.connected = false; entry.connecting = false;
          this.onStatus();
          this._scheduleRetry(b, entry);
        }
      });
    } catch(e){
      entry.connecting = false;
      this._scheduleRetry(b, entry);
    }
  }
  _scheduleRetry(b, entry){
    entry.retry = Math.min((entry.retry || 0) + 1, 6);
    const delay = Math.min(60000, 2000 * Math.pow(2, entry.retry)); // üstel bekleme, en çok 1 dk
    setTimeout(() => this._connect(b), delay);
  }
  subscribe(topic){
    this.subs.add(topic);
    this.clients.forEach(c => { if(c.connected){ try { c.client.subscribe(topic, { qos: 1 }); } catch(e){} } });
  }
  unsubscribe(topic){
    this.subs.delete(topic);
    this.clients.forEach(c => { if(c.connected){ try { c.client.unsubscribe(topic); } catch(e){} } });
  }
  publish(topic, payload, retained){
    this.clients.forEach(c => {
      if(!c.connected) return;
      try {
        const msg = new Paho.MQTT.Message(payload);
        msg.destinationName = topic;
        msg.retained = !!retained;
        msg.qos = 1;
        c.client.send(msg);
      } catch(e){ console.warn('MQTT gönderim hatası:', e); }
    });
  }
}

const friendStorage = {
  get(k){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

let friendNet = null;
let friendTransport = null;
let friendNetReady = null;

function friendIntro(){
  return { name: userProfile.name || 'Odak Kullanıcısı', avatar: userProfile.avatar || '👤' };
}

function initRealtimeFriends(){
  if(friendNetReady) return friendNetReady;
  if(!(window.crypto && crypto.subtle)){
    setFriendsStatus('Bu tarayıcı güvenli bağlantı (HTTPS / WebCrypto) gerektiriyor');
    return Promise.resolve(null);
  }
  // Eski (v1, şifresiz) arkadaş verisini temizle: doğrulanamaz.
  try { localStorage.removeItem('ODAK_MY_FRIEND_CODE'); } catch(e){}

  friendTransport = new PahoMultiTransport(
    FRIEND_BROKERS,
    (topic, payload) => { if(friendNet) friendNet.handleMessage(topic, payload); },
    async () => {
      if(!friendNet) return;
      await friendNet.onConnected();
      publishMyLiveProfile();
    },
    () => updateFriendsConnStatus()
  );

  friendNet = new OdakFriendProtocol.FriendNetwork({
    storage: friendStorage,
    transport: friendTransport,
    onEvent: onFriendEvent
  });

  friendNetReady = friendNet.init().then(() => {
    renderFriendsLeaderboard();
    friendTransport.start();
    handleInviteLinkInUrl();
    return friendNet;
  }).catch(err => {
    console.warn('Arkadaş sistemi başlatılamadı:', err);
    setFriendsStatus('Arkadaş sistemi başlatılamadı');
    return null;
  });
  return friendNetReady;
}

function onFriendEvent(type, d){
  if(type === 'request-received'){
    showAppToast(`${d.name} seni arkadaş olarak eklemek istiyor`, '🤝');
  } else if(type === 'friend-added'){
    showAppToast(`${d.name} ile artık arkadaşsınız!`, '🎉');
    publishMyLiveProfile();
  } else if(type === 'request-rejected'){
    showAppToast('Arkadaşlık isteğin kabul edilmedi.', 'ℹ️');
  } else if(type === 'request-sent'){
    showAppToast('Arkadaşlık isteği gönderildi, onay bekleniyor.', '📨');
  } else if(type === 'cheer'){
    const messages = {
      '☕': `${d.name} sana bir çalışma kahvesi ısmarladı!`,
      '🙌': `${d.name} seninle beşlik çaktı!`,
      '🔥': `${d.name} sana motivasyon gönderdi!`
    };
    showAppToast(messages[d.emoji] || `${d.name} sana motivasyon gönderdi!`, d.emoji);
    playChimeSound();
  }
  renderFriendsLeaderboard();
}

function setFriendsStatus(text){
  const el = document.getElementById('friends-conn-status');
  if(el) el.textContent = text;
}

function updateFriendsConnStatus(){
  if(!friendTransport) return;
  const n = friendTransport.connectedCount();
  setFriendsStatus(n > 0 ? `🟢 Bağlı (${n}/${FRIEND_BROKERS.length} sunucu) · uçtan uca şifreli` : '🔴 Bağlantı yok · yeniden deneniyor');
}

function getMyFriendCode(){
  return friendNet ? friendNet.inviteCode : '…';
}

function getInviteLink(){
  return `${location.origin}${location.pathname}?davet=${encodeURIComponent(getMyFriendCode())}`;
}

// Arkadaşa giden profil: yalnızca gerekli alanlar. Haftalık = son 7 gün.
function getMyLiveProfile(){
  const list = getUnifiedStatsList();
  const todayKey = toDateKey(new Date());
  return {
    name: OdakCore.cleanText(userProfile.name || 'Odak Kullanıcısı', 40) || 'Odak Kullanıcısı',
    avatar: OdakCore.normalizeAvatar(userProfile.avatar),
    weeklyMinutes: Math.min(10080, OdakCore.weeklyMinutes(list, todayKey)),
    trees: OdakCore.successful(list).length,
    status: isFocusing ? 'focus' : (isShortBreak ? 'break' : 'idle'),
    currentTask: (isFocusing && activeTask?.title) ? OdakCore.cleanText(activeTask.title, 80) : ''
  };
}

let _profilePublishTimer = null;
function publishMyLiveProfile(){
  if(!friendNet) return;
  clearTimeout(_profilePublishTimer);
  _profilePublishTimer = setTimeout(() => {
    friendNet.publishProfile(getMyLiveProfile()).catch(e => console.warn('Profil gönderilemedi:', e));
  }, 300);
}

function renderFriends(){
  renderFriendsLeaderboard();
}

function sendFriendCheer(fp, emoji){
  if(!friendNet) return;
  const f = friendNet.state.friends[fp];
  if(!f) return;
  friendNet.sendCheer(fp, emoji).then(ok => {
    if(ok) showAppToast(`${f.name} için ${emoji} gönderildi`, emoji);
  });
}

function acceptFriendRequest(fp){
  if(!friendNet) return;
  friendNet.acceptRequest(fp, friendIntro()).then(() => renderFriendsLeaderboard());
}
function rejectFriendRequest(fp){
  if(!friendNet) return;
  friendNet.rejectRequest(fp).then(() => { renderFriendsLeaderboard(); showAppToast('İstek reddedildi.', 'ℹ️'); });
}
function cancelFriendRequest(fp){
  if(!friendNet) return;
  friendNet.cancelOutgoing(fp);
  renderFriendsLeaderboard();
}
function removeFriendConfirm(fp){
  if(!friendNet) return;
  const f = friendNet.state.friends[fp];
  if(!f || !confirm(`${f.name} arkadaş listenden çıkarılsın mı?`)) return;
  friendNet.removeFriend(fp).then(() => { renderFriendsLeaderboard(); showAppToast('Arkadaş listeden çıkarıldı.', '🗑️'); });
}

function formatFriendDuration(mins){
  mins = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}d` : `${m} dk`;
}

function renderFriendsLeaderboard(){
  const me = getMyLiveProfile();
  const myCode = getMyFriendCode();

  const selfAvatarEl = document.getElementById('friends-self-avatar');
  const selfNameEl = document.getElementById('friends-self-name');
  const selfStatsEl = document.getElementById('friends-self-stats');
  if(selfAvatarEl) selfAvatarEl.innerHTML = renderAvatarHtml(me.avatar, 48);
  if(selfNameEl) selfNameEl.textContent = me.name;
  ['friends-self-code','modal-my-friend-code','my-friend-code'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = myCode;
  });

  const st = friendNet ? friendNet.getState() : { friends: [], incoming: [], outgoing: [] };

  // Bekleyen istekler
  const reqWrap = document.getElementById('friends-requests-wrap');
  if(reqWrap){
    const inc = st.incoming.map(r => `
      <div class="olympic-row">
        <div class="olympic-avatar">${renderAvatarHtml(r.avatar, 32)}</div>
        <div class="olympic-info">
          <div class="olympic-name">${esc(r.name)}</div>
          <div class="olympic-sub">seni arkadaş olarak eklemek istiyor</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button type="button" class="btn-cheer" style="padding:4px 8px;font-size:11px;" onclick="acceptFriendRequest(${jsArg(r.fp)})">✓ Kabul</button>
          <button type="button" class="btn-cheer" style="padding:4px 8px;font-size:11px;" onclick="rejectFriendRequest(${jsArg(r.fp)})">✕</button>
        </div>
      </div>`).join('');
    const out = st.outgoing.map(o => `
      <div class="olympic-row">
        <div class="olympic-avatar">${renderAvatarHtml('⏳', 32)}</div>
        <div class="olympic-info">
          <div class="olympic-name" style="font-family:monospace;font-size:11px;word-break:break-all;">${esc(o.code)}</div>
          <div class="olympic-sub">${o.pub ? 'İstek gönderildi · onay bekleniyor' : 'Karşı taraf aranıyor · uygulamayı açınca ulaşacak'}</div>
        </div>
        <button type="button" class="btn-cheer" style="padding:4px 8px;font-size:11px;" onclick="cancelFriendRequest(${jsArg(o.fp)})" title="İsteği iptal et">✕</button>
      </div>`).join('');
    reqWrap.innerHTML = (inc || out) ? `
      <div style="font-size:13px;font-weight:800;color:var(--text1);margin:0 0 8px;">📨 Bekleyen İstekler</div>
      <div class="olympic-list-card" style="margin-bottom:14px;">${inc}${out}</div>` : '';
  }

  const entries = st.friends.map(f => ({
    fp: f.fp, name: f.name, avatar: f.avatar, weeklyMinutes: f.weeklyMinutes || 0, trees: f.trees || 0,
    status: f.status, currentTask: f.currentTask, stale: !f.lastProfileTs || (Date.now() - f.lastProfileTs > 7 * 864e5)
  }));
  const selfEntry = { isSelf: true, name: me.name, avatar: me.avatar, weeklyMinutes: me.weeklyMinutes, trees: me.trees };
  const combined = [...entries, selfEntry].sort((a, b) => (b.weeklyMinutes || 0) - (a.weeklyMinutes || 0));
  const userRank = combined.findIndex(x => x.isSelf) + 1;
  if(selfStatsEl) selfStatsEl.textContent = `🏆 Sıralaman: #${userRank} · bu hafta ${formatFriendDuration(me.weeklyMinutes)} · toplam ${me.trees} ağaç`;

  const container = document.getElementById('friends-leaderboard-wrap');
  if(!container) return;

  if(!entries.length){
    container.innerHTML = `
      <div class="olympic-list-card" style="padding:16px;text-align:center;font-size:12px;color:var(--text3);line-height:1.6;">
        Henüz arkadaşın yok.<br>
        Davet kodunu paylaş ya da arkadaşının kodunu “Arkadaş Ekle” ile gir.<br>
        İstek, karşı taraf onaylayınca listeye eklenir.
      </div>`;
    return;
  }

  const podium = (p, rank, medal, size) => p ? `
        <div class="podium-step rank-${rank}">
          <div class="podium-avatar-wrap">
            ${rank === 1 ? '<span class="podium-crown">👑</span>' : ''}
            <div class="podium-avatar">${renderAvatarHtml(p.avatar, size)}</div>
            <span class="podium-medal">${medal}</span>
          </div>
          <div class="podium-name">${esc(p.name)}</div>
          <div class="podium-time">${esc(formatFriendDuration(p.weeklyMinutes))}</div>
          <div class="podium-pedestal">${rank}</div>
        </div>` : `<div class="podium-step rank-${rank}"><div class="podium-pedestal">${rank}</div></div>`;

  const podiumHtml = `
    <div class="olympic-podium-card">
      <div class="olympic-podium-grid">
        ${podium(combined[1], 2, '🥈', 42)}
        ${podium(combined[0], 1, '🥇', 50)}
        ${podium(combined[2], 3, '🥉', 42)}
      </div>
    </div>`;

  const rankIcons = ['🥇', '🥈', '🥉'];
  const rankClasses = ['gold', 'silver', 'bronze'];
  const statusTxt = e => e.status === 'focus' ? `🎯 Odakta${e.currentTask ? ': ' + e.currentTask : ''}` : (e.status === 'break' ? '☕ Molada' : '');

  const rowsHtml = combined.map((e, idx) => `
      <div class="olympic-row ${e.isSelf ? 'is-self' : ''}">
        <div class="olympic-rank-col ${idx < 3 ? rankClasses[idx] : 'normal'}">${idx < 3 ? rankIcons[idx] : '#' + (idx + 1)}</div>
        <div class="olympic-avatar">${renderAvatarHtml(e.avatar, 32)}</div>
        <div class="olympic-info">
          <div class="olympic-name">
            ${esc(e.name)}${e.isSelf ? ' <span style="font-size:10px;color:var(--accent);font-weight:800;margin-left:4px;">(Sen)</span>' : ''}
          </div>
          <div class="olympic-sub">🌳 ${esc(e.trees)} ağaç · bu hafta ${esc(formatFriendDuration(e.weeklyMinutes))}${!e.isSelf && statusTxt(e) ? ' · ' + esc(statusTxt(e)) : ''}${e.stale && !e.isSelf ? ' · henüz veri yok' : ''}</div>
        </div>
        ${!e.isSelf ? `
          <div style="display:flex;gap:4px;align-items:center;">
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Kahve Ismarla" onclick="sendFriendCheer(${jsArg(e.fp)}, '☕')">☕</button>
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Tebrik Et" onclick="sendFriendCheer(${jsArg(e.fp)}, '🙌')">🙌</button>
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Ateşle" onclick="sendFriendCheer(${jsArg(e.fp)}, '🔥')">🔥</button>
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;opacity:.6;" title="Arkadaşlıktan çıkar" onclick="removeFriendConfirm(${jsArg(e.fp)})">✕</button>
          </div>` : `
          <div class="olympic-time-badge">
            <div class="olympic-time-val">${esc(formatFriendDuration(e.weeklyMinutes))}</div>
            <div class="olympic-trees-val">bu hafta</div>
          </div>`}
      </div>`).join('');

  container.innerHTML = `${podiumHtml}<div class="olympic-list-card">${rowsHtml}</div>`;
}

function openAddFriendModal(prefill){
  const m = document.getElementById('add-friend-modal-backdrop');
  if(!m) return;
  m.classList.add('active');
  const modalCode = document.getElementById('modal-my-friend-code');
  if(modalCode) modalCode.textContent = getMyFriendCode();
  const inp = document.getElementById('input-friend-code');
  if(inp){
    inp.value = typeof prefill === 'string' ? prefill : '';
    setTimeout(() => inp.focus(), 150);
  }
}

function closeAddFriendModal(){
  const m = document.getElementById('add-friend-modal-backdrop');
  if(m) m.classList.remove('active');
}

async function addNewFriend(){
  const inp = document.getElementById('input-friend-code');
  if(!inp) return;
  const val = inp.value.trim();
  if(!val){
    showAppToast('Lütfen arkadaşının davet kodunu gir.', '⚠️');
    return;
  }
  const net = await initRealtimeFriends();
  if(!net){
    showAppToast('Arkadaş sistemi bu tarayıcıda çalışmıyor.', '⚠️');
    return;
  }
  const res = await net.addFriendByCode(val, friendIntro());
  if(res.status === 'invalid'){
    showAppToast('Kod hatalı görünüyor. Kopyala-yapıştır ile tekrar dene.', '⚠️');
    return;
  }
  if(res.status === 'self'){
    showAppToast('Kendi davet kodunu ekleyemezsin.', '⚠️');
    return;
  }
  closeAddFriendModal();
  if(res.status === 'already'){
    showAppToast(`${res.friend.name} zaten arkadaş listende.`, 'ℹ️');
  } else if(res.status === 'accepted'){
    showAppToast('Bekleyen isteği kabul ettin, artık arkadaşsınız!', '🎉');
  } else {
    showAppToast(friendTransport && friendTransport.connectedCount() > 0
      ? 'İstek hazırlandı. Arkadaşın onaylayınca listede görünecek.'
      : 'Çevrimdışısın; bağlantı gelince istek otomatik gönderilecek.', '📨');
  }
  renderFriendsLeaderboard();
}

function copyFriendCode(){
  const code = getMyFriendCode();
  const link = getInviteLink();
  const text = `Odak Ajandası davet kodum: ${code}\nYa da bu bağlantıyı aç: ${link}`;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => showAppToast('Davet kodun ve bağlantın kopyalandı', '📋'))
      .catch(() => prompt('Davet kodun:', code));
  } else {
    prompt('Davet kodun:', code);
  }
}

// ?davet=KOD ile açılan bağlantı: arkadaş ekleme penceresini kod dolu açar.
function handleInviteLinkInUrl(){
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('davet');
    if(!code) return;
    params.delete('davet');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    goTo('pg-friends');
    openAddFriendModal(code.slice(0, 64));
  } catch(e){}
}

function syncFriendsNow(){
  if(!friendNet){ initRealtimeFriends(); return; }
  updateFriendsConnStatus();
  if(friendTransport && friendTransport.connectedCount() === 0){
    friendTransport.start();
    showAppToast('Sunuculara yeniden bağlanılıyor…', '🔄');
  } else {
    friendNet.onConnected().then(publishMyLiveProfile);
    showAppToast('Arkadaş verileri yenileniyor…', '🔄');
  }
  renderFriendsLeaderboard();
}
window.syncFriendsNow = syncFriendsNow;
