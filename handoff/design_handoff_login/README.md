# Handoff: Login / Registro reimaginados · TurnoCero

## Overview

Rediseño de la pantalla de **autenticación** (`/login` y `/register`) de TurnoCero.
Reemplaza el login básico actual por una pantalla **split full-screen**: formulario
a la izquierda (con toggle login ↔ registro en un mismo flujo, sin cambiar de página)
y un **showcase ilustrado de juegos de mesa** a la derecha con stats de comunidad en
vivo y una carta de mesa que rota.

Cambios clave respecto del actual:

- **Un solo componente para login + registro** con toggle segmentado arriba, en vez
  de dos páginas separadas. La URL puede seguir siendo `/login` y `/register` — el
  componente arranca en el modo correcto según la ruta.
- **Split 38% / 62%** — formulario angosto a la izquierda, showcase amplio a la derecha.
- **Showcase ilustrado** — composición SVG de elementos de juego de mesa (cartas en
  abanico, dados, meeples, tiles hexagonales, score-track) sobre un gradiente navy,
  con eyebrow "en vivo", titular, stats de comunidad y una **carta de mesa que rota**
  cada 3.5s. Cero dependencia de imágenes externas.
- **Registro enriquecido** — nombre, @usuario (auto-lowercase sin espacios), email,
  contraseña con **medidor de fuerza** en vivo, **picker de color de avatar** con
  preview de inicial, y aceptación de términos. El submit se habilita solo cuando
  está completo.
- **OAuth** — botones Google y Discord.
- **Mobile** (≤ 900px) — el showcase se reemplaza por un mini-hero compacto arriba
  del formulario; OAuth se apila en ≤ 520px.

---

## About the Design Files

Referencias de diseño en HTML + JSX vanilla (Babel standalone). **No es código para
copiar directo** — recrear en el entorno actual de TurnoCero: React + Vite + CSS
Modules + React Router.

Crear / reemplazar:

- `client/src/pages/auth/Auth.jsx` (login + registro en un solo componente, o dos
  thin-wrappers `Login.jsx` / `Register.jsx` que monten `<Auth mode="…" />`)
- `Auth.module.css`
- Conectar con `AuthContext` (`useAuth().login(...)`, `register(...)`) — ver Integración

Las rutas `/login` y `/register` ya existen (referenciadas desde `Navbar.jsx`,
`Sidebar.jsx`, `BgWatchLanding.jsx`).

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, radios y animaciones
finalizados.

---

## Design tokens (de `reimagined-styles.css`)

```css
--bg-dark:     #0a0d15;   --bg-card:     #151c28;
--bg-elevated: #1d2532;   --bg-deep:     #050810;

--accent:       #1888ef;  --accent-light: #00aeff;
--accent-glow:  rgba(24,136,239,0.18);

--text-primary: #ffffff;  --text-secondary: #a8b4cc;
--text-muted:   #5a6178;  --text-faint:     #353d52;

--border: #1e2a3d;  --border-strong: #2a3a55;  --border-accent: rgba(24,136,239,0.4);

--red: #f31d77;  --green: #00d984;  --orange: #f5a623;  --purple: #b48cff;

--font-display: 'Poppins', sans-serif;       /* títulos */
--font-body:    'Archivo', sans-serif;        /* body, inputs */
--font-mono:    'JetBrains Mono', monospace;  /* eyebrows, labels */

--t: 0.2s ease;
```

Paleta de swatches para el avatar (registro): `['#1888ef','#00d984','#f5a623','#b48cff','#f31d77','#00aeff']`.

---

## Layout

```
.authStage  (grid-template-columns: minmax(420px, 0.62fr) 1fr; min-height 100vh)
├── .authFormPane           ← formulario (izquierda, angosto)
│     .authBrand            ← lockup marca (monograma T+anillo)
│     .authBody (max 400px)
│       .authMobileHero     ← solo < 900px (reemplaza showcase)
│       .authSwitch         ← toggle segmentado Login / Registro
│       .authEyebrow + .authTitle + .authSub
│       .authFields         ← campos según modo
│       .authDivider "o continuá con"
│       .authOauth          ← Google · Discord
│       .authFootLine       ← link cruzado login↔registro
│       .authLegal          ← términos / privacidad / ayuda
└── .authShowcase           ← showcase ilustrado (derecha, amplio)
      .authShowcaseImg      ← <ShowcaseScene/> SVG full-bleed
      .authShowcaseVignette ← gradiente de legibilidad
      .authShowcaseTop      ← eyebrow + headline + stats
      .authPreviewCard      ← carta de mesa rotando + dots
```

El split es **38/62** aprox (la columna del form es `minmax(420px, 0.62fr)`, el
showcase `1fr`). Padding del form: `44px 52px`.

---

## Panel izquierdo · formulario

### Brand lockup (`.authBrand`)
Monograma 40×40 (br 11px, bg card, borde cyan, glow): una "T" (brazo + tronco
blancos) + un anillo cyan con punto central — recreación del isotipo TurnoCero.
Al lado: "TurnoCero" (Poppins 800 17px) + "◆ board game meetups" (mono 9px uppercase).
`margin-bottom: auto` lo ancla arriba; `.authBody` tiene `margin: 40px 0 auto` →
el bloque del form queda verticalmente centrado-arriba.

### Toggle (`.authSwitch`)
Segmented control grid 2 cols, bg card, padding 4px, br 11px. Botón activo: bg
elevated, color cyan, sombra sutil. Cambia entre modo `login` y `register`.

### Encabezado
- `.authEyebrow`: mono 10.5px 0.16em cyan con rule-line `::before`. "◆ Bienvenido de vuelta" (login) / "◆ Sumate a la comunidad" (registro)
- `.authTitle`: Poppins 700 `clamp(2rem, 3vw, 2.7rem)` ls -0.045em. "Volvé a la **mesa**." (login) / "Armá tu **lugar**." (registro). `<em>` cyan normal-style.
- `.authSub`: 14px secondary, copy contextual.

### Campos (`.authField`)
Estructura: label (mono 10px uppercase) + `.authInputWrap` con icono `.lead`
posicionado absoluto a la izquierda + `.authInput` (bg card, border 1px, br 10px,
padding-left 38px para el icono). Focus: border accent + glow ring.

**Login**:
1. Usuario o email (icono Mail)
2. Contraseña (icono Lock + botón `.authReveal` ojo para mostrar/ocultar) + link "¿Olvidaste tu contraseña?" en el label row
3. `.authRememberRow` — checkbox custom "Mantener sesión"

**Registro**:
1. Nombre para mostrar (icono User)
2. Nombre de usuario — prefijo "@" absoluto, input con `padding-left: 30px`, sanitiza a lowercase sin espacios (`value.replace(/\s/g,'').toLowerCase()`)
3. Email (icono Mail)
4. Contraseña (icono Lock + reveal) + **medidor de fuerza** (`.authStrength`): 4 barras que se colorean según `strengthOf(pw)` (0-4: longitud≥8, may+min, dígito, símbolo) → rojo/naranja/cyan/verde + label "Débil/Aceptable/Buena/Fuerte"
5. **Avatar** (`.authAvatarRow`): preview 52×52 con la inicial del nombre sobre el color elegido + fila de 6 `.authSwatch` (26×26, el activo con anillo blanco)
6. `.authTerms` — checkbox + "Acepto los términos y la política de privacidad"

Submit (`.authSubmit`): bg accent, full-width, br 11px, Poppins 700 14.5px, icono Dice. En registro queda `disabled` hasta que `name && handle && pw.length>=8 && terms`.

### Checkbox custom (`.authCheckBox`)
17×17 br 5px, borde strong. Estado `.on`: bg accent + check SVG visible (opacity transition).

### Divider + OAuth
`.authDivider` "o continuá con" con líneas a los lados. `.authOauth`: 2 botones
flex (`.authOauthBtn`, bg card + border strong) con logos Google (multicolor) y
Discord (#5865F2). En ≤ 520px se apilan en columna.

### Footer
`.authFootLine`: link cruzado ("¿No tenés cuenta? Crear cuenta →" / "¿Ya tenés
cuenta? Iniciar sesión →") que togglea el modo. `.authLegal`: términos / privacidad
/ ayuda (mono 9.5px faint).

---

## Panel derecho · showcase (`<Showcase>`)

### Fondo ilustrado (`<ShowcaseScene>`)
SVG full-bleed (`viewBox 0 0 600 820`, `preserveAspectRatio="xMidYMid slice"`) con
una composición flat-lay de juego de mesa, concentrada en el espacio negativo
(zona media-baja) para no pisar el texto:

- **base**: radial `#1a2c48 → #101a2e → #080b13`
- **cluster de hexágonos** arriba a la derecha (7 hexes, stroke cyan, algunos con fill tenue) — helper `hexPoints(cx,cy,r)`
- **score-track**: path Q dashed cyan tenue cruzando arriba
- **mano de 5 cartas en abanico** centradas (`translate(330 470)`), cada una rotada (-26° a +26°), rect 116×180 br 12px con `url(#cardFace)`, borde de color de marca, pips en esquinas y motivo central (triángulo + círculo)
- **2 dados** (`translate(122 486)` blanco con 5 pips, `translate(186 552)` cyan con 2 pips), con `filter url(#sceneShadow)`
- **4 meeples** (path silhouette, `scale ~2-2.9`) en naranja/azul/verde/violeta repartidos
- **2 tiles** chicos abajo a la izquierda (rotados, borde rosa/verde)

Todo con `feDropShadow` (`#sceneShadow`) para dar profundidad. **Sin imágenes
externas** — decisión deliberada: las URLs externas no son confiables y la
ilustración SVG siempre renderiza. Si se quiere una **foto real** en el futuro,
se puede reemplazar `.authShowcaseImg` por un `<img>`/background con foto de
juegos de mesa (mismo gradiente vignette encima para legibilidad).

### Vignette (`.authShowcaseVignette`)
Doble gradiente (vertical + diagonal) que oscurece arriba y abajo para que el
texto/stats/carta sean legibles sobre la ilustración.

### Contenido superpuesto
- `.authShowcaseTop`: eyebrow "● En vivo · esta semana" (dot verde pulsante) +
  `.authShowcaseHeadline` ("42 mesas activas **en tu zona.**" o, variante
  `community`, "Tu mesa te **espera.**") + `.authStatStrip` (3 stats: 42 mesas /
  1.2k jugadores / 8 eventos)
- `.authPreviewCard`: carta de mesa con avatar + juego + host/lugar + seat-track +
  "{N} lugares" + horario. **Rota** entre 3 mesas (`PREVIEWS`) cada 3.5s vía
  `setInterval`; `.authPreviewDots` permite saltar manualmente. Animación
  `cardFloat` al entrar.

---

## Interacciones & comportamiento

### Login
- Submit → `useAuth().login({ identifier, password, remember })` → `POST /api/auth/login`
- Éxito → redirect a `/` (o a la ruta `from` si vino de un guard)
- Error → mostrar mensaje inline bajo el campo (no implementado en el proto; agregar `.authError`)
- "¿Olvidaste tu contraseña?" → `/recuperar-password`
- Toggle "Crear cuenta" → cambia a modo registro (o navega a `/register`)
- "Mantener sesión" → flag para token persistente vs sesión

### Registro
- Validación client-side: nombre no vacío, handle válido (`^[a-z0-9_.]{3,20}$`),
  email válido, password ≥ 8, términos aceptados
- Handle: chequear disponibilidad con debounce → `GET /api/users/check-handle?h=`
  (mostrar ✓/✗ inline — extensión sugerida)
- Submit → `useAuth().register({ name, handle, email, password, avatarColor })` →
  `POST /api/auth/register`
- Éxito → auto-login + redirect a onboarding o `/`
- Medidor de fuerza: solo visual, no bloquea más allá del mínimo de 8

### OAuth
- Google / Discord → redirect a `/api/auth/oauth/{provider}` (flujo server-side)

### Showcase
- Stats: idealmente reales vía `GET /api/stats/community` (mesas activas, jugadores,
  eventos próximos). Fallback a valores estáticos.
- Carta rotando: en prod puede mostrar mesas abiertas reales (`GET /api/tables?open=true&limit=3`)

---

## Integración con `AuthContext`

El contexto actual expone `useAuth()` con `user`, `login`, `logout`,
`isActuallyAdmin`, `viewAsUser`, `refreshUser`. Esta pantalla necesita además
`register(...)`. Tras login/registro exitoso, `AuthContext` ya persiste el user;
redirigir con `useNavigate()`.

Logout ya navega a `/login` (`Navbar.jsx:41`, `Sidebar.jsx:289`), así que esta
pantalla es el destino post-logout.

---

## State (prototipo)

```ts
const [mode, setMode]       = useState('login');   // 'login' | 'register'
const [showPw, setShowPw]   = useState(false);
const [remember, setRemember] = useState(true);
const [terms, setTerms]     = useState(false);
const [pw, setPw]           = useState('');
const [name, setName]       = useState('');
const [handle, setHandle]   = useState('');
const [color, setColor]     = useState('#1888ef');

const strength    = strengthOf(pw);            // 0..4
const initial     = (name[0] || handle[0] || '◆').toUpperCase();
const canRegister = name.trim() && handle.trim() && pw.length >= 8 && terms;
```

Tweaks expuestos (solo exploración, no portar): `mode` (login/registro), `showcase`
(stats/comunidad — variante de titular), `accent` (azul/violeta/verde).

---

## Responsive

- **≤ 900px**: `.authStage` 1 columna, `.authShowcase` oculto (`display:none`),
  `.authMobileHero` visible arriba del form (eyebrow + headline + 2 stats compactos),
  form pane `padding: 36px 28px`
- **≤ 520px**: OAuth en columna, padding `28px 20px`

---

## Assets

- **Fuentes**: Poppins (500-800), Archivo (400-700), JetBrains Mono (400-600)
- **Sin imágenes externas**: showcase = ilustración SVG (`ShowcaseScene`); avatares /
  logos = SVG inline en `auth-app.jsx → AIcon` (Mail, Lock, User, Eye, EyeOff, Check,
  Dice, Google, Discord)
- El monograma de marca es CSS puro (`.authBrandMark`)

---

## Files (referencia)

- `Login Reimagined.html` — entry HTML (React/ReactDOM/Babel + scripts)
- `reimagined-styles.css` — tokens compartidos del sistema
- `auth-styles.css` — estilos de la pantalla (split, form, showcase, scene, responsive)
- `auth-app.jsx` — `AuthApp` (login + registro) + `Showcase` + `ShowcaseScene`
  (ilustración) + `PreviewCard` + `AIcon` + helpers (`strengthOf`, `hexPoints`)

Codebase a crear/conectar:
- `client/src/pages/auth/Auth.jsx` + `Auth.module.css`
- Rutas `/login` y `/register` (ya existen)
- Extender `AuthContext` con `register(...)`

---

## Checklist de implementación

- [ ] `Auth.jsx` con split layout y toggle login/registro
- [ ] Campos login (identifier, password+reveal, remember) y registro (name, @handle, email, password+strength, avatar color, terms)
- [ ] Medidor de fuerza de contraseña (`strengthOf`)
- [ ] Picker de avatar con preview de inicial
- [ ] `ShowcaseScene` SVG (cartas, dados, meeples, hexes) + vignette
- [ ] Stats de comunidad (reales o estáticos) + carta de mesa rotando
- [ ] OAuth Google/Discord (redirect server-side)
- [ ] Validación + estados de error inline
- [ ] Disponibilidad de @handle con debounce (opcional)
- [ ] Conectar `login` / `register` del `AuthContext` + redirects
- [ ] Responsive 900 / 520 (mobile hero, OAuth apilado)
- [ ] Accesibilidad: labels asociadas, `aria-label` en reveal/swatches/oauth, foco visible, submit por Enter
