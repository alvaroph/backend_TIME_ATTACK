export const KEYS = ['A', 'S', 'D', 'F'];
export const MISSED_PENALTY_MS = 3000;
export const GRACE_MS = 2000;
export const MAX_PLAYERS = 10;

// Temps diana en mil·lisegons. Cada ronda aplica la configuració següent.
const PRESETS = [
  [2000, 4000, 5000, 7000],
  [1500, 3500, 6000, 8000],
  [2500, 4000, 6500, 7500],
  [1000, 3000, 4500, 6500]
];

export function roundTargets(roundNumber) {
  const preset = PRESETS[(roundNumber - 1) % PRESETS.length];
  if (!preset) throw new Error('Ronda no vàlida');
  return KEYS.map((key, index) => ({ key, targetMs: preset[index] }));
}

export function durationForTargets(targets) {
  return Math.max(...targets.map(t => t.targetMs)) + GRACE_MS;
}

export function scoreAttempt(elapsedMs, targetMs) {
  // Limitem la penalització perquè no sigui pitjor prémer que ometre una tecla.
  return Math.min(Math.abs(elapsedMs - targetMs), MISSED_PENALTY_MS);
}

export function scorePlayer(presses, targets) {
  const attempts = targets.map(({ key, targetMs }) => {
    const press = presses.find(item => item.key === key);
    return press
      ? { key, targetMs, elapsedMs: press.elapsedMs, errorMs: scoreAttempt(press.elapsedMs, targetMs) }
      : { key, targetMs, elapsedMs: null, errorMs: MISSED_PENALTY_MS };
  });
  return {
    attempts,
    totalErrorMs: attempts.reduce((sum, item) => sum + item.errorMs, 0),
    completed: presses.length
  };
}

export function normaliseJoin(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Dades de sala no vàlides.' };
  }
  const roomCode = String(payload.roomCode ?? '').trim().toUpperCase();
  const nickname = String(payload.nickname ?? '').trim();
  if (!/^[A-Z0-9]{3,8}$/.test(roomCode)) {
    return { ok: false, error: 'El codi de sala ha de tenir entre 3 i 8 lletres o números.' };
  }
  if (nickname.length < 2 || nickname.length > 18 || /[<>]/.test(nickname)) {
    return { ok: false, error: 'El nom ha de tenir entre 2 i 18 caràcters (sense < ni >).' };
  }
  return { ok: true, roomCode, nickname };
}

// La puntuació de la resta de jugadors es revela només en acabar la ronda.
export function publicRoomState(room) {
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    targets: room.targets,
    durationMs: room.targets.length ? durationForTargets(room.targets) : null,
    players: [...room.players.values()].map(player => {
      const presses = [...player.presses.values()];
      const base = {
        id: player.id,
        nickname: player.nickname,
        pressedKeys: presses.map(item => item.key)
      };
      if (room.phase === 'results') {
        return { ...base, ...scorePlayer(presses, room.targets) };
      }
      return base;
    })
  };
}
