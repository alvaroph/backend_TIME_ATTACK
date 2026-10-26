# TIME ATTACK — Servidor Node.js + Socket.IO

Backend complet, preparat per als alumnes de 2n DAW. **Els alumnes NO han de programar el backend**: només desplegar-lo i integrar-lo amb el frontend Vue.

## Requisits

- Docker + Docker Compose plugin per a l'opció A.
- Alternativament, Node.js 22 o superior i npm per a l'opció B.
- Xarxa que permeti connectar amb el port TCP 3000 del servidor des dels ordinadors dels alumnes.

## Opció A — Docker Compose (recomanada)

Dins la carpeta `backend`:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f
```

Comprova al mateix servidor: `curl http://localhost:3000/health`.

Atura el servidor amb `docker compose down`. Per veure les actualitzacions del codi, reconstrueix-lo amb `docker compose up --build -d`.

Si el professor l'allotja en un altre ordinador de la LAN, al navegador dels alumnes la URL serà `http://IP_DEL_PROFESSOR:3000`, no `http://localhost:3000`. Configureu el firewall si cal.

## Opció B — Execució sense Docker

```bash
npm install
npm start
```

## Proves

```bash
npm test
```

Aquests tests només comproven les funcions de regles del joc, sense iniciar el servidor. Per fer una prova de dues connexions Socket.IO reals:

```bash
# Terminal 1
npm start
# Terminal 2 (mateixa carpeta i amb npm install fet)
npm run smoke
```

El *smoke test* prova l'entrada de dues persones, l'inici, una pulsació vàlida, el bloqueig d'un duplicat i la publicació dels resultats. El test complet espera que acabi una ronda.

## Regles del backend

- Primer participant d'una sala: es converteix en amfitrió.
- Calen almenys dos participants per començar.
- Cada jugador pot prémer A, S, D i F una vegada per ronda.
- Només el servidor calcula el temps i la puntuació.
- Ronda 1: A=2s, S=4s, D=5s, F=7s. Les rondes següents canvien els objectius.
- El resultat es publica després de l'últim objectiu més 2s de marge.
- Abans del final es comparteixen `pressedKeys`, però **no** el temps exacte ni la puntuació.
- Cada tecla omesa o amb error superior a 3.000ms rep 3.000ms d'error. Guanya el menor error total.
- Les sales viuen en memòria i desapareixen si no hi ha participants.

## Fitxers importants

- `src/server.js`: servidor HTTP, gestió de sales i Socket.IO.
- `src/rules.js`: configuració de rondes, validació i puntuació.
- `compose.yaml`: servei Docker amb port 3000.
- `Dockerfile`: imatge Node 22 Alpine.
- `test/rules.test.js`: tests de regles.
- `scripts/smoke.mjs`: test d'integració que requereix un servidor en marxa.
- `../contracte/PROTOCOL-SOCKET.md`: dades i esdeveniments exactes.

## Notes de seguretat i precisió

Per facilitar l'entorn docent, CORS està configurat amb `*`. **No exposeu aquest servidor tal qual a Internet:** no hi ha autenticació, limitació de peticions ni persistència. La precisió és la del temps de recepció al servidor; no compensa la latència de xarxa. Una desconnexió elimina el jugador de la sala.

Si el frontend està servit per HTTPS, caldrà publicar també Socket.IO per HTTPS / WSS mitjançant un proxy invers; una URL `http://` podria quedar bloquejada com a contingut mixt.
