// Testler için bellek içi MQTT benzeri broker: retained mesaj, + ve # joker karakterleri.
function matches(filter, topic) {
  const f = filter.split('/'), t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

class FakeBroker {
  constructor() { this.clients = new Set(); this.retained = new Map(); this.log = []; }
  connect(onMessage) {
    const broker = this;
    const client = {
      subs: new Set(), onMessage, queue: Promise.resolve(),
      subscribe(filter) {
        client.subs.add(filter);
        for (const [topic, payload] of broker.retained) if (matches(filter, topic)) client._deliver(topic, payload);
      },
      unsubscribe(filter) { client.subs.delete(filter); },
      publish(topic, payload, retained) { broker._publish(topic, payload, retained); },
      _deliver(topic, payload) { client.queue = client.queue.then(() => client.onMessage(topic, payload)); }
    };
    this.clients.add(client);
    return client;
  }
  _publish(topic, payload, retained) {
    this.log.push({ topic, payload, retained });
    if (retained) { if (payload === '') this.retained.delete(topic); else this.retained.set(topic, payload); }
    if (payload === '') return;
    for (const c of this.clients) for (const f of c.subs) if (matches(f, topic)) { c._deliver(topic, payload); break; }
  }
  async settle() {
    // Tüm istemci kuyrukları boşalana kadar bekle (mesajlar yeni mesaj doğurabilir)
    for (let i = 0; i < 50; i++) {
      const before = this.log.length;
      await Promise.all([...this.clients].map(c => c.queue));
      await new Promise(r => setTimeout(r, 0));
      if (this.log.length === before) return;
    }
  }
}

function memoryStorage() {
  const m = new Map();
  return { get: k => (m.has(k) ? JSON.parse(m.get(k)) : null), set: (k, v) => m.set(k, JSON.stringify(v)) };
}

module.exports = { FakeBroker, memoryStorage, matches };
