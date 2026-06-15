# Handoff: Noticias Reimaginado · TurnoCero

## Overview

Rediseño de la sección **Noticias** con un lenguaje **editorial / periódico impreso**:
masthead de diario, nota principal (lead) a dos columnas, grid de notas destacadas +
columna de "Breves", cita destacada (breakout), y una vista de **artículo** larga con
tipografía serif, drop cap, epígrafes y lecturas relacionadas.

Reemplaza el feed actual (grid de cards con imagen + título + body + link) por una
portada jerarquizada tipo periódico y un detalle de lectura inmersiva.

Dos pantallas:
- **Portada** (`ListScreen`) — masthead + tabs de sección + lead + grid de notas + breves + cita
- **Artículo** (`ArticleScreen`) — kicker, headline serif, dek, byline con share, hero con epígrafe, cuerpo editorial (drop cap, h2, breakout, separador), footer "Seguí leyendo"

---

## ⚠️ Importante: el rediseño expande el modelo de datos actual

El diseño es **editorial-first** y asume campos que **hoy no existen** en el backend.
Esto es una decisión de producto a validar — no un 1:1 con el modelo real.

### Modelo REAL hoy (`/api/noticias`)
```ts
noticia = {
  _id, title?, body?, image?: { url }, link?, linkLabel?, createdAt
}
```
- Todos los campos de texto son **opcionales** (una noticia puede ser solo una imagen).
- CRUD **admin-gated** (`user.isAdmin`): crear / editar inline / eliminar (con confirm).
- Imagen subida por dropzone (drag/paste/click, JPG/PNG/WEBP, máx 5 MB), multipart.
- Feed paginado (`page`/`limit 10`, "Ver más noticias"), grid 1–3 col según cantidad.
- Detalle = misma card + **compartir** (WhatsApp / Telegram / X / copiar link) + OG/meta + lightbox.
- Estados: skeletons de carga, empty ("Sin noticias todavía" + CTA admin).

### Lo que el rediseño AGREGA (decisiones a confirmar con backend)
| Campo / concepto | En el diseño | ¿Existe hoy? |
|---|---|---|
| **category / categoryKey** (EN VIVO, EVENTO, RESEÑA…) | sí (kickers de color) | ❌ no |
| **kicker** | sí | ❌ no |
| **dek** (bajada) | sí | ❌ (se puede derivar de `body`) |
| **byline / author** (avatar + nombre) | sí | ❌ no (no hay autor por noticia) |
| **isLead / isFeatured** (jerarquía portada) | sí | ❌ no |
| **quote** (breakout: text/author/context) | sí | ❌ no |
| **image.caption** (epígrafe) | sí | ❌ (solo `image.url`) |
| **secciones/tabs** (Comunidad, Reseñas…) | sí | ❌ no hay taxonomía |
| **briefs** ("Breves") | columna lateral | ❌ no existe ese tipo |
| **lectura N min** | sí | ❌ (calculable de `body`) |
| cuerpo **multipárrafo** con h2/links | sí | parcial (`body` es texto plano) |

> **Recomendación**: dos caminos.
> 1. **Mínimo** (sin tocar backend): mapear lo existente → masthead fijo, una nota
>    como lead (la más reciente con imagen), el resto al grid, drop derivado de `body`,
>    sin tabs/breves/quote/byline. El editorial se logra con tipografía, no con datos nuevos.
> 2. **Completo** (con backend): sumar `category`, `dek`, `author`, `featured`,
>    `caption`, `quote` y un tipo `brief`. Habilita la portada jerarquizada real.
>
> Definir con el equipo cuál se implementa antes de codear.

---

## About the Design Files

Referencias de diseño en HTML + JSX vanilla (Babel standalone). **No es código para
copiar** — recrear en React + Vite + CSS Modules sobre la página existente
`client/src/pages/noticias/`.

- `Noticias Reimagined.html` — entry (abrir; pestañas Portada / Artículo)
- `noticias-app.jsx` — `ListScreen` + `ArticleScreen` + data mock (STORIES, BRIEFS, SECTIONS)
- `noticias-styles.css` — todo el sistema editorial
- `tc-shared.jsx` / `tc-design.css` — Icon/Avatar/helpers + tokens

---

## Fidelity

**Hi-fi.** Tipografía, jerarquía, colores y espaciado finalizados. Imágenes son
placeholders (fallback con epígrafe) — se reemplazan por `image.url` real.

---

## Design tokens (de `tc-design.css`)

```
--bg-dark #0a0d15  --bg-paper #18202f  --bg-card #151c28  --border #1e2a3d
--accent #1888ef  --accent-light #00aeff  --accent-glow rgba(24,136,239,.18)
--text-primary #fff  --text-secondary #a8b4cc  --text-muted #5a6178
--red --gold --green (kickers por categoría)
--font-serif Lora  ← la fuente protagonista (headlines, dek, cuerpo, drop cap)
--font-display Poppins  --font-mono JetBrains Mono (kickers, metadatos, labels)
```

> El acento de Noticias es el **azul de marca** (no púrpura como BG Watch). El gesto
> editorial vive en **Lora serif** + reglas/hairlines + mono para metadatos.

---

## Portada (`ListScreen`)

1. **Masthead** — fecha + "Edición #N" a la izquierda, título serif central
   ("El *Noticiero* de TurnoCero"), tagline a la derecha; reglas dobles arriba/abajo.
   (Estático/editorial — no requiere datos nuevos.)
2. **Section tabs** — Portada / Comunidad / Reseñas / Eventos / Producto + buscador.
   *(Requiere taxonomía de categorías — opción "Completo".)*
3. **Lead** — dos columnas: bloque de texto (categoría ● color, headline serif grande,
   dek itálica, byline con avatar + tiempo + lectura) y imagen 4:3 con epígrafe.
4. **Grid de notas** (`storiesCol`) — 2 col de `article.story`: imagen 16:10, kicker de
   color por categoría, headline serif, dek, byline mono. Hover: headline → accent.
5. **Breves** (`briefsCol`) — columna lateral de items compactos (kicker + título serif
   + meta/fecha). *(Tipo `brief` propio — opción "Completo", o reutilizar noticias sin imagen.)*
6. **Breakout** — cita destacada con comilla gigante y atribución.

Layout: `gridArea` = `storiesCol 1fr` + `briefsCol`. Responsive: <900px una columna,
storyGrid a 1 col.

---

## Artículo (`ArticleScreen`)

- **backBtn** "Volver al noticiero"
- **kicker** (categoría · kicker) → mono uppercase accent
- **headline** serif clamp(2.4–3.6rem) + **dek** serif itálica 22px
- **byline** — avatar md + autor (Poppins 700) + fecha/lectura (mono) + **share group**
  (compartir / copiar link). En real: WhatsApp / Telegram / X / copiar (ya existe).
- **hero** 16:9 con epígrafe en gradiente
- **body** serif 18px/1.7 con:
  - **drop cap** en la primera letra (4.6rem, color tweakable — ver Tweaks)
  - `h2` de sección, links subrayados, **breakout** intercalado, **separador** "— ◆ —"
  - nota de cierre itálica
- **footer** "Seguí leyendo" → grid de `relatedCard` (kicker + título serif)

> El cuerpo del diseño es multipárrafo con subtítulos/links. El `body` real es texto
> plano: para fidelidad total conviene migrar a un cuerpo con formato (markdown/bloques),
> o renderizar párrafos por `\n\n` y aceptar que h2/links son del modo "Completo".

---

## Tweak incluido

- **Color de drop cap** — accent / gold / red / green (inyecta `::first-letter` color).
  Detalle de marca; mantener accent por defecto.

---

## Estados a preservar del código real

- **Carga**: skeletons (imagen + 3 líneas) — el rediseño debe tener su versión editorial.
- **Vacío**: hoy "📰 Sin noticias todavía" + CTA admin → **usar el nuevo sistema de
  Empty States** (handoff `design_handoff_empty_states`) con la ilustración de Noticias,
  no el emoji.
- **Admin**: crear (form con dropzone) / editar inline / eliminar (confirm). El rediseño
  no muestra el modo admin — **hay que diseñarlo**: ¿dónde va "+ Nueva noticia", el form
  de creación (título/body/link/linkLabel/imagen) y las acciones editar/eliminar en las
  cards y en el detalle? Definir antes de implementar.
- **Compartir**: WhatsApp / Telegram / X / copiar (con feedback "¡Copiado!") — mapear a
  los `shareBtn` del byline del artículo.
- **OG/meta** (Helmet): título, descripción, og:image — mantener.
- **Lightbox** de imagen — mantener.
- **Paginación** "Ver más noticias" — integrar al final del grid de portada.

---

## Integración

- Reescribir `Noticias.jsx` (portada) y `NoticiaDetail.jsx` (artículo) + sus `.module.css`
  con el sistema editorial. Mantener `useAuth`/`isAdmin`, axios, Helmet, lightbox, share.
- Definir con backend si se agregan campos (category, dek, author, featured, caption,
  quote, brief) o si se hace la versión "Mínima" sobre el modelo actual.
- Si se agregan categorías: alimentan tabs + kickers de color (mapa categoryKey → color).

---

## Checklist

- [ ] **Decidir alcance**: versión Mínima (sin backend) vs Completa (con campos nuevos)
- [ ] Masthead editorial (fecha, edición, título serif, reglas)
- [ ] Lead a 2 columnas (texto + imagen con epígrafe)
- [ ] Grid de notas con kickers de color por categoría
- [ ] Columna "Breves" (o decidir no incluirla en v1)
- [ ] Section tabs + buscador (si hay taxonomía)
- [ ] Breakout / cita destacada
- [ ] Artículo: drop cap, dek, byline+share, hero+epígrafe, h2, separador, relacionadas
- [ ] Tweak color de drop cap (default accent)
- [ ] Estados: loading (skeleton editorial), **empty (sistema nuevo)**, **modo admin (diseñar)**
- [ ] Conservar: share WA/TG/X/copy, OG/meta, lightbox, paginación, CRUD admin
- [ ] Responsive <900px (una columna)
- [ ] Accesibilidad: jerarquía de headings, foco en cards/links, contraste AA
