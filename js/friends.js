/* ══════════════════════════════════════════════════════
   ARKADAŞLAR (GERÇEK ZAMANLI BULUT SENKRONİZASYON MOTORU)
   ══════════════════════════════════════════════════════ */
let friendsList = JSON.parse(JSON.stringify(DEFAULT_FRIENDS));
let mqttClient = null;
let mqttConnected = false;
let mqttConnecting = false;
let mqttSubscribedTopics = new Set();

function getMyFriendCode(){
  let code = localStorage.getItem('ODAK_MY_FRIEND_CODE');
  if(!code || code === 'ODAK-8429'){
    // Kullanıcıya özel kalıcı 4 haneli benzersiz kod üret (Örn: ODAK-7492)
    const num = Math.floor(1000 + Math.random() * 9000);
    code = 'ODAK-' + num;
    localStorage.setItem('ODAK_MY_FRIEND_CODE', code);
  }
  return code;
}

function getMyLiveProfile(){
  const userStatsList = getUnifiedStatsList().filter(h => !h.failed);
  const userTotalMin = userStatsList.reduce((sum, h) => sum + (h.dur || 0), 0);
  const userTotalTrees = userStatsList.filter(h => h.treeType !== '🥀').length;
  const currentUserName = userProfile.name || (currentUser && currentUser.name) || 'Sen';
  const currentUserAvatar = userProfile.avatar || (currentUser && currentUser.avatar) || '👤';

  return {
    code: getMyFriendCode(),
    name: currentUserName,
    avatar: currentUserAvatar,
    weeklyMinutes: userTotalMin,
    trees: userTotalTrees,
    status: isFocusing ? 'focus' : (isShortBreak ? 'break' : 'idle'),
    currentTask: (isFocusing && activeTask?.title) ? activeTask.title : '',
    updatedAt: Date.now()
  };
}

function getRealFriendsList(){
  const myCode = getMyFriendCode();
  return (friendsList || []).filter(f => f && !f.isSelf && f.id !== 'user_self' && f.code && f.code !== myCode && f.isRealFriend);
}

function initRealtimeFriends(){
  if(typeof Paho === 'undefined' || !Paho.MQTT) {
    setTimeout(initRealtimeFriends, 1200);
    return;
  }
  if(mqttConnected || mqttConnecting) return;
  mqttConnecting = true;

  const myCode = getMyFriendCode();
  const clientId = 'odak_' + myCode.replace(/[^a-zA-Z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 7);

  try {
    mqttClient = new Paho.MQTT.Client('broker.emqx.io', 8084, '/mqtt', clientId);

    mqttClient.onConnectionLost = function(resp){
      mqttConnected = false;
      mqttConnecting = false;
      mqttSubscribedTopics.clear();
      console.log('MQTT bağlantısı koptu, yeniden bağlanılıyor...', resp?.errorMessage);
      setTimeout(initRealtimeFriends, 4000);
    };

    mqttClient.onMessageArrived = function(message){
      handleMqttIncomingMessage(message.destinationName, message.payloadString);
    };

    mqttClient.connect({
      useSSL: true,
      timeout: 8,
      keepAliveInterval: 30,
      cleanSession: true,
      onSuccess: function(){
        mqttConnected = true;
        mqttConnecting = false;
        console.log('⚡ Odak Ajandası Canlı Arkadaş Bulutu Aktif! Kod:', myCode);

        // 1. Kendi eşleşme ve motivasyon kanallarıma abone ol
        subscribeToMqttTopic(`odak/pair/v1/${myCode}`);
        subscribeToMqttTopic(`odak/cheers/v1/${myCode}`);

        // 2. Ekli arkadaşlarımın canlı profillerine abone ol
        const realFriends = getRealFriendsList();
        realFriends.forEach(f => {
          if(f.code) subscribeToMqttTopic(`odak/users/v1/${f.code}`);
        });

        // 3. Kendi güncel profilimi yayınla (Retained)
        publishMyLiveProfile();
      },
      onFailure: function(err){
        mqttConnected = false;
        mqttConnecting = false;
        console.warn('MQTT ilk sunucu başarısız, HiveMQ yedeğine geçiliyor:', err);
        tryHiveMqFallback(myCode, clientId);
      }
    });
  } catch(e){
    mqttConnected = false;
    mqttConnecting = false;
    console.warn('initRealtimeFriends istisna:', e);
  }
}

function tryHiveMqFallback(myCode, clientId){
  try {
    mqttClient = new Paho.MQTT.Client('broker.hivemq.com', 8884, '/mqtt', clientId + '_h');
    mqttClient.onConnectionLost = function(){
      mqttConnected = false;
      mqttConnecting = false;
      setTimeout(initRealtimeFriends, 5000);
    };
    mqttClient.onMessageArrived = function(message){
      handleMqttIncomingMessage(message.destinationName, message.payloadString);
    };
    mqttClient.connect({
      useSSL: true,
      timeout: 8,
      keepAliveInterval: 30,
      cleanSession: true,
      onSuccess: function(){
        mqttConnected = true;
        mqttConnecting = false;
        subscribeToMqttTopic(`odak/pair/v1/${myCode}`);
        subscribeToMqttTopic(`odak/cheers/v1/${myCode}`);
        const realFriends = getRealFriendsList();
        realFriends.forEach(f => {
          if(f.code) subscribeToMqttTopic(`odak/users/v1/${f.code}`);
        });
        publishMyLiveProfile();
      },
      onFailure: function(){
        mqttConnected = false;
        mqttConnecting = false;
        setTimeout(initRealtimeFriends, 6000);
      }
    });
  } catch(e){}
}

function subscribeToMqttTopic(topic){
  if(!mqttClient || !mqttConnected || mqttSubscribedTopics.has(topic)) return;
  try {
    mqttClient.subscribe(topic, { qos: 1 });
    mqttSubscribedTopics.add(topic);
  } catch(e){
    console.warn('MQTT abone olma hatası:', topic, e);
  }
}

function publishMyLiveProfile(){
  if(!mqttClient || !mqttConnected) return;
  const myCode = getMyFriendCode();
  const profile = getMyLiveProfile();
  try {
    const msg = new Paho.MQTT.Message(JSON.stringify(profile));
    msg.destinationName = `odak/users/v1/${myCode}`;
    msg.retained = true;
    msg.qos = 1;
    mqttClient.send(msg);
  } catch(e){
    console.warn('publishMyLiveProfile hata:', e);
  }
}

function handleMqttIncomingMessage(topic, payloadStr){
  const myCode = getMyFriendCode();
  let data = null;
  try { data = JSON.parse(payloadStr); } catch(e){ return; }
  if(!data) return;

  // 1. Bir arkadaşımın güncel profili geldi (odak/users/v1/ODAK-XXXX)
  if(topic.startsWith('odak/users/v1/')){
    const targetCode = topic.replace('odak/users/v1/', '').trim();
    if(targetCode === myCode) return;

    let f = friendsList.find(x => x.code === targetCode);
    let isNew = false;
    if(!f){
      f = {
        id: 'f_' + targetCode,
        code: targetCode,
        name: data.name || `Odak Dostu (${targetCode})`,
        avatar: data.avatar || '🧑‍💻',
        weeklyMinutes: Number(data.weeklyMinutes) || 0,
        trees: Number(data.trees) || 0,
        status: data.status || 'idle',
        currentTask: data.currentTask || '',
        isOnline: true,
        cheersReceived: 0,
        isRealFriend: true
      };
      friendsList.unshift(f);
      isNew = true;
    } else {
      if(data.name) f.name = data.name;
      if(data.avatar) f.avatar = data.avatar;
      if(typeof data.weeklyMinutes === 'number') f.weeklyMinutes = data.weeklyMinutes;
      if(typeof data.trees === 'number') f.trees = data.trees;
      if(data.status) f.status = data.status;
      if(data.currentTask) f.currentTask = data.currentTask;
      f.isOnline = true;
      f.isRealFriend = true;
    }
    saveStateToStorage();
    renderFriendsLeaderboard();
    if(isNew){
      showAppToast(`🎉 ${f.name} (${f.code}) başarıyla bağlandı!`, '🤝');
    }
  }

  // 2. Çift yönlü eşleşme daveti geldi (Arkadaşım beni ekledi)
  else if(topic === `odak/pair/v1/${myCode}`){
    const fromCode = (data.fromCode || '').trim();
    if(!fromCode || fromCode === myCode) return;

    let f = friendsList.find(x => x.code === fromCode);
    let isNew = false;
    if(!f){
      f = {
        id: 'f_' + fromCode,
        code: fromCode,
        name: data.name || `Odak Dostu (${fromCode})`,
        avatar: data.avatar || '🧑‍💻',
        weeklyMinutes: Number(data.weeklyMinutes) || 0,
        trees: Number(data.trees) || 0,
        status: data.status || 'idle',
        currentTask: data.currentTask || '',
        isOnline: true,
        cheersReceived: 0,
        isRealFriend: true
      };
      friendsList.unshift(f);
      isNew = true;
    } else {
      if(data.name) f.name = data.name;
      if(data.avatar) f.avatar = data.avatar;
      if(typeof data.weeklyMinutes === 'number') f.weeklyMinutes = data.weeklyMinutes;
      if(typeof data.trees === 'number') f.trees = data.trees;
      f.isRealFriend = true;
    }

    // Karşı arkadaşımın canlı profiline de abone ol
    subscribeToMqttTopic(`odak/users/v1/${fromCode}`);
    saveStateToStorage();
    renderFriendsLeaderboard();

    // Kendi profilimi de karşıya ilet (anında çift yönlü senkronizasyon)
    publishMyLiveProfile();

    if(isNew){
      showAppToast(`🤝 ${f.name} sizi arkadaş olarak ekledi!`, '🎉');
    }
  }

  // 3. Canlı motivasyon / alkış geldi
  else if(topic === `odak/cheers/v1/${myCode}`){
    const fromName = data.fromName || 'Arkadaşın';
    const emoji = data.emoji || '🔥';
    const messages = {
      '☕': `${fromName} sana sıcak bir çalışma kahvesi ısmarladı! ☕`,
      '🙌': `${fromName} seninle yüksek beşlik çaktı! Harikasın 🙌`,
      '🔥': `${fromName} seni ateşledi! Motivasyon tavan 🔥`
    };
    showAppToast(messages[emoji] || `${fromName} sana motivasyon gönderdi! ${emoji}`, emoji);
    playChimeSound();
  }
}

function renderFriends(){
  renderFriendsLeaderboard();
}

function sendFriendCheer(friendId, cheerEmoji){
  const f = friendsList.find(x => x.id === friendId || x.code === friendId);
  if(!f) return;
  f.cheersReceived = (f.cheersReceived || 0) + 1;

  if(f.code && mqttClient && mqttConnected){
    try {
      const myProfile = getMyLiveProfile();
      const msg = new Paho.MQTT.Message(JSON.stringify({
        fromName: myProfile.name,
        emoji: cheerEmoji
      }));
      msg.destinationName = `odak/cheers/v1/${f.code}`;
      msg.qos = 1;
      mqttClient.send(msg);
    } catch(e){}
  }

  const messages = {
    '☕': `${f.name} için sıcak bir çalışma kahvesi ısmarladın! ☕`,
    '🙌': `${f.name} ile yüksek beşlik çaktın! Harika gidiyorsunuz 🙌`,
    '🔥': `${f.name} arkadaşını ateşledin! Motivasyon tavan 🔥`
  };
  showAppToast(messages[cheerEmoji] || `${f.name}'e motivasyon gönderdin!`, cheerEmoji);
}

function renderFriendsLeaderboard(){
  const myCode = getMyFriendCode();
  const userStatsList = getUnifiedStatsList().filter(h => !h.failed);
  const userTotalMin = userStatsList.reduce((sum, h) => sum + (h.dur || 0), 0);
  const userTotalTrees = userStatsList.filter(h => h.treeType !== '🥀').length;

  const currentUserName = userProfile.name || (currentUser && currentUser.name) || 'Sen';
  const currentUserAvatar = userProfile.avatar || (currentUser && currentUser.avatar) || '👤';

  function formatDuration(mins){
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}s ${m}d` : `${m} dk`;
  }

  // 1. Arkadaşlar ekranının en üstündeki "Senin Profil Kartın"ı anlık güncelle
  const selfAvatarEl = document.getElementById('friends-self-avatar');
  const selfNameEl = document.getElementById('friends-self-name');
  const selfStatsEl = document.getElementById('friends-self-stats');
  const selfCodeEl = document.getElementById('friends-self-code');
  const modalCodeEl = document.getElementById('modal-my-friend-code');
  const settingsCodeEl = document.getElementById('my-friend-code');

  if(selfAvatarEl) selfAvatarEl.innerHTML = renderAvatarHtml(currentUserAvatar, 48);
  if(selfNameEl) selfNameEl.textContent = currentUserName;
  if(selfCodeEl) selfCodeEl.textContent = myCode;
  if(modalCodeEl) modalCodeEl.textContent = myCode;
  if(settingsCodeEl) settingsCodeEl.textContent = myCode;

  const realFriends = (friendsList || []).filter(f => f && !f.isSelf && f.id !== 'user_self' && f.code !== myCode && f.isRealFriend);
  
  // Eğer gerçek bir arkadaş eklenmişse mock arkadaşları gizle, direkt gerçek arkadaşları yarıştır!
  const displayFriends = realFriends.length > 0 
    ? realFriends 
    : (friendsList || []).filter(f => f && !f.isSelf && f.id !== 'user_self');

  const userEntry = {
    id: 'user_self',
    code: myCode,
    name: currentUserName,
    avatar: currentUserAvatar,
    weeklyMinutes: userTotalMin,
    trees: userTotalTrees,
    isSelf: true
  };

  const combined = [...displayFriends, userEntry].sort((a,b) => (b.weeklyMinutes || 0) - (a.weeklyMinutes || 0));
  const userRank = combined.findIndex(x => x.isSelf) + 1;

  if(selfStatsEl) selfStatsEl.textContent = `🏆 Sıralaman: #${userRank} · ${formatDuration(userTotalMin)} · ${userTotalTrees} fidan`;

  const container = document.getElementById('friends-leaderboard-wrap');
  if(!container) return;

  // 2. Görsel Olimpiyat Kürsüsü (2. Gümüş Sol - 1. Altın Orta En Yüksek - 3. Bronz Sağ)
  const p1 = combined[0] || { name: '-', avatar: '🥇', weeklyMinutes: 0, trees: 0 };
  const p2 = combined[1] || { name: '-', avatar: '🥈', weeklyMinutes: 0, trees: 0 };
  const p3 = combined[2] || { name: '-', avatar: '🥉', weeklyMinutes: 0, trees: 0 };

  const podiumHtml = `
    <div class="olympic-podium-card">
      <div class="olympic-podium-grid">
        <!-- 2. Sıra: Gümüş Kürsü (Sol) -->
        <div class="podium-step rank-2">
          <div class="podium-avatar-wrap">
            <div class="podium-avatar">${renderAvatarHtml(p2.avatar, 42)}</div>
            <span class="podium-medal">🥈</span>
          </div>
          <div class="podium-name">${p2.name}</div>
          <div class="podium-time">${formatDuration(p2.weeklyMinutes)}</div>
          <div class="podium-pedestal">2</div>
        </div>

        <!-- 1. Sıra: Altın Kürsü (Orta, En Yüksek & Taçlı) -->
        <div class="podium-step rank-1">
          <div class="podium-avatar-wrap">
            <span class="podium-crown">👑</span>
            <div class="podium-avatar">${renderAvatarHtml(p1.avatar, 50)}</div>
            <span class="podium-medal">🥇</span>
          </div>
          <div class="podium-name">${p1.name}</div>
          <div class="podium-time">${formatDuration(p1.weeklyMinutes)}</div>
          <div class="podium-pedestal">1</div>
        </div>

        <!-- 3. Sıra: Bronz Kürsü (Sağ) -->
        <div class="podium-step rank-3">
          <div class="podium-avatar-wrap">
            <div class="podium-avatar">${renderAvatarHtml(p3.avatar, 42)}</div>
            <span class="podium-medal">🥉</span>
          </div>
          <div class="podium-name">${p3.name}</div>
          <div class="podium-time">${formatDuration(p3.weeklyMinutes)}</div>
          <div class="podium-pedestal">3</div>
        </div>
      </div>
    </div>
  `;

  // 3. Dikey Yukarıdan Aşağıya Doğru Akan Sıralama Listesi (1, 2, 3, 4, 5...)
  const rankIcons = ['🥇', '🥈', '🥉'];
  const rankClasses = ['gold', 'silver', 'bronze'];

  const rowsHtml = combined.map((entry, idx) => {
    const isTop3 = idx < 3;
    const rankTxt = isTop3 ? rankIcons[idx] : `#${idx + 1}`;
    const rankCls = isTop3 ? rankClasses[idx] : 'normal';
    const selfCls = entry.isSelf ? 'is-self' : '';
    const displayNameTxt = entry.isSelf
      ? (entry.name === 'Sen' ? 'Sen' : `${entry.name} <span style="font-size:10px;color:var(--accent);font-weight:800;margin-left:4px;">(Sen)</span>`)
      : entry.name;

    return `
      <div class="olympic-row ${selfCls}">
        <div class="olympic-rank-col ${rankCls}">${rankTxt}</div>
        <div class="olympic-avatar">${renderAvatarHtml(entry.avatar, 32)}</div>
        <div class="olympic-info">
          <div class="olympic-name">
            ${displayNameTxt}
            ${entry.code ? `<span style="font-size:9.5px;color:var(--text3);margin-left:4px;font-family:monospace;">${entry.code}</span>` : ''}
          </div>
          <div class="olympic-sub">🌳 ${entry.trees} fidan · ${formatDuration(entry.weeklyMinutes)} odak</div>
        </div>
        ${!entry.isSelf ? `
          <div style="display:flex;gap:4px;align-items:center;">
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Kahve Ismarla" onclick="sendFriendCheer('${entry.id || entry.code}', '☕')">☕</button>
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Tebrik Et" onclick="sendFriendCheer('${entry.id || entry.code}', '🙌')">🙌</button>
            <button type="button" class="btn-cheer" style="padding:4px 6px;font-size:11px;" title="Ateşle" onclick="sendFriendCheer('${entry.id || entry.code}', '🔥')">🔥</button>
          </div>
        ` : `
          <div class="olympic-time-badge">
            <div class="olympic-time-val">${formatDuration(entry.weeklyMinutes)}</div>
            <div class="olympic-trees-val">senin süren</div>
          </div>
        `}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    ${podiumHtml}
    <div class="olympic-list-card">
      ${rowsHtml}
    </div>
  `;
}

function openAddFriendModal(){
  const m = document.getElementById('add-friend-modal-backdrop');
  if(m){
    m.classList.add('active');
    const myCode = getMyFriendCode();
    const modalCode = document.getElementById('modal-my-friend-code');
    if(modalCode) modalCode.textContent = myCode;
    const inp = document.getElementById('input-friend-code');
    if(inp){
      inp.value = '';
      setTimeout(()=>inp.focus(), 150);
    }
  }
}

function closeAddFriendModal(){
  const m = document.getElementById('add-friend-modal-backdrop');
  if(m) m.classList.remove('active');
}

function addNewFriend(){
  const inp = document.getElementById('input-friend-code');
  if(!inp) return;
  let val = inp.value.trim().toUpperCase();
  if(!val){
    showAppToast('Lütfen arkadaşınızın davet kodunu girin.', '⚠️');
    return;
  }

  // ODAK- önekini otomatik tamamla
  if(!val.startsWith('ODAK-') && /^[0-9A-Z]+$/.test(val)){
    val = 'ODAK-' + val;
  }

  const myCode = getMyFriendCode();
  if(val === myCode){
    showAppToast('Kendi davet kodunuzu arkadaş olarak ekleyemezsiniz.', '⚠️');
    return;
  }

  // Zaten ekli mi kontrol et
  const existing = friendsList.find(x => x.code === val);
  if(existing && existing.isRealFriend){
    showAppToast(`${existing.name} zaten arkadaş listenizde ekli!`, 'ℹ️');
    closeAddFriendModal();
    return;
  }

  // 1. Modalı kapat ve bilgi ver
  closeAddFriendModal();
  showAppToast(`${val} aranıyor ve bağlanılıyor... ⏳`, '🔍');

  // 2. Hedef arkadaşın profiline abone ol
  subscribeToMqttTopic(`odak/users/v1/${val}`);

  // 3. Karşı tarafa çift yönlü eşleşme daveti gönder
  if(mqttClient && mqttConnected){
    const myProfile = getMyLiveProfile();
    try {
      const pairMsg = new Paho.MQTT.Message(JSON.stringify({
        fromCode: myCode,
        name: myProfile.name,
        avatar: myProfile.avatar,
        weeklyMinutes: myProfile.weeklyMinutes,
        trees: myProfile.trees,
        status: myProfile.status,
        currentTask: myProfile.currentTask
      }));
      pairMsg.destinationName = `odak/pair/v1/${val}`;
      pairMsg.qos = 1;
      mqttClient.send(pairMsg);
    } catch(err){
      console.warn('Pairing mesajı gönderilemedi:', err);
    }
  }

  // 4. Geçici bekleme kartı oluştur (broker veriyi getirdiği an hemen güncellenecek)
  if(!existing){
    const provisionalFriend = {
      id: 'f_' + val,
      code: val,
      name: `Odak Dostu (${val})`,
      avatar: '🧑‍💻',
      weeklyMinutes: 0,
      trees: 0,
      status: 'idle',
      currentTask: 'Bağlanıyor...',
      isOnline: true,
      cheersReceived: 0,
      isRealFriend: true
    };
    friendsList.unshift(provisionalFriend);
    saveStateToStorage();
    renderFriendsLeaderboard();
  }
}

function copyFriendCode(){
  const code = getMyFriendCode();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(()=>{
      showAppToast(`Davet kodun kopyalandı: ${code}`, '📋');
    }).catch(()=>{
      showAppToast(`Davet Kodun: ${code}`, '📋');
    });
  } else {
    showAppToast(`Davet Kodun: ${code}`, '📋');
  }
}

function syncFriendsNow(){
  showAppToast('Arkadaş sıralaması eşitleniyor... 🔄', '⚡');
  if(!mqttConnected){
    initRealtimeFriends();
  } else {
    publishMyLiveProfile();
    const list = getRealFriendsList();
    list.forEach(f => {
      if(f.code) subscribeToMqttTopic(`odak/users/v1/${f.code}`);
    });
  }
  renderFriendsLeaderboard();
}
window.syncFriendsNow = syncFriendsNow;
