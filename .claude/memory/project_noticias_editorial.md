---
name: project-noticias-editorial
description: 'Noticias redesign — editorial "newspaper" portada + article + WordPress-style creator (branch feature/noticias-editorial)'
metadata:
  node_type: memory
  type: project
  originSessionId: 67ab2902-4f2a-4536-94b0-0c8cee67db65
---

Rediseño de Noticias a un lenguaje **editorial/periódico** (handoff `handoff/design_handoff_noticias/`). Rama `feature/noticias-editorial` (no commiteada salvo que se pida). 3 partes con rutas propias.

**Schema (`server/models/Noticia.js`)** ahora tiene: `category` (enum `general|comunidad|resena|evento|producto|envivo`, default general), `kicker`, `dek` (bajada/excerpt), `tags[]`, `body` = **HTML enriquecido** (antes texto plano, máx subido a 40000), `image.caption`, `quote{text,author,context}` (breakout), `featured` (→ lead de portada), `isBrief` (→ columna Breves), `status` (`draft|published`, default published para no romper viejas), `publishedAt`. `Noticia.CATEGORIES` exportado.

**Editor WordPress-style:** se REUTILIZA y extiende `RichTextEditor.jsx` con props `extended` (H4, hr, code, alineación, YouTube, drag-drop/paste de imágenes) y `uploadUrl`. Nodos custom en `components/shared/noticiaEditorExtensions.js` (YoutubeEmbed→iframe youtube-nocookie + TextAlign global-attr, sin deps nuevas). Sanitización: `sanitizeNoticiaHtml` (server, alias genérico `sanitizeRichHtml`) + `NOTICIA_SANITIZE_CONFIG`+`registerNoticiaHook` (cliente, via `RichTextContent extended`) — superset que permite h4/hr/code/pre/style(solo text-align)/iframe(solo youtube-nocookie con sandbox forzado). **Los dos allow-lists DEBEN coincidir.**

**Reseñas de Compartidas usan el MISMO editor enriquecido** (pedido 2026-06-15): `CreateCompartidaForm` + `ResenaCard` (editor inline) pasan `extended`; `ResenaCard` renderiza con `RichTextContent extended`; el router `compartidas.js` sanitiza el body de reseña con `sanitizeRichHtml` (antes `sanitizeCompartidaHtml`). `RichTextContent.module.css` ganó estilos para h4/hr/code/pre/iframe. Juntadas (texto plano) sin cambios.

**Páginas (`client/src/pages/noticias/`):** `Noticias.jsx` (portada: masthead serif "El Noticiero de {brandName}", section tabs por category + búsqueda debounced, lead=featured, grid de stories con kicker de color, columna Breves, breakout, "Ver más", skeleton editorial, EmptyState first/filtered). `NoticiaDetail.jsx` (usa `ArticleView` + byline share group WA/TG/X/copiar + lightbox `<Modal>` + related + Helmet OG con dek/cover 1200×630). `ArticleView.jsx` (render reutilizable: kicker, headline serif, dek, byline, hero+epígrafe, body con drop-cap via `renderArticleBody` que parte texto plano por \n\n o usa RichTextContent extended, breakout, separador `<Meeple>`, tags, related — lo consume también el **preview** del form). `NoticiaForm.jsx` + `CreateNoticia`/`EditNoticia` (rutas dedicadas `/noticias/crear` y `/noticias/:id/editar`, AdminRoute+SectionGate; se eliminó el edit inline). Utils nuevos: `noticiaCategories.js` (key→{label,color}, `NOTICIA_SECTIONS` con labels plural para tabs), `readingTime.js`, `share.js#buildNoticiaShare`.

**Shortlinks/OG:** ya existían para `noticia`; sólo se enriqueció el OG endpoint (dek como descripción + category) y `NoticiaDetail` Helmet. `middleware.js#handleNoticia` sin cambios (lee `data.body`=dek).

**Gotcha verificación:** la sección `noticias` está **disabled** en el SiteConfig de dev → SectionGate redirige a `/` en hard-reload de `/noticias/:id` (race auth/config, pre-existente). Para verla, login admin (`reference_test_credentials`) y/o habilitar temporalmente `noticias` vía `PATCH /api/site-config`. El login proxeado del browser daba 500 (quirk del proxy) — inyectar el JWT de curl en `localStorage` token+turnocero_token.

Tests: server +integración noticias (drafts ocultos, sanitización, partial update, inline-image, draft→publish emit) + unit readingTime/sanitizeNoticiaHtml; cliente ArticleView/NoticiaForm/Noticias/NoticiaDetail + utils. Todo verde (cliente 2738+, server 1666+).
