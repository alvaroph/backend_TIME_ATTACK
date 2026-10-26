import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { Server } from 'socket.io';
import {
  KEYS, MAX_PLAYERS, normaliseJoin, roundTargets,
  durationForTargets, publicRoomState
} from './rules.js';

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // Només per a desenvolupament docent
const rooms = new Map();

const httpServer = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.url === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  } else {
    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Ruta no trobada. Prova /health.' }));
  }
});

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map(s => s.trim()) }
});

const roomChannel = roomCode => `game:${roomCode}`;
const answer = (ack, payload) => { if (typeof ack === 'function') ack(payload); };
const error = (ack, message) => answer(ack, { ok: false, error: message });

function broadcastRoom(room) {
  io.to(roomChannel(room.roomCode)).emit('room:state', publicRoomState(room));
}

function finishRound(room) {
  if (room.phase !== 'playing') return;
  clearTimeout(room.timer);
  room.timer = null;
  room.phase = 'results';
  broadcastRoom(room);
}

function removeFromRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  socket.data.roomCode = null;
  socket.leave(roomChannel(roomCode));
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players.delete(socket.id);
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value ?? null;
  if (room.players.size === 0) {
    clearTimeout(room.timer);
    rooms.delete(roomCode);
  } else {
    broadcastRoom(room);
  }
}

io.on('connection', socket => {
  console.log('Connectat:', socket.id);

  socket.on('room:join', (payload, ack) => {
    const data = normaliseJoin(payload);
    if (!data.ok) return error(ack, data.error);
    if (socket.data.roomCode) return error(ack, 'Ja ets en una sala. Surt abans d’entrar en una altra.');

    let room = rooms.get(data.roomCode);
    if (room && room.phase === 'playing') return error(ack, 'Hi ha una ronda en curs. Torna-hi quan acabi.');
    if (room && room.players.size >= MAX_PLAYERS) return error(ack, 'La sala és plena.');
    if (room && [...room.players.values()].some(p => p.nickname.toLowerCase() === data.nickname.toLowerCase())) {
      return error(ack, 'Aquest nom ja està en ús en aquesta sala.');
    }
    if (!room) {
      room = {
        roomCode: data.roomCode,
        phase: 'lobby', round: 0, hostId: socket.id,
        targets: roundTargets(1), players: new Map(),
        startedAt: null, timer: null
      };
      rooms.set(data.roomCode, room);
    }
    room.players.set(socket.id, { id: socket.id, nickname: data.nickname, presses: new Map() });
    socket.data.roomCode = data.roomCode;
    socket.join(roomChannel(data.roomCode));
    answer(ack, { ok: true, playerId: socket.id, roomCode: data.roomCode });
    broadcastRoom(room);
  });

  socket.on('room:leave', (_payload, ack) => {
    removeFromRoom(socket);
    answer(ack, { ok: true });
  });

  socket.on('round:start', (_payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.players.has(socket.id)) return error(ack, 'No ets dins de cap sala.');
    if (room.hostId !== socket.id) return error(ack, 'Només l’amfitrió pot iniciar la ronda.');
    if (room.phase === 'playing') return error(ack, 'Ja hi ha una ronda en curs.');
    if (room.players.size < 2) return error(ack, 'Calen almenys dos jugadors per començar.');

    room.round += 1;
    room.targets = roundTargets(room.round);
    room.phase = 'playing';
    for (const player of room.players.values()) player.presses = new Map();
    room.startedAt = performance.now();
    room.timer = setTimeout(() => finishRound(room), durationForTargets(room.targets));
    answer(ack, { ok: true, round: room.round });
    broadcastRoom(room);
  });

  socket.on('round:press', (payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.players.has(socket.id)) return error(ack, 'No ets dins de cap sala.');
    if (room.phase !== 'playing') return error(ack, 'La ronda no està en curs.');
    const key = typeof payload?.key === 'string' ? payload.key.toUpperCase() : '';
    if (!KEYS.includes(key)) return error(ack, 'Tecla no vàlida. Fes servir A, S, D o F.');
    const player = room.players.get(socket.id);
    if (player.presses.has(key)) return error(ack, 'Aquesta tecla ja està premuda en aquesta ronda.');

    const elapsedMs = Math.round(performance.now() - room.startedAt);
    if (elapsedMs > durationForTargets(room.targets)) {
      finishRound(room);
      return error(ack, 'La ronda ja ha acabat.');
    }
    // L'hora de la pulsació es calcula exclusivament al servidor.
    player.presses.set(key, { key, elapsedMs });
    answer(ack, { ok: true, key });
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    removeFromRoom(socket);
    console.log('Desconnectat:', socket.id);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`TIME ATTACK escoltant a http://0.0.0.0:${PORT}`);
  console.log(`CORS_ORIGIN=${CORS_ORIGIN}`);
});

process.on('SIGTERM', () => {
  for (const room of rooms.values()) clearTimeout(room.timer);
  httpServer.close(() => process.exit(0));
});
