---
name: feedback-sticky-appframe-gap
description: "Sticky elements — gap-when-scrolled comes from the `top` offset (not margin-top), and on desktop must clear the fixed `.appFrame` 0.75rem border"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 262ded91-5358-4551-83cf-07058a9cd6b9
---

For any `position: sticky` element, the gap it shows from the top **when scrolled/pinned** is governed by its `top` offset, **NOT** `margin-top`. `margin-top` only shifts the initial in-flow position (and is "consumed" as you scroll); it does not change where the element pins. So to add breathing room when stuck, increase `top`.

On **desktop only** (`@media (--desktop)`, ≥960px), the app shell renders `.appFrame` — a `position: fixed` overlay (z-index 1000, `pointer-events: none`) with a `border: 0.75rem solid var(--bg-card)` on top/right/bottom (no left), defined in [client/src/index.css](client/src/index.css). A sticky element pinning at `top: 12px` sits flush against that 12px frame border, and since cards are also `--bg-card` they visually merge with no separation.

**Why:** the user wants sticky panels/asides/side-columns to stay clear of the frame with a real gap when scrolled — matching the eventos aside, which pins at `top: 24px` (= 12px frame + 12px gap).

**How to apply:** for a desktop sticky, set `top` to clear the frame plus a ~12px gap → effectively `0.75rem + 12px = 24px` on desktop. If the base `top` already carries `var(--navbar-h, 64px)` for the 881–959px band (mobile navbar present, NO frame there), keep that base and add the frame clearance only inside `@media (--desktop)`, e.g. `top: calc(var(--navbar-h, 64px) + 0.75rem + 12px)`. Examples in repo: `.aside` in [EventoDetail.module.css](client/src/pages/eventos/EventoDetail.module.css) (`top: 24px`) and `.playsSideCol` in [BgWatchProfile.module.css](client/src/pages/bg-watch/BgWatchProfile.module.css). Also reset sticky (`position: static`) + any alignment `margin-top: 0` at `--tablet` where columns stack. See [[padding_system]].
