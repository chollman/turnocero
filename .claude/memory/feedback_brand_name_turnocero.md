---
name: feedback-brand-name-turnocero
description: "La marca se escribe \"TurnoCero\" (C mayúscula) en todo texto visible al usuario"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1388c538-7843-4b9e-a316-600bb8c97e71
---

El nombre de la marca se escribe **"TurnoCero"** (con C mayúscula) en TODO texto user-facing: wordmarks (AuthLogo, SplashScreen), `<title>`/meta/OG (`og:title`, `og:site_name`, `twitter:title`), body copy, aria-labels, emails, y el `og-default.png`.

**Why:** estandarización pedida por el usuario (2026-05-29). Antes convivían "Turnocero" y "TurnoCero" (login/logo ya usaban la C mayúscula; los meta-titles no).

**How to apply:**
- Cualquier string nuevo visible al usuario usa "TurnoCero".
- NO tocar el token técnico en minúscula `turnocero`: folders de Cloudinary (`turnocero/...`), `localStorage` keys (`turnocero_theme`), env, package names, User-Agent (`TurnoCero/1.0` en server es aparte), nombre del repo. Esos son identificadores, no marca.
- El `og-default.png` (1200×630, logo T0 + "TurnoCero") se regenera con `@resvg/resvg-js` (dev dep transitoria `--no-save`) rasterizando un SVG de marca; ver historial. Relacionado con [[feedback_share_deeplink_once]].
