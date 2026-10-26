// Test bàsic de connexió real, amb el servidor ja en marxa.
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const address = process.env.SERVER_URL || 'http://localhost:3000';
const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const clients = [io(address, { autoConnect: false }), io(address, { autoConnect: false })];
function onceState(client, matcher, timeoutMs = 14000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off('room:state', handler); reject(new Error('No arriba room:state')); }, timeoutMs);
    function handler(state) {
      if (!matcher(state)) return;
      clearTimeout(timer); client.off('room:state', handler); resolve(state);
    }
    client.on('room:state', handler);
  });
}
async function send(client, event, payload = {}) {
  const data = await client.timeout(5000).emitWithAck(event, payload);
  assert.equal(data.ok, true, `${event}: ${data.error}`);
  return data;
}
try {
  await Promise.all(clients.map(client => new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
    client.connect();
  })));
  await send(clients[0], 'room:join', { roomCode: code, nickname: 'Anna' });
  await send(clients[1], 'room:join', { roomCode: code, nickname: 'Marc' });
  const live = onceState(clients[1], state => state.phase === 'playing');
  await send(clients[0], 'round:start');
  await live;
  await sleep(100);
  await send(clients[0], 'round:press', { key: 'A' });
  const duplicate = await clients[0].timeout(5000).emitWithAck('round:press', { key: 'A' });
  assert.equal(duplicate.ok, false);
  const results = await onceState(clients[1], state => state.phase === 'results');
  assert.equal(results.players.length, 2);
  assert.equal(results.players[0].attempts.length, 4);
  console.log('OK: connexió, sala, partida, acció, duplicat i resultats.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  clients.forEach(client => client.disconnect());
}
