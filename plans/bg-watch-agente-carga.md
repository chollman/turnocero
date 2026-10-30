# BG Watch — Agente de carga de partidas (IA)

Plan completo y decisiones: [doc del plan](https://claude.ai/artifact/9zasu2j2ZLUhbgtHgDdXXh).

Un asistente que convierte "ayer jugamos Root con Juan y Meli, ganó Juan" en un
borrador que precarga `PlayForm`. **Nunca guarda en BGG**: el usuario revisa el
formulario y guarda como siempre. Se abre desde una burbuja flotante en la
pantalla de carga, por texto o por voz.

## Decisiones

- Modelo: `claude-haiku-5-5`, respaldo `claude-sonnet-5-5` ante sobrecarga.
- Gating: sección `bgwatch` + flag `bgwatchAgent` (apagado por defecto).
- Facciones/personajes por jugador → campo `color` en modo competitivo; en
  modo equipos `color` sigue siendo "Equipo X".
- Cuotas: 10 cargas (conversaciones) por usuario por día, 6 mensajes por carga.
- Historial en el servidor (`AgentConversation`, TTL 24 h).
- Objetivo para lanzar: 90 % de borradores correctos sin correcciones.
- Voz: reconocimiento del navegador; sin soporte → dictado del teclado. Sin
  transcripción en el servidor.

## Estado

- [x] F0 — flag `bgwatchAgent`, `AgentUsage`, `AgentConversation`
- [x] F1 — tools (`server/services/bgg/playAgent/`)
- [x] F2 — bucle + `POST /api/bgg/agente` + cuotas
- [x] F3 — burbuja, panel, voz, precarga de `PlayForm`, facción en modo competitivo
- [x] F4 — set de evaluación (30 frases) y runner (`npm run eval:agent --prefix server`)
- [x] F4 — evaluación con la API: 29/30 → ajuste de empates → **30/30 (100 %)**, USD 0,0006 por carga (2026-10-30)
- [ ] F5 — piloto con el flag + tope de gasto

## Pendientes en la PC (no se pudieron hacer en la sesión remota)

- [x] `npm install --prefix server` (agrega `@anthropic-ai/sdk`).
- [x] Correr `npm test` completo: los tests de integración del agente y de
      `GET /api/bgg/search` (movida a `bggCatalogSearch.js`) no corrieron en
      la sesión remota porque no había MongoDB.
- [x] `ANTHROPIC_API_KEY` en `server/.env` (falta confirmar el deploy).
- [x] Verificar precios de caché de Haiku en `playAgent/pricing.js`.
- [x] Prueba manual: texto y voz en desktop, Android y PWA de iOS (la burbuja
      solo aparece con `bgwatchAgent` prendido, o siendo admin).
- [ ] Tope de gasto mensual en la consola de Anthropic.
- [x] Correr `npm run eval:agent --prefix server` (necesita la key; cuesta
      centavos con Haiku). Si queda debajo del 90 %, revisar los ✗ en
      `server/eval/playLogger/results/` y ajustar `prompt.js` / `tools.js`.
- [x] Probar la burbuja sobre el formulario real (se revisó solo en una vista
      aislada): que no tape campos ni la barra de guardar en desktop y teléfono.

## Evaluación (F4)

`server/eval/playLogger/`: 30 casos (`cases.js`) con el borrador esperado,
datos fijos de una cuenta de prueba (`fixtures.js`) y tools que los leen
(`fixtureHandlers.js`) usando la misma lógica pura que producción. El runner
corre el modelo real, compara (`compare.js`: equipos por agrupación, textos por
contenido, jugadores como conjunto exacto) y reporta precisión, mensajes por
caso, tokens y costo. `--dry` valida que cada caso sea alcanzable sin la API;
`--only=<texto>` filtra casos. Sale con código 1 si queda por debajo del 90 %.

Al agregar un caso: sumá juegos o personas nuevas a `fixtures.js` y corré
`npm run eval:agent --prefix server -- --dry`.
