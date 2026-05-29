---
name: feedback-share-deeplink-once
description: Share intents must include the deeplink exactly once; Telegram url+text duplicates it
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1388c538-7843-4b9e-a316-600bb8c97e71
---

Al armar botones de "compartir" (WhatsApp/Telegram/copiar) separá el **deeplink (`url`)** del **caption (título + body, SIN la url)**. Helper central: `client/src/utils/share.js#buildCompartidaShare(post, origin)` → `{ url, caption, whatsappText }`.

- WhatsApp: solo acepta un campo `text` → usar `whatsappText` (caption + url una vez).
- Telegram: pasar `url=<url>` **y** `text=<caption>` (caption sin url). NUNCA meter la url también en el `text` — Telegram la renderiza dos veces (bug que tenía CompartidaCard).
- Copiar: solo `url`.

**Why:** el bug original ponía la url en el `text` y de nuevo en el param `url=` → deeplink duplicado en Telegram.

**How to apply:** para cualquier entidad nueva que se comparta, reusar/extender `buildCompartidaShare` y testear que el caption no contiene la url (ver `share.test.js`). Relacionado con [[feedback_shared_helpers_catalog]].
