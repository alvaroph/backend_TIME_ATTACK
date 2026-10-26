# Contracte Socket.IO — TIME ATTACK (servidor lliurat)

Socket.IO v4 · URI per defecte: `http://localhost:3000` · sense autenticació (entorn docent).

## Client → servidor

Els esdeveniments de client retornen un *acknowledgement* amb `{ ok: true, ... }` o `{ ok: false, error: '...' }`.

| Event | Payload | Resposta d'èxit | Notes |
|---|---|---|---|
| `room:join` | `{ roomCode: 'DAW1', nickname: 'Anna' }` | `{ok:true, playerId:'...', roomCode:'DAW1'}` | Crea la sala si no existeix, amb l'amfitrió com a primer membre. |
| `room:leave` | `{}` | `{ok:true}` | Surt voluntàriament. |
| `round:start` | `{}` | `{ok:true, round:1}` | Només amfitrió i almenys 2 participants. |
| `round:press` | `{key:'A'}` | `{ok:true, key:'A'}` | Una vegada per tecla i ronda, només durant `playing`. |

## Servidor → client

**`room:state`**: s'envia als participants de la sala quan algú entra, surt, prem una tecla, comença o finalitza una ronda.

### Exemple d'estat durant una ronda

```json
{
  "roomCode": "DAW1",
  "phase": "playing",
  "round": 1,
  "hostId": "id-anna",
  "targets": [
    { "key": "A", "targetMs": 2000 },
    { "key": "S", "targetMs": 4000 },
    { "key": "D", "targetMs": 5000 },
    { "key": "F", "targetMs": 7000 }
  ],
  "durationMs": 9000,
  "players": [
    { "id": "id-anna", "nickname": "Anna", "pressedKeys": ["A"] },
    { "id": "id-marc", "nickname": "Marc", "pressedKeys": [] }
  ]
}
```

### Exemple d'un jugador després de la ronda

A `phase: 'results'`, cada objecte de `players` inclou, a més, `attempts`, `totalErrorMs` i `completed`:

```json
{
  "id": "id-anna",
  "nickname": "Anna",
  "pressedKeys": ["A"],
  "attempts": [
    { "key": "A", "targetMs": 2000, "elapsedMs": 2180, "errorMs": 180 },
    { "key": "S", "targetMs": 4000, "elapsedMs": null, "errorMs": 3000 },
    { "key": "D", "targetMs": 5000, "elapsedMs": null, "errorMs": 3000 },
    { "key": "F", "targetMs": 7000, "elapsedMs": null, "errorMs": 3000 }
  ],
  "totalErrorMs": 9180,
  "completed": 1
}
```

**Regles:**
- Les fases són `lobby`, `playing`, `results`.
- Els temps de puntuació es calculen amb `performance.now()` al servidor; el client **no envia timestamps**.
- `totalErrorMs` és la suma d'errors de totes les tecles; 3.000 ms per absència o desviació de 3.000 ms o més.
- Durant `playing`, el servidor **no envia** `attempts` ni `totalErrorMs`.
- Les sales viuen en memòria; es buiden quan surt l'últim participant o quan es reinicia el contenidor.
- No hi ha comptes d'usuari ni reconnexió amb identitat preservada. Si un socket es desconnecta, és expulsat de la sala.
- No s'accepten entrades en una sala que tingui una ronda `playing`.

## Important sobre la precisió

La classificació utilitza l'hora de **recepció al servidor**, no l'instant físic de pulsació al client. El missatge d'inici també està subjecte a la latència. És adequat per aprendre temps real en una LAN amb latència reduïda, però no és una competició de precisió al mil·lisegon entre clients amb latències diferents. Eviteu reclamar una precisió que el protocol no garanteix.
