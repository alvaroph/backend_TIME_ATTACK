import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundTargets, durationForTargets, scoreAttempt, scorePlayer,
  normaliseJoin, publicRoomState
} from '../src/rules.js';

test('La ronda 1 usa A=2s, S=4s, D=5s, F=7s', () => {
  assert.deepEqual(roundTargets(1), [
    { key: 'A', targetMs: 2000 }, { key: 'S', targetMs: 4000 },
    { key: 'D', targetMs: 5000 }, { key: 'F', targetMs: 7000 }
  ]);
  assert.equal(durationForTargets(roundTargets(1)), 9000);
});

test('Els intervals canvien entre rondes i són cíclics', () => {
  assert.notDeepEqual(roundTargets(1), roundTargets(2));
  assert.deepEqual(roundTargets(1), roundTargets(5));
});

test('L’error és la diferència absoluta i està acotat a 3000ms', () => {
  assert.equal(scoreAttempt(2180, 2000), 180);
  assert.equal(scoreAttempt(1830, 2000), 170);
  assert.equal(scoreAttempt(9000, 2000), 3000);
});

test('Les tecles no premudes penalitzen', () => {
  const score = scorePlayer([{ key: 'A', elapsedMs: 2180 }], roundTargets(1));
  assert.equal(score.totalErrorMs, 9180);
  assert.equal(score.completed, 1);
  assert.equal(score.attempts.length, 4);
});

test('Validació del codi i el nom', () => {
  assert.deepEqual(normaliseJoin({ roomCode: 'daw1', nickname: 'Anna' }),
    { ok: true, roomCode: 'DAW1', nickname: 'Anna' });
  assert.equal(normaliseJoin({ roomCode: '!', nickname: 'A' }).ok, false);
});

test('Els errors són secrets mentre la ronda està activa', () => {
  const player = { id: 'abc', nickname: 'Anna', presses: new Map([['A', { key: 'A', elapsedMs: 2050 }]]) };
  const room = { roomCode: 'DAW1', phase: 'playing', round: 1, hostId: 'abc', targets: roundTargets(1), players: new Map([['abc', player]]) };
  const playing = publicRoomState(room).players[0];
  assert.deepEqual(playing.pressedKeys, ['A']);
  assert.equal(playing.totalErrorMs, undefined);
  assert.equal(playing.attempts, undefined);
  room.phase = 'results';
  const results = publicRoomState(room).players[0];
  assert.equal(results.totalErrorMs, 9050);
  assert.equal(results.attempts[0].elapsedMs, 2050);
});
