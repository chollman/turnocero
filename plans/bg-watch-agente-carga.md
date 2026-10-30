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
- [ ] F4 — set de evaluación (30 frases) y ajuste del prompt
- [ ] F5 — piloto con el flag + tope de gasto

## Pendientes en la PC (no se pudieron hacer en la sesión remota)

- [ ] `npm install --prefix server` (agrega `@anthropic-ai/sdk`).
- [ ] Correr `npm test` completo: los tests de integración del agente y de
      `GET /api/bgg/search` (movida a `bggCatalogSearch.js`) no corrieron en
      la sesión remota porque no había MongoDB.
- [ ] `ANTHROPIC_API_KEY` en `server/.env` y en el deploy.
- [ ] Verificar precios de caché de Haiku en `playAgent/pricing.js`.
- [ ] Prueba manual: texto y voz en desktop, Android y PWA de iOS (la burbuja
      solo aparece con `bgwatchAgent` prendido, o siendo admin).
- [ ] Tope de gasto mensual en la consola de Anthropic.
