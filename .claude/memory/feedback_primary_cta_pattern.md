# Patrón de botón primario — clon del handoff "Nuevo evento"

**Desde 2026-05-26** — el botón primario amber en TODA la app sigue el mismo patrón
de hover, calcado del botón "Nuevo evento" en
[`handoff/eventos/reimagined-styles.css`](../../handoff/eventos/reimagined-styles.css)
(líneas 412-432).

## Patrón canónico

```css
/* BASE */
.btnPrimary {
  background: var(--amber);
  color: var(--on-amber);
  box-shadow: 0 4px 16px var(--amber-glow);   /* glow base — "lifted" */
  transition: all var(--transition);
}

/* HOVER */
.btnPrimary:hover {
  background: var(--amber-light);
  color: var(--on-amber);                     /* explícito, no inherit */
  box-shadow: 0 4px 22px var(--amber-glow);   /* mismo glow pero más grande */
}
```

## Decisiones clave que se tomaron en el camino

- **El glow va en el BASE también**, no sólo en hover. El hover solo lo intensifica
  de 16→22px. Sin el glow base, el hover parece "aparecer de la nada" en vez de
  amplificar.
- **Hover NO oscurece** (no usa `--amber-dark`). Va a `--amber-light` y compensa la
  pérdida de contraste con la glow shadow más grande. Esto contradice la convención
  general de "darken on hover" pero es lo que dicta el handoff.
- **`color: var(--on-amber)` explícito en `:hover`** — aunque CSS lo heredaría del
  base, lo declaramos para defendernos del cascade (ej. `a:hover { color: ... }` de
  reset globals, parent specificity).
- **`transition: all var(--transition)`** (= `0.2s ease`) — necesario para que tanto
  el bg como el box-shadow animen suavemente. Si la transition es específica
  (`transition: background 0.15s`), el shadow cambia instantáneamente y rompe el
  efecto.

## Cuándo aplicar

Cualquier selector que matchee `btn|cta|fab|submit` (case-insensitive) y tenga:
- `background: var(--amber);`
- `color: var(--on-amber);`

→ debe seguir EXACTAMENTE este patrón (no `0 4px 14px`, no `0 6px 18px`, no
`box-shadow: var(--shadow-amber)`).

## NO aplicar a

- Avatars (`.avatar`, `.userAvatar`, `.headerAvatar`) — usan amber como bg de
  fallback, no son botones
- Badges (`.badge`, `.hostBadge`, `.unreadBadge`, `.ludotecaMineBadge`)
- Chips/cells (`.chipActive`, `.daySelected`, `.filterChipActive`, `.themeOptionActive`)
- Message bubbles (`.bubble`, `.ownMessage .bubble`)
- Sub-botones dentro de comentarios con intención distinta (ej.
  `.btnCommentEdit:hover { color: var(--amber) }` — ahí el hover ES el cambio de
  color, no quiere shadow)

## Tokens involucrados (`client/src/index.css`)

```css
--amber: #1888ef;
--amber-light: #00aeff;
--on-amber: #ffffff;
--amber-glow: rgba(24, 136, 239, 0.15);
--transition: 0.2s ease;
```

## Por qué no usar `--shadow-amber`

`--shadow-amber: 0 0 20px rgba(24, 136, 239, 0.3)` está definido como token y se
usaba en algunos lugares (ej. Dashboard.module.css), pero NO matchea el handoff —
es un glow concéntrico sin Y-offset. El handoff usa `0 4px 16px` (con offset hacia
abajo) que da más sensación de "lifted/floating". Si en el futuro se quiere un
token semántico, debería ser un nuevo `--shadow-cta-base` y `--shadow-cta-hover`,
no reusar `--shadow-amber`.
