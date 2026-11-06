// Testler için yerel MQTT-over-WebSocket broker (aedes). İnternet gerekmez.
const http = require('http');

async function startLocalBroker() {
  const { Aedes } = await import('aedes').catch(() => ({ Aedes: null }));
  const aedes = Aedes ? await Aedes.createBroker() : require('aedes')();
  const { WebSocketServer, createWebSocketStream } = require('ws');
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: '/mqtt' });
  wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const published = [];
  aedes.on('publish', (packet, client) => { if (client) published.push({ topic: packet.topic, payload: packet.payload.toString() }); });
  return {
    port: server.address().port,
    published,
    close: () => new Promise(r => { wss.close(); aedes.close(() => server.close(() => r())); })
  };
}

module.exports = { startLocalBroker };
