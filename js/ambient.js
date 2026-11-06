/* ══════════════════════════════════════════════════════
   1. AMBİYANS ARKA PLAN SESLERİ (GERÇEK ALAN KAYITLARI & OTOMATİK YEDEK)
   ══════════════════════════════════════════════════════ */
let ambientAudioCtx = null;
let currentAmbientType = 'off';
let ambientGainNode = null;
let ambientNodes = [];
let ambientTimers = [];
let ambientAudioEl = null;
let ambientFadeTimer = null;

const AMBIENT_SOUND_FILES = {
  rain: ['sounds/rain.m4a', 'sounds/rain.mp3'],
  cafe: ['sounds/cafe.m4a', 'sounds/cafe.mp3'],
  forest: ['sounds/forest.m4a', 'sounds/forest.mp3'],
  waves: ['sounds/waves.m4a', 'sounds/waves.mp3']
};

const AMBIENT_VOLUMES = {
  rain: 0.55,
  cafe: 0.65,
  forest: 0.60,
  waves: 0.65
};

const AMBIENT_TOASTS = {
  rain: '🌧️ Doğal Yağmur & Su Damlaları Başlatıldı',
  cafe: '☕ Canlı Kafe Ortamı & İnsan Uğultusu Başlatıldı',
  forest: '🌲 Orman Esintisi & Melodik Kuş Cıvıltıları Başlatıldı',
  waves: '🌊 Kıyıya Vuran Rahatlatıcı Dalga Sesi Başlatıldı'
};

function initAmbientAudio(){
  if(!ambientAudioCtx){
    ambientAudioCtx = getAppAudioContext();
  }
  if(ambientAudioCtx && ambientAudioCtx.state === 'suspended'){
    ambientAudioCtx.resume().catch(()=>{});
  }
  return ambientAudioCtx;
}

function clearAmbientTimers(){
  ambientTimers.forEach(t => {
    clearInterval(t);
    clearTimeout(t);
  });
  ambientTimers = [];
}

function stopProceduralAmbient(){
  clearAmbientTimers();
  ambientNodes.forEach(node => {
    try { node.stop(); } catch(e){}
    try { node.disconnect(); } catch(e){}
  });
  ambientNodes = [];
  if(ambientGainNode){
    try { ambientGainNode.disconnect(); } catch(e){}
    ambientGainNode = null;
  }
}

function stopAmbientSound(){
  clearAmbientTimers();
  if(ambientFadeTimer){
    clearInterval(ambientFadeTimer);
    ambientFadeTimer = null;
  }
  if(ambientAudioEl){
    const a = ambientAudioEl;
    let vol = a.volume;
    const fadeOutStep = vol / 8;
    const fadeOutInt = setInterval(() => {
      vol = Math.max(0, vol - fadeOutStep);
      try { a.volume = vol; } catch(e){}
      if(vol <= 0.02){
        clearInterval(fadeOutInt);
        try { a.pause(); a.currentTime = 0; } catch(e){}
        if(typeof isFocusing !== 'undefined' && isFocusing && typeof ensureLockScreenAudio === 'function'){
          ensureLockScreenAudio();
        }
      }
    }, 25);
  }
  stopProceduralAmbient();
  currentAmbientType = 'off';
  if(typeof isFocusing !== 'undefined' && isFocusing && typeof ensureLockScreenAudio === 'function'){
    ensureLockScreenAudio();
  }
  ['off','rain','cafe','forest','waves'].forEach(t => {
    const btn = document.getElementById('amb-btn-' + t);
    if(btn) btn.classList.toggle('active', t === 'off');
  });
}

function toggleAmbientSound(type){
  if(currentAmbientType === type || type === 'off'){
    stopAmbientSound();
    return;
  }

  // Önceki sesi durdur
  if(ambientFadeTimer){
    clearInterval(ambientFadeTimer);
    ambientFadeTimer = null;
  }
  if(ambientAudioEl){
    try { ambientAudioEl.pause(); ambientAudioEl.currentTime = 0; } catch(e){}
  }
  if(typeof backgroundSilenceAudio !== 'undefined' && backgroundSilenceAudio){
    try { backgroundSilenceAudio.pause(); } catch(e){}
  }
  stopProceduralAmbient();

  currentAmbientType = type;
  ['off','rain','cafe','forest','waves'].forEach(t => {
    const btn = document.getElementById('amb-btn-' + t);
    if(btn) btn.classList.toggle('active', t === type);
  });

  if(AMBIENT_TOASTS[type]){
    showAppToast(AMBIENT_TOASTS[type], '🎧');
  }

  // 1. Gerçek Saha / Stüdyo Kaydı ile Oynat
  const sources = AMBIENT_SOUND_FILES[type] || [];
  let sourceIndex = 0;

  if(!ambientAudioEl){
    ambientAudioEl = new Audio();
    ambientAudioEl.loop = true;
    ambientAudioEl.crossOrigin = 'anonymous';
  }

  const tryPlayRealAudio = () => {
    if(sourceIndex >= sources.length){
      // Gerçek dosya yüklenemezse procedural Web Audio motoruna otomatik geç
      console.warn('Dosya yüklenemedi, procedural Web Audio sentezine geçiliyor...');
      startProceduralAmbient(type);
      return;
    }

    const nextSrc = sources[sourceIndex];
    ambientAudioEl.src = nextSrc;
    ambientAudioEl.volume = 0;
    ambientAudioEl.loop = true;

    const playPromise = ambientAudioEl.play();
    if(playPromise !== undefined){
      playPromise.then(() => {
        // Yumuşak ses yükselmesi (Fade-in)
        const targetVol = AMBIENT_VOLUMES[type] || 0.6;
        let curVol = 0;
        const step = targetVol / 15;
        ambientFadeTimer = setInterval(() => {
          curVol = Math.min(targetVol, curVol + step);
          try { ambientAudioEl.volume = curVol; } catch(e){}
          if(curVol >= targetVol){
            clearInterval(ambientFadeTimer);
            ambientFadeTimer = null;
          }
        }, 30);
      }).catch(err => {
        console.warn('Gerçek ses kaynağı hata verdi, yedek kaynak deneniyor:', nextSrc, err);
        sourceIndex++;
        tryPlayRealAudio();
      });
    }
  };

  ambientAudioEl.onerror = () => {
    sourceIndex++;
    tryPlayRealAudio();
  };

  tryPlayRealAudio();
}

function startProceduralAmbient(type){
  const ctx = initAmbientAudio();
  if(!ctx) return;

  const now = ctx.currentTime;
  ambientGainNode = ctx.createGain();
  ambientGainNode.gain.setValueAtTime(0.01, now);
  ambientGainNode.gain.linearRampToValueAtTime(0.24, now + 0.8);
  ambientGainNode.connect(ctx.destination);

  if(type === 'rain'){
    // 🌧️ 1. YAĞMUR: Sürekli yağmur fonu + Organik prosedürel su damlaları ("şıp-pıt-tink")
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;
    for(let i = 0; i < bufferSize; i++){
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;
      b0L = 0.99886 * b0L + whiteL * 0.0555;
      b1L = 0.99332 * b1L + whiteL * 0.0750;
      b2L = 0.96900 * b2L + whiteL * 0.1538;
      b0R = 0.99886 * b0R + whiteR * 0.0555;
      b1R = 0.99332 * b1R + whiteR * 0.0750;
      b2R = 0.96900 * b2R + whiteR * 0.1538;
      leftData[i] = (b0L + b1L + b2L + whiteL * 0.4) * 0.28;
      rightData[i] = (b0R + b1R + b2R + whiteR * 0.4) * 0.28;
    }

    const rainBed = ctx.createBufferSource();
    rainBed.buffer = buffer;
    rainBed.loop = true;

    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.setValueAtTime(320, now);

    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.setValueAtTime(2800, now);

    rainBed.connect(rainHp);
    rainHp.connect(rainLp);
    rainLp.connect(ambientGainNode);
    rainBed.start();
    ambientNodes.push(rainBed);

    // Gerçekçi Yağmur Damlaları (Yüzeye çarpan su damlası frekans eğrisi)
    const triggerRainDrop = () => {
      if(currentAmbientType !== 'rain') return;
      try {
        const dropTime = ctx.currentTime;
        const startFreq = 1600 + Math.random() * 1200; // 1600Hz - 2800Hz
        const endFreq = 700 + Math.random() * 600;     // Hızlıca 700Hz - 1300Hz'e düşer
        const dropDur = 0.035 + Math.random() * 0.045; // 35ms - 80ms damla rezonansı

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, dropTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, dropTime + dropDur);

        const dropGain = ctx.createGain();
        const dropVol = 0.045 + Math.random() * 0.075;
        dropGain.gain.setValueAtTime(0.001, dropTime);
        dropGain.gain.linearRampToValueAtTime(dropVol, dropTime + 0.003);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, dropTime + dropDur);

        const dropFilter = ctx.createBiquadFilter();
        dropFilter.type = 'bandpass';
        dropFilter.frequency.setValueAtTime(startFreq * 0.85, dropTime);
        dropFilter.Q.setValueAtTime(9, dropTime);

        osc.connect(dropFilter);
        dropFilter.connect(dropGain);
        dropGain.connect(ambientGainNode);

        osc.start(dropTime);
        osc.stop(dropTime + dropDur + 0.01);
      } catch(e){}

      const nextDelay = 65 + Math.random() * 175;
      const tid = setTimeout(triggerRainDrop, nextDelay);
      ambientTimers.push(tid);
    };

    triggerRainDrop();

  } else if(type === 'cafe'){
    // ☕ 2. KAFE: İnsan konuşma uğultusu (Formant speech babble) + Sıcak oda tonu + Porselen fincan/kaşık tıkırtıları
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;
    for(let i = 0; i < bufferSize; i++){
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      b0L = 0.99886 * b0L + wL * 0.0555;
      b1L = 0.99332 * b1L + wL * 0.0750;
      b2L = 0.96900 * b2L + wL * 0.1538;
      b0R = 0.99886 * b0R + wR * 0.0555;
      b1R = 0.99332 * b1R + wR * 0.0750;
      b2R = 0.96900 * b2R + wR * 0.1538;
      leftData[i] = (b0L + b1L + b2L) * 0.45;
      rightData[i] = (b0R + b1R + b2R) * 0.45;
    }

    // Sıcak oda havası tabanı
    const roomBed = ctx.createBufferSource();
    roomBed.buffer = buffer;
    roomBed.loop = true;

    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.setValueAtTime(450, now);
    roomBed.connect(roomLp);
    roomLp.connect(ambientGainNode);
    roomBed.start();
    ambientNodes.push(roomBed);

    // İnsan Konuşma Uğultusu & Kalabalık Mırıltısı (İnsan ses telleri formant rezonansları)
    const formants = [
      { freq: 480, q: 5.5, lfoRate: 2.2, gain: 0.20 },
      { freq: 880, q: 6.0, lfoRate: 3.0, gain: 0.16 },
      { freq: 1450, q: 5.0, lfoRate: 1.9, gain: 0.13 },
      { freq: 2200, q: 4.5, lfoRate: 2.6, gain: 0.10 }
    ];

    formants.forEach(fmt => {
      const babbleNoise = ctx.createBufferSource();
      babbleNoise.buffer = buffer;
      babbleNoise.loop = true;

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(fmt.freq, now);
      bpFilter.Q.setValueAtTime(fmt.q, now);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(fmt.lfoRate, now);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(fmt.gain * 0.5, now);
      lfo.connect(lfoGain);

      const babbleGain = ctx.createGain();
      babbleGain.gain.setValueAtTime(fmt.gain, now);
      lfoGain.connect(babbleGain.gain);

      babbleNoise.connect(bpFilter);
      bpFilter.connect(babbleGain);
      babbleGain.connect(ambientGainNode);

      babbleNoise.start();
      lfo.start();
      ambientNodes.push(babbleNoise, lfo);
    });

    // Porselen Fincan ve Kaşık Tıkırtıları (Her 3-7 saniyede bir doğal kafe sesi)
    const scheduleCupClink = () => {
      if(currentAmbientType !== 'cafe') return;
      try {
        const clinkTime = ctx.currentTime;
        const fundamental = 2800 + Math.random() * 900;
        const harmonic = fundamental * 1.85;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(fundamental, clinkTime);
        osc2.frequency.setValueAtTime(harmonic, clinkTime);

        const clinkGain = ctx.createGain();
        const vol = 0.028 + Math.random() * 0.038;
        clinkGain.gain.setValueAtTime(0.001, clinkTime);
        clinkGain.gain.linearRampToValueAtTime(vol, clinkTime + 0.002);
        clinkGain.gain.exponentialRampToValueAtTime(0.0001, clinkTime + 0.12);

        osc1.connect(clinkGain);
        osc2.connect(clinkGain);
        clinkGain.connect(ambientGainNode);

        osc1.start(clinkTime);
        osc2.start(clinkTime);
        osc1.stop(clinkTime + 0.15);
        osc2.stop(clinkTime + 0.15);
      } catch(e){}

      const nextClink = 3400 + Math.random() * 4200;
      const tid = setTimeout(scheduleCupClink, nextClink);
      ambientTimers.push(tid);
    };

    const firstClinkTid = setTimeout(scheduleCupClink, 1800);
    ambientTimers.push(firstClinkTid);

  } else if(type === 'forest'){
    // 🌲 3. ORMAN: Rüzgar ve dal hışırtısı + Gerçekçi melodik kuş cıvıltıları
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    for(let i = 0; i < bufferSize; i++){
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      leftData[i] = wL * 0.35;
      rightData[i] = wR * 0.35;
    }
    const leafNoise = ctx.createBufferSource();
    leafNoise.buffer = buffer;
    leafNoise.loop = true;

    // Yaprak hışırtısı bandı (1400Hz - 3600Hz)
    const leafBp = ctx.createBiquadFilter();
    leafBp.type = 'bandpass';
    leafBp.frequency.setValueAtTime(2200, now);
    leafBp.Q.setValueAtTime(2.2, now);

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.18, now);
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(900, now);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(leafBp.frequency);

    const rustleLfo = ctx.createOscillator();
    rustleLfo.type = 'sine';
    rustleLfo.frequency.setValueAtTime(1.6, now);
    const rustleLfoGain = ctx.createGain();
    rustleLfoGain.gain.setValueAtTime(0.05, now);
    rustleLfo.connect(rustleLfoGain);

    const leafGain = ctx.createGain();
    leafGain.gain.setValueAtTime(0.13, now);
    rustleLfoGain.connect(leafGain.gain);

    leafNoise.connect(leafBp);
    leafBp.connect(leafGain);
    leafGain.connect(ambientGainNode);

    leafNoise.start();
    windLfo.start();
    rustleLfo.start();
    ambientNodes.push(leafNoise, windLfo, rustleLfo);

    // Doğal Kuş Cıvıltıları (Bülbül, serçe trili ve orman ıslığı motifleri)
    const playBirdCall = () => {
      if(currentAmbientType !== 'forest') return;
      try {
        const birdTime = ctx.currentTime;
        const birdPattern = Math.floor(Math.random() * 3);

        if(birdPattern === 0){
          // İkili ötüş (Bülbül cıvıltısı: "cik-cik!")
          const osc1 = ctx.createOscillator();
          const g1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(3200, birdTime);
          osc1.frequency.exponentialRampToValueAtTime(4400, birdTime + 0.05);
          osc1.frequency.exponentialRampToValueAtTime(3600, birdTime + 0.09);
          g1.gain.setValueAtTime(0.001, birdTime);
          g1.gain.linearRampToValueAtTime(0.095, birdTime + 0.01);
          g1.gain.exponentialRampToValueAtTime(0.001, birdTime + 0.09);
          osc1.connect(g1);
          g1.connect(ambientGainNode);
          osc1.start(birdTime);
          osc1.stop(birdTime + 0.1);

          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(3600, birdTime + 0.13);
          osc2.frequency.exponentialRampToValueAtTime(4800, birdTime + 0.18);
          osc2.frequency.exponentialRampToValueAtTime(3100, birdTime + 0.23);
          g2.gain.setValueAtTime(0.001, birdTime + 0.13);
          g2.gain.linearRampToValueAtTime(0.085, birdTime + 0.15);
          g2.gain.exponentialRampToValueAtTime(0.001, birdTime + 0.23);
          osc2.connect(g2);
          g2.connect(ambientGainNode);
          osc2.start(birdTime + 0.13);
          osc2.stop(birdTime + 0.25);

        } else if(birdPattern === 1){
          // Üçlü hızlı tril (Serçe / Saka cıvıltısı)
          for(let k = 0; k < 3; k++){
            const tOffset = birdTime + k * 0.055;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const baseF = 3900 + k * 250;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseF, tOffset);
            osc.frequency.exponentialRampToValueAtTime(baseF + 600, tOffset + 0.02);
            osc.frequency.exponentialRampToValueAtTime(baseF - 400, tOffset + 0.045);
            g.gain.setValueAtTime(0.001, tOffset);
            g.gain.linearRampToValueAtTime(0.075, tOffset + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, tOffset + 0.045);
            osc.connect(g);
            g.connect(ambientGainNode);
            osc.start(tOffset);
            osc.stop(tOffset + 0.05);
          }
        } else {
          // Melodik orman ıslığı
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2600, birdTime);
          osc.frequency.exponentialRampToValueAtTime(3300, birdTime + 0.1);
          osc.frequency.exponentialRampToValueAtTime(2800, birdTime + 0.22);
          g.gain.setValueAtTime(0.001, birdTime);
          g.gain.linearRampToValueAtTime(0.08, birdTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, birdTime + 0.22);
          osc.connect(g);
          g.connect(ambientGainNode);
          osc.start(birdTime);
          osc.stop(birdTime + 0.25);
        }
      } catch(e){}

      const nextDelay = 2600 + Math.random() * 2900;
      const tid = setTimeout(playBirdCall, nextDelay);
      ambientTimers.push(tid);
    };

    const firstBirdTid = setTimeout(playBirdCall, 1200);
    ambientTimers.push(firstBirdTid);

  } else if(type === 'waves'){
    // 🌊 4. DALGA: Sahile ve kıyıya vuran dalga sesi, köpük hışırtısı ve geri çekilme
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;
    for(let i = 0; i < bufferSize; i++){
      const wL = Math.random() * 2 - 1;
      const wR = Math.random() * 2 - 1;
      b0L = 0.99886 * b0L + wL * 0.0555;
      b1L = 0.99332 * b1L + wL * 0.0750;
      b2L = 0.96900 * b2L + wL * 0.1538;
      b0R = 0.99886 * b0R + wR * 0.0555;
      b1R = 0.99332 * b1R + wR * 0.0750;
      b2R = 0.96900 * b2R + wR * 0.1538;
      leftData[i] = (b0L + b1L + b2L) * 0.55;
      rightData[i] = (b0R + b1R + b2R) * 0.55;
    }

    const oceanNoise = ctx.createBufferSource();
    oceanNoise.buffer = buffer;
    oceanNoise.loop = true;

    const oceanLp = ctx.createBiquadFilter();
    oceanLp.type = 'lowpass';
    oceanLp.frequency.setValueAtTime(220, now);

    const oceanGain = ctx.createGain();
    oceanGain.gain.setValueAtTime(0.18, now);

    oceanNoise.connect(oceanLp);
    oceanLp.connect(oceanGain);
    oceanGain.connect(ambientGainNode);
    oceanNoise.start();
    ambientNodes.push(oceanNoise);

    // Kıyıya Vuran ve Sahilde Kırılan Dalga Döngüsü (Surf crash & wash)
    const playCrashingWave = () => {
      if(currentAmbientType !== 'waves') return;
      try {
        const waveTime = ctx.currentTime;
        const waveDur = 6.8 + Math.random() * 1.6;  // 6.8s - 8.4s tam dalga süresi
        const swellDur = 2.4 + Math.random() * 0.6; // 2.4s toplanma ve kıyıya yaklaşma
        const crashPeak = waveTime + swellDur;

        const surfNoise = ctx.createBufferSource();
        surfNoise.buffer = buffer;
        surfNoise.loop = true;

        const surfFilter = ctx.createBiquadFilter();
        surfFilter.type = 'bandpass';
        surfFilter.Q.setValueAtTime(1.8, waveTime);

        // Dalga kabarırken frekans yükselir, kıyıya çarpınca 3200Hz köpük patlaması yapar, sahile yayılırken söner
        surfFilter.frequency.setValueAtTime(250, waveTime);
        surfFilter.frequency.exponentialRampToValueAtTime(3200, crashPeak);
        surfFilter.frequency.exponentialRampToValueAtTime(600, waveTime + waveDur * 0.75);
        surfFilter.frequency.exponentialRampToValueAtTime(180, waveTime + waveDur);

        const surfGain = ctx.createGain();
        surfGain.gain.setValueAtTime(0.001, waveTime);
        // Kabarma
        surfGain.gain.linearRampToValueAtTime(0.14, crashPeak - 0.3);
        // Kıyıya çarpma ve köpürme zirvesi (Crash!)
        surfGain.gain.linearRampToValueAtTime(0.26, crashPeak);
        // Sahile yayılma ve köpüğün geri çekilmesi (Backwash)
        surfGain.gain.exponentialRampToValueAtTime(0.05, waveTime + waveDur * 0.65);
        surfGain.gain.exponentialRampToValueAtTime(0.001, waveTime + waveDur);

        surfNoise.connect(surfFilter);
        surfFilter.connect(surfGain);
        surfGain.connect(ambientGainNode);

        surfNoise.start(waveTime);
        surfNoise.stop(waveTime + waveDur + 0.1);

        // Okyanus taban uğultusunu da dalgayla birlikte senkronize kabart
        oceanLp.frequency.setValueAtTime(180, waveTime);
        oceanLp.frequency.linearRampToValueAtTime(450, crashPeak);
        oceanLp.frequency.exponentialRampToValueAtTime(180, waveTime + waveDur);
      } catch(e){}

      const nextWaveDelay = 5800 + Math.random() * 1800;
      const tid = setTimeout(playCrashingWave, nextWaveDelay);
      ambientTimers.push(tid);
    };

    playCrashingWave();
  }
}
