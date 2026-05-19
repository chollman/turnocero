# Handoff: Compartidas Mobile · TurnoCero

## Overview

Versión mobile (≤ 960px) del feed de **Compartidas** aplicando el sistema reimaginado:
diario compartido con polaroids estilo scrapbook, broadside del día, mini-ticket de mesa
enlazada, widgets intercalados en lugar de sidebar.

Esto **complementa** el handoff de la sección desktop (`Compartidas Reimagined.html`)
y se monta sobre el chrome mobile reimaginado (Navbar + BottomNav, ver
`design_handoff_mobile/`). Si el desktop / chrome mobile no se implementaron aún, hacer eso primero.

Archivos del codebase que se actualizan:

- `client/src/pages/compartidas/Compartidas.jsx` — el componente que ya alterna
  desktop/mobile via media queries en el CSS module.
- `client/src/pages/compartidas/Compartidas.module.css`
- `client/src/pages/compartidas/CompartidaCard.jsx` + `.module.css`
- `client/src/pages/compartidas/CreateCompartidaForm.jsx` + `.module.css`
- `client/src/pages/compartidas/BgWatchHomeWidget.jsx` (se reutiliza intercalado)
- `client/src/pages/compartidas/CompartidasSidebar.jsx` — **se vuelve "WidgetsIntercalados"** en mobile (no es un aside lateral, sino cards en el flujo del feed).

---

## About the Design Files

- `Compartidas Mobile.html` — prototipo mobile con dos teléfonos (estados distintos del feed).
- `Compartidas Reimagined.html` — prototipo desktop, para referencia del look + lógica de estados.
- `Mobile Reimagined.html` — chrome mobile (Navbar + BottomNav), para tokens y patrones globales.

Son **referencias de diseño en HTML vanilla**, no código para copiar directo. Re-implementar en React + CSS Modules manteniendo todas las integraciones con `useAuth`, `useNotifications`, `useSiteConfig`, `axios`, hooks de routing, `Avatar`, `LoginPromptModal`, `GameTile`, etc.

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, animaciones y comportamientos son finales.

---

## Pantalla — Feed Compartidas (mobile)

### Layout shell

El feed mobile se renderiza **debajo del Navbar (top)** y **arriba del BottomNav flotante**:

```
[ Navbar — 56-58px high, sticky top ]
[ Content scroll area ]
  ├── pageHead (eyebrow + title + stats row)
  ├── Composer (one-liner)
  ├── Filter chips (horizontal scroll)
  ├── Featured broadside (compartida del día)
  ├── Post 1
  ├── Inline widget (BG Watch / Próximas mesas / Quote)
  ├── Post 2
  ├── Post 3
  ├── Inline widget
  └── …
[ Bottom safe area ~100px to clear BottomNav ]
[ BottomNav — pill flotante, fixed bottom 12px ]
```

- `flex: 1; overflow-y: auto`
- Padding: `16px 14px 100px`
- Display flex column, gap 14px

### Page header

```html
<header class="pageHead">
  <span class="pageEyebrow">Comunidad · diario compartido</span>
  <h1 class="pageTitle">Lo que <em>jugamos</em>.</h1>
  <div class="pageStats">
    <span><strong>6</strong> compartidas</span>
    <span>· <strong>7</strong> esta semana</span>
  </div>
</header>
```

- `.pageHead`: padding-bottom 14px, border-bottom `1px solid var(--border)`, margin-bottom 6px
- `.pageEyebrow`: JetBrains Mono 500, 10px, letter-spacing `0.16em`, uppercase, color `var(--accent-light)`. Con `::before` rule line de 20px
- `.pageTitle`: Poppins 800, 26px, letter-spacing `-0.04em`, line-height 1, margin `4px 0 0`
- `.pageTitle em`: Caveat 600, 1.15× tamaño, color `var(--accent-light)`, letter-spacing `-0.02em`, font-style normal
- `.pageStats`: JetBrains Mono 10px, uppercase, color `var(--text-muted)`, gap 14px, `strong` color `var(--accent-light)`

### Composer (one-liner)

Igual al desktop pero condensado a una línea. Tap → expande al modal del current `CreateCompartidaForm.jsx`.

```html
<div class="composer">
  <div class="composerAvatar">V</div>
  <button class="composerTrigger" onClick={openComposer}>
    ¿Qué jugaste hoy, {user.username}?
  </button>
  <div class="composerActions">
    <button onClick={() => openComposerWithPhotos()}>{photoIcon}</button>
    <button onClick={() => openComposerWithMesa()}>{diceIcon}</button>
  </div>
</div>
```

- `.composer`: bg `var(--bg-card)`, border `1px solid var(--border)`, radius 14px, padding 10px, flex gap 10px align center
- `.composerAvatar`: 32×32, radius 10, bg `var(--accent)`, color `#fff`, Poppins 800 13px
- `.composerTrigger`: flex 1, bg `var(--bg-elevated)`, border `1px solid var(--border)`, radius 999, padding `8px 12px`, color `var(--text-muted)`, text-align left, font-size 13px
- `.composerActions button`: 32×32, border `1px solid var(--border)`, radius 8, transparent bg, color `var(--text-muted)`. Hover/active: color `var(--accent-light)`, border `var(--border-accent)`, bg `var(--accent-glow)`

### Filter chips (horizontal scroll)

Nuevo elemento mobile-only para filtrar el feed por tipo. **Opcional** — si no hay endpoint backend, ocultar.

```html
<div class="filterChips">
  <button class="filterChip active">Todo</button>
  <button class="filterChip">Amigos</button>
  <button class="filterChip">Con fotos</button>
  <button class="filterChip">Mesas</button>
  <button class="filterChip">Trending</button>
</div>
```

- Container: `display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none` (ocultar scrollbar)
- `.filterChip`: bg transparente, border `1px solid var(--border)`, radius 999, padding `6px 12px`, color `var(--text-secondary)`, JetBrains Mono 500 10.5px, letter-spacing `0.06em`, uppercase, white-space nowrap
- `.filterChip.active`: bg `var(--accent)`, border `var(--accent)`, color `#fff`

---

## Featured broadside (compartida del día)

Ya está en desktop, pero en mobile **apila vertical** en vez de grid 2-col. La polaroid pasa al medio del card, no a la derecha.

```html
<article class="broadside" onClick={openFeatured}>
  <span class="broadsideLabel">◆ Compartida del día</span>
  <div class="broadsideEyebrow">
    <Avatar size="xs" user={featured.author} />
    <span>Por <strong>{authorName}</strong> · {timeAgo}</span>
  </div>
  <h2 class="broadsideTitle">{featured.title}</h2>
  <p class="broadsideQuote">{featured.pullQuote || featured.body}</p>
  <Polaroid caption={firstImage.caption || 'la partida'} aspect="square" tape tapePos="center" class="broadsidePolaroid" />
  <div class="broadsideMeta">
    <span>◆ <strong>{game}</strong></span>
    <span>♥ {likes}</span>
    <span>💬 {comments}</span>
  </div>
</article>
```

Layout:
- Background:
  ```css
  background:
    radial-gradient(500px circle at 20% 30%, rgba(24,136,239,0.18), transparent 55%),
    linear-gradient(135deg, #18223a, #0c1018);
  ```
- Border `1px solid var(--border-strong)`, radius 16px, padding 18px
- Display flex column, gap 12px
- `.broadsideLabel`: align-self flex-start (no full-width). Pill bg `var(--accent)`, color `#fff`, padding `4px 9px`, radius 999, JetBrains Mono 700 9.5px, letter-spacing `0.15em`, uppercase, transform `rotate(-2deg)`, box-shadow `0 4px 12px var(--accent-glow)`
- `.broadsideTitle`: Poppins 700 22px, letter-spacing `-0.035em`, line-height 1.05, text-wrap balance
- `.broadsideQuote`: Poppins 500 14px italic, line-height 1.5, color `var(--text-secondary)`, border-left `3px solid var(--accent)`, padding-left 10px
- `.broadsidePolaroid`: align-self center, transform `rotate(-3deg)`, max-width 220px, width 100%
- `.broadsideMeta`: JetBrains Mono 10.5px, color `var(--text-muted)`, gap `4px 14px`, `strong` color `var(--text)`

---

## Post card

Componente principal del feed, vista mobile.

### Estructura

```html
<article class="post" data-id={post._id}>
  <PostHeader />
  <PostBody />
  <PostPhotos />     <!-- if images -->
  <MesaTicket />     <!-- if linkedTable -->
  <PostFooter />     <!-- likes, comments, share -->
  <CommentsPreview /> <!-- last 1-2 + "Ver N más" -->
  <CommentForm />
</article>
```

### Header

```html
<div class="postHeader">
  <div class="postAvatar" style={{ background: authorColor }}>{initial}</div>
  <div class="postAuthor">
    <div class="postAuthorRow">
      <span class="postAuthorName">{name}</span>
      {author.bgwUsername && <span class="postAuthorBg">{dotsIcon}</span>}
    </div>
    <div class="postMetaLine">
      <span>◆ hace {timeAgo}</span>
      <span class="postPrivacy">{privacyIcon} {privacyLabel}</span>
    </div>
  </div>
  <button class="postMenu">{dotsIcon}</button>
</div>
```

Specs:
- `.postHeader`: padding `14px 14px 8px`, display flex, gap 10px, align center
- `.postAvatar`: 38×38, radius 11, Poppins 800 13px, color #fff, color de fondo dinámico (del usuario)
- `.postAuthorName`: Poppins 700 13.5px, letter-spacing `-0.015em`, line-height 1.15, ellipsis
- `.postAuthorBg`: 16×16, color `var(--accent-light)`, bg `var(--accent-glow)`, border `1px solid var(--border-accent)`, radius 4px, SVG 9×9
- `.postMetaLine`: JetBrains Mono 10px, color `var(--text-muted)`, letter-spacing `0.04em`, uppercase
- `.postPrivacy`: padding `1px 6px`, border `1px solid var(--border)`, radius 4px, SVG 8×8
- `.postMenu`: 28×28, transparent, radius 8, color `var(--text-muted)`. Hover: bg `var(--bg-elevated)`, border `var(--border)`, color `var(--text)`

### Body

```html
<div class="postBody">
  {post.title && <h3 class="postTitle">{title}</h3>}
  <p class="postText">{displayBody}</p>
  {isLong && <button class="postExpand">+ Ver más</button>}
</div>
```

Specs:
- Padding `0 14px 10px`
- `.postTitle`: Poppins 700 16px, letter-spacing `-0.025em`, line-height 1.18, margin `0 0 6px`
- `.postText`: 14px, color `var(--text-secondary)`, line-height 1.5, white-space pre-wrap
- `.postExpand`: JetBrains Mono 10.5px, color `var(--accent-light)`, letter-spacing `0.06em`, uppercase, bg transparente, border none

### Photos (polaroid grid)

Adaptado al mobile width (~360-390px viewport):

#### `.photoGrid1` (1 foto)

```html
<div class="postPhotos photoGrid1">
  <div class="polaroidWrap"><Polaroid {...img} /></div>
</div>
```

- Grid centrado, padding-top 8px, padding-bottom 16px
- Polaroid wrap: width `min(280px, 100%)`
- Polaroid: width 100%, transform `rotate(-1.5deg)`

#### `.photoGrid2` (2 fotos)

- `display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px`
- Padding `12px 14px 16px`
- Place items center
- Polaroid:nth-child(1) → `rotate(-2.5deg)`
- Polaroid:nth-child(2) → `rotate(1.8deg)`

#### `.photoGrid3` y `.photoGrid4` (3-4 fotos)

- `grid-template-columns: repeat(2, 1fr); gap: 10px` (2×2)
- Para 3 fotos, la última ocupa 1 col (espacio en blanco aceptable)
- Rotaciones variadas: `-3deg, 2deg, 1deg, -1.5deg`

### Polaroid primitive

```html
<div class="polaroid">
  {tape && <span class="polaroidTape left|center|right" />}
  <div class="polaroidPhoto landscape?" style={photoUrl ? bgImage : null}>
    {!photoUrl && 'foto'}
  </div>
  {caption && <span class="polaroidCaption">{caption}</span>}
</div>
```

- Background: `#f4eeda` (color papel)
- Padding: `8px 8px 28px` (más espacio abajo para caption)
- Box-shadow: `0 12px 28px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3)`
- Border-radius: 3px
- Position relative

**`.polaroidPhoto`:**
- Width 100%, aspect-ratio 1 (square) o 4/3 (landscape para grid1)
- Si no hay foto real, fallback con pattern striped:
  ```css
  background:
    repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, transparent 8px, transparent 16px),
    linear-gradient(135deg, #1d2535, #0e1320);
  ```
- Color `var(--text-muted)`, JetBrains Mono 9.5px letter-spacing `0.18em` uppercase, contenido `"foto"` o similar

**`.polaroidCaption`:**
- Absolute bottom 4px, left/right 0
- Caveat 600, 15px, color `#2c2620`, text-align center, line-height 1
- Texto = `image.caption` (proveniente del modelo de la imagen)

**`.polaroidTape`:**
- Absolute top -6px
- Width 50px, height 14px
- Background `rgba(232,220,180,0.62)`, border `1px solid rgba(255,235,180,0.15)`, radius 1, shadow sutil
- Variantes posición: `.left { left: 12px; transform: rotate(-3deg) }`, `.center { left: 50%; transform: translateX(-50%) rotate(-1deg) }`, `.right { right: 12px; transform: rotate(4deg) }`

### Mesa enlazada (mini ticket-stub)

Para `linkedTable`:

```html
<div class="mesaTicket" data-link={`/mesas/${table._id}`}>
  <div class="mesaTile">{gameInitial}</div>
  <div class="mesaInfo">
    <span class="mesaLabel">◆ Mesa enlazada</span>
    <span class="mesaGame">{game} · {formattedDate}</span>
    <span class="mesaMeta">{location}{isOpen && ` · ${seats} lugares`}</span>
  </div>
  <button class="mesaCta">{isOpen ? 'Unirse' : 'Ver mesa'}</button>
</div>
```

- Margin `0 14px 14px` (respecto al post)
- Grid `38px 1fr auto`, gap 10px, padding `10px 12px`
- Background:
  ```css
  background:
    radial-gradient(200px circle at 0% 50%, var(--accent-glow), transparent 60%),
    var(--bg-elevated);
  ```
- Border `1px solid var(--border-strong)`, radius 10
- Position relative, overflow hidden

**Perforación (semicírculos cortando los lados):**
```css
.mesaTicket::before, .mesaTicket::after {
  content: '';
  position: absolute;
  width: 10px; height: 10px;
  background: var(--bg-paper);  /* matches post bg */
  border-radius: 50%;
  top: 50%; transform: translateY(-50%);
  border: 1px solid var(--border-strong);
}
.mesaTicket::before { left: 34px; }   /* después del tile */
.mesaTicket::after  { right: 70px; }  /* antes del CTA */
```

**`.mesaTile`** (38×38): radius 9, gradient `linear-gradient(135deg, var(--accent), var(--accent-dark))`, color #fff, Poppins 800 14px

**`.mesaLabel`:** JetBrains Mono 9px, color `var(--accent-light)`, uppercase, letter-spacing `0.12em`
**`.mesaGame`:** Poppins 700 13px, color `var(--text)`, letter-spacing `-0.015em`, ellipsis
**`.mesaMeta`:** JetBrains Mono 10px, color `var(--text-muted)`

**`.mesaCta`:** bg `var(--accent)`, color #fff, padding `6px 10px`, radius 7, Poppins 700 11px, letter-spacing `0.02em`

### Footer (reactions)

```html
<div class="postFooter">
  <div class="reactionGroup">
    <button class={`reactionBtn ${iLiked ? 'active' : ''}`} onClick={handleLike}>
      {heartIcon} <span>{likes}</span>
    </button>
    <button class="reactionBtn" onClick={toggleComments}>
      {commentIcon} <span>{comments.length}</span>
    </button>
  </div>
  <div class="shareGroup">
    <button class="shareBtn">{waIcon}</button>
    <button class="shareBtn">{tgIcon}</button>
    <button class="shareBtn">{linkIcon}</button>
  </div>
</div>
```

- `.postFooter`: padding `8px 12px 12px`, border-top `1px dashed var(--border)`, margin `0 2px`, flex justify-between align-center
- `.reactionBtn`: JetBrains Mono 11px, padding `6px 8px`, radius 8, color `var(--text-muted)`. Hover bg `var(--bg-elevated)`. Active (`.active`): color `var(--red)`, ícono filled
- `.shareBtn`: 30×30, radius 8, color `var(--text-muted)`. Hover bg `var(--bg-elevated)`, color `var(--accent-light)`

**Heart pop animation** al dar like (igual a desktop):
```css
.heart.popping { animation: heartPop 0.35s ease; }
@keyframes heartPop {
  0% { transform: scale(1); }
  35% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
```

### Comments preview + form

```html
{comments.length > 0 && (
  <>
    {showAll ? allComments : comments.slice(-2).map(...)}
    {comments.length > 2 && !showAll && (
      <button class="commentMore">◆ Ver {comments.length} comentarios →</button>
    )}
  </>
)}
<form class="commentForm">
  <Avatar size="xs" user={user} class="commentRowAvatar" />
  <input class="commentInput" placeholder="Escribí un comentario…" />
  <button type="submit" class="commentSubmit">{sendIcon}</button>
</form>
```

**`.commentRow`:**
- Display flex, gap 8px, padding `8px 14px 0` (siguiente comentario: padding-top 4px)

**`.commentRowAvatar`:** 22×22 redondo, Poppins 800 10px, color por usuario

**`.commentRowBody`:**
- Flex 1, bg `var(--bg-elevated)`, border `1px solid var(--border)`, radius 12, padding `6px 10px`

**`.commentRowAuthor`:** Poppins 700 12px, color `var(--text)`, letter-spacing `-0.01em`

**`.commentRowText`:** 12.5px, color `var(--text-secondary)`, line-height 1.4

**`.commentMore`:** JetBrains Mono 10.5px, color `var(--text-muted)`, padding `8px 14px 0`. Hover color `var(--accent-light)`

**`.commentForm`:**
- Display flex, gap 8px, padding `10px 14px 14px`, align center

**`.commentInput`:**
- Flex 1, bg `var(--bg-elevated)`, border `1px solid var(--border)`, radius 999, padding `7px 12px`, font-size 12.5px
- Focus: border `var(--accent)`, shadow `0 0 0 3px var(--accent-glow)`

**`.commentSubmit`:**
- 30×30, bg `var(--accent)`, color #fff, radius 999, shadow `0 4px 14px var(--accent-glow)`
- Disabled: opacity 0.4

---

## Widgets intercalados

**Cambio importante respecto del desktop:** el sidebar `<CompartidasSidebar />` no existe en mobile. Sus widgets se intercalan en el feed cada N posts (recomendado: cada 3-4 posts).

Convertir el actual `CompartidasSidebar.jsx` en `CompartidasInlineWidgets.jsx` que renderiza items individuales, y el `Compartidas.jsx` los inserta entre posts:

```jsx
{posts.map((post, i) => (
  <Fragment key={post._id}>
    <CompartidaCard post={post} />
    {/* Insertar widgets cada 3 posts */}
    {(i + 1) % 3 === 0 && <NextWidgetInRotation />}
  </Fragment>
))}
```

Orden sugerido de rotación: BG Watch → Próximas partidas → Top juegos → Quote → repeat.

### Widget — BG Watch

```html
<div class="inlineWidget">
  <div class="widgetEyebrow">
    <span class="left">◆ Tu BG Watch</span>
    <span class="right">100 partidas</span>
  </div>
  <h3 class="widgetTitle">¡Hiciste 100 partidas este año!</h3>
  <div class="widgetStats">
    <div class="widgetStat">
      <span class="widgetStatLabel">Este mes</span>
      <span class="widgetStatValue">12</span>
    </div>
    <div class="widgetStat">
      <span class="widgetStatLabel">Más jugado</span>
      <span class="widgetStatValue" style="font-size:1rem">Wingspan</span>
    </div>
  </div>
  <a class="widgetCta" href={`/bg-watch/${user.bggUsername}`}>+ Registrar partida</a>
</div>
```

- Background: gradient violeta sutil
  ```css
  background:
    radial-gradient(400px circle at 100% 0%, rgba(180,140,255,0.16), transparent 55%),
    linear-gradient(135deg, #1a1d2e, #0e1320);
  ```
- Border `1px solid rgba(180,140,255,0.25)`, radius 14, padding `14px 16px`
- Display flex column, gap 10
- `.widgetEyebrow`: flex justify-between, JetBrains Mono 10px letter-spacing `0.15em` uppercase. `.left` color violeta `#c2a7ff`, `.right` color `var(--text-muted)`
- `.widgetTitle`: Poppins 700 16px, letter-spacing `-0.025em`, line-height 1.2
- `.widgetStats`: flex gap 12, padding `10px 0`, border-top/bottom dashed violeta sutil
- `.widgetStat`: flex 1 text-center
- `.widgetStatLabel`: JetBrains Mono 9px uppercase letter-spacing `0.12em` color muted
- `.widgetStatValue`: Poppins 700 1.3rem, color `#c2a7ff`, letter-spacing `-0.03em`, line-height 1
- `.widgetCta`: align-self stretch, transparent, border `1px solid rgba(180,140,255,0.4)`, color `#c2a7ff`, padding 8, radius 8, Poppins 700 12px text-align center

### Widget — Próximas partidas

(Reutilizar la lógica del actual `CompartidasSidebar` "Próximas partidas"; solo cambia el wrapper a un single `inlineWidget` con la misma paleta violeta.)

### Widget — Quote of the week

Variant `.gold`:

```html
<div class="inlineWidget gold">
  <div class="widgetEyebrow"><span class="left">◆ Frase de la semana</span></div>
  <p class="quoteText">Lo mejor del juego de mesa no es ganar — es discutir 30 minutos por qué la madera vale más que la oveja.</p>
  <div class="quoteAttribution">
    <Avatar size="xs" />
    <span>— <strong>Pancho M.</strong> · Catán</span>
  </div>
</div>
```

- `.inlineWidget.gold` background:
  ```css
  background:
    radial-gradient(400px circle at 100% 0%, rgba(255,215,0,0.10), transparent 55%),
    linear-gradient(135deg, #211c14, #15191f);
  ```
- Border `1px solid rgba(245,166,35,0.25)`
- `.quoteText`: Poppins 500 italic 15px, line-height 1.4, color `var(--text)`, letter-spacing `-0.01em`, padding-left 28px, con `::before` `"` gigante (3.4rem) color `var(--orange)` opacity 0.4, position absolute top -2 left 0
- `.quoteAttribution`: JetBrains Mono 10.5px, color `var(--text-muted)`, letter-spacing `0.04em`, flex gap 8px align center

---

## Interactions & Behavior

### Post like

Heart-pop animation al dar like (`heartPop` keyframe). Si está logueado, hace `POST /api/compartidas/:id/like` y actualiza estado optimista. Si falla, revertir.

### Toggle comments

Mobile: en lugar de expandir inline el grupo completo de comments como en desktop, **abrir un sheet desde abajo** (action sheet style) con el thread completo. El "Ver N comentarios" abre el sheet, no expande inline. Posts con ≤ 2 comentarios siempre los muestran inline sin sheet.

(Si el sheet es demasiado para esta iteración, mantener el expand-inline como desktop pero con mejor jerarquía visual — comments stack desde abajo del card, indented 14px).

### Composer expand

Tap en `.composerTrigger` o cualquier `.composerActions` button abre `CreateCompartidaForm.jsx` como **full-screen modal** en mobile (en desktop puede ser inline expand, pero mobile usa modal full-screen para approvechar el viewport).

### Filter chips

Si se implementan, cliquear cambia el filter param de la query a `axios.get('/api/compartidas', { params: { filter: 'amigos' } })`. Sin endpoint backend, ocultarlas.

### Inline widgets

Se intercalan cada 3 posts (configurable). Si el usuario hizo dismiss de un widget BG Watch promo (no tiene `bggUsername`), no volver a mostrarlo en la misma sesión (state local + localStorage flag).

### Pull to refresh

Si el shell mobile lo soporta nativo (Capacitor / PWA), implementar `onPullToRefresh` que llama `loadFeed(1, true)`.

### Infinite scroll

En lugar del botón "Ver más compartidas" actual, en mobile usar **IntersectionObserver** sobre el último post para auto-cargar la siguiente página.

---

## State Management

Sin cambios respecto del componente actual:

```js
const [posts, setPosts] = useState([]);
const [featured, setFeatured] = useState(null);
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [loading, setLoading] = useState(true);
const [showCreate, setShowCreate] = useState(false);
const [filter, setFilter] = useState('all');  // NUEVO si se agregan chips
```

Handlers idénticos a los actuales (`handleCreated`, `handleDeleted`, `handleUpdated`).

---

## Design tokens

Idénticos al sistema general (ver `design_handoff_sidebar/` o `design_handoff_mobile/` para la lista completa):

```css
--bg-dark:    #0a0d15;
--bg-card:    #151c28;
--bg-paper:   #18202f;
--bg-elevated:#1d2532;
--accent:     #1888ef;
--accent-light:#00aeff;
--accent-glow:rgba(24,136,239,0.18);
--text:       #ffffff;
--text-secondary:#a8b4cc;
--text-muted: #5a6178;
--text-faint: #353d52;
--border:     #1e2a3d;
--border-strong:#2a3a55;
--border-accent:rgba(24,136,239,0.4);
--red:        #f31d77;
--green:      #00d984;
--orange:     #f5a623;
--purple:     #b48cff;
--gold:       #ffd700;
--green-10:   rgba(0,217,132,0.1);
--green-25:   rgba(0,217,132,0.25);
--purple-10:  rgba(180,140,255,0.1);
--purple-25:  rgba(180,140,255,0.3);
--orange-10:  rgba(245,166,35,0.1);
--orange-25:  rgba(245,166,35,0.3);
```

### Typography

- Display: `'Poppins', sans-serif` (500, 600, 700, 800)
- Body: `'Archivo', sans-serif` (400, 500, 600, 700)
- Mono: `'JetBrains Mono', ui-monospace, monospace` (400, 500, 600)
- Caveat (script): `'Caveat', cursive` (600, 700) — solo para captions de polaroid y el "em" del title

---

## Assets

**Polaroid placeholder:** sin imagen real, mostrar el fallback con pattern striped + texto mono `"foto"`. Cuando hay imagen, ocupa todo el `.polaroidPhoto`.

**Avatar colors:** cada usuario tiene un color asignado (probablemente derivado del username). Mantener la lógica actual de `Avatar` component.

**Iconos:** todos inline SVG (heart, comment, share, link, dice, photo, dots). Los mismos del componente actual son válidos; solo cambian dimensiones (14-16px en mobile vs 15-18 en desktop).

---

## Files (in this handoff)

- **`Compartidas Mobile.html`** — prototipo mobile. Inspeccionar para colores, hover states, spacing exacto.
- **`Compartidas Reimagined.html`** — referencia desktop para comparar comportamiento y estados.
- **`Mobile Reimagined.html`** — chrome mobile (Navbar + BottomNav) que envuelve esta pantalla.

---

## Checklist de implementación

### Page-level
- [ ] Crear page header mobile-only (con `.pageTitle` Caveat-em y stats row)
- [ ] Implementar composer one-liner (tap para abrir modal full-screen)
- [ ] Implementar filter chips horizontal (opcional)
- [ ] Convertir `CompartidasSidebar` en `CompartidasInlineWidgets` que renderiza items individuales
- [ ] Insertar widgets cada N posts en el feed
- [ ] Cambiar "Ver más" button por infinite scroll vía IntersectionObserver

### Featured broadside
- [ ] Apilar vertical en mobile (vs grid 2-col en desktop)
- [ ] Polaroid al centro (no a la derecha)
- [ ] Mantener label rotado y gradient bg

### Post card
- [ ] Header con avatar 38×38, name + BGW chip + privacy
- [ ] Body con title (opcional) + text + expand button
- [ ] Photo grids (1/2/3/4) con polaroids responsive
- [ ] Mesa ticket con perforación (semicírculos)
- [ ] Footer con reactions + share group
- [ ] Heart pop animation al dar like
- [ ] Comments preview inline (últimos 2)
- [ ] Comment form siempre visible

### Polaroid
- [ ] Background `#f4eeda` paper-like
- [ ] Caveat caption en bottom 4px
- [ ] Tape variants (left/center/right) rotadas
- [ ] Rotación variable por position en grid
- [ ] Hover (en mobile no aplica, pero respetar el `cursor: pointer` para tap open lightbox)

### Inline widgets
- [ ] BG Watch (purple-tinted gradient + stats grid)
- [ ] Próximas partidas (variant del widget actual)
- [ ] Top juegos
- [ ] Quote of the week (gold-tinted, italic Poppins)

### Sistema
- [ ] Verificar safe-area iOS (`padding-bottom: max(100px, env(safe-area-inset-bottom) + 90px)`)
- [ ] Lightbox cuando se tappea una polaroid (mantener actual `lightbox` state)
- [ ] Pull-to-refresh si PWA/Capacitor
- [ ] Skeleton loader mobile (igual lógica que actual `CompartidaSkeleton.jsx` pero adaptado al layout nuevo)
- [ ] Verificar contraste WCAG AA (caption mono 9.5px sobre `var(--accent-glow)`, etc.)
- [ ] Probar en iPhone SE (375px) y Pixel small viewports
