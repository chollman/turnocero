# Plan: Análisis de animaciones para Turnocero

## Contexto

La app funciona bien pero las interacciones clave carecen de feedback visual animado — el usuario hace clic y el estado cambia de golpe. Esto hace que acciones importantes (unirse a una mesa, dar like, recibir notificaciones) no se sientan satisfactorias. El objetivo es identificar dónde agregar animaciones CSS que refuercen el engagement sin sobrecargar la UI.

## Estado actual de animaciones

**Ya tiene animaciones:**

- `SplashScreen`: piezas cayendo, logo pulsando, dots bouncing ✅
- `ToastContainer`: slideIn desde la derecha con progress bar ✅
- `ChatLauncher`: slideUp al abrir, scale en hover ✅
- `BottomNav`: kSlideLeft/kSlideRight al cambiar de sección ✅
- `Noticias`: shimmer skeleton loading ✅
- `Dashboard`: spin loader, hover lift (-2px) en cards ✅

**Sin animaciones en acciones clave:** el like, el join a mesa, la apertura de comentarios, los mensajes nuevos, y el badge de notificaciones.

---

## Oportunidades priorizadas por impacto

### 🔴 Alta prioridad (acciones frecuentes, feedback crítico)

#### 1. Like en CompartidaCard — `client/src/pages/compartidas/CompartidaCard.module.css`

- **Problema**: `handleLike` hace update optimista pero el corazón `❤` no tiene ninguna animación.
- **Solución**: `@keyframes heartPop` → `scale(1.4) → scale(1.0)` de 300ms en `.likeHeart` cuando `liked` se activa. Agregar clase `.likeHeart--pop` por 300ms via JS.
- **Impacto**: Muy alto — el like es la interacción social más frecuente.

#### 2. Unirse a mesa (TableCard) — `client/src/pages/dashboard/TableCard.module.css`

- **Problema**: Al unirse, la card cambia instantáneamente de estado (border gris → verde `joined`). No hay confirmación visual del éxito.
- **Solución**: Al aplicar clase `.joined`, agregar `@keyframes joinFlash` → brief scale(1.03) + border glow en amber → settle. Transition animada de `border-color`.
- **Impacto**: Alto — es el momento más importante del flujo principal.

#### 3. Sección de comentarios (CompartidaCard) — mismo archivo CSS

- **Problema**: `setShowComments(true)` hace aparecer `.comments` de golpe, sin transición.
- **Solución**: `@keyframes slideDown` → `max-height: 0; opacity: 0` → `max-height: 500px; opacity: 1`. O usar `animation: fadeSlideIn 0.2s ease`.
- **Impacto**: Alto — toggle de comentarios es muy frecuente.

#### 4. Badge de notificaciones — `client/src/components/layout/Sidebar.module.css` / `BottomNav.module.css` / `Navbar.module.css`

- **Problema**: El badge de `unreadCount` se actualiza en número pero no hay ninguna animación cuando llega una notificación nueva.
- **Solución**: Cuando `unreadCount` aumenta, aplicar `@keyframes badgePop` → `scale(1.5) → scale(1.0)` con color flash. Agregar clase temporaria via `useEffect` en NotificationContext.
- **Impacto**: Alto — es el principal indicador de actividad de la app.

---

### 🟡 Prioridad media (pulido de UX)

#### 5. Mensajes nuevos en DirectChat / AdminChat — `client/src/pages/messages/DirectChat.module.css`

- **Problema**: Los mensajes nuevos que llegan por socket aparecen instantáneamente en la lista.
- **Solución**: `@keyframes messageIn` → `translateY(8px) opacity:0` → `translateY(0) opacity:1` de 200ms aplicado al último mensaje renderizado.
- **Impacto**: Medio — refuerza la sensación de chat en tiempo real.

#### 6. Entrada de cards en Dashboard — `client/src/pages/dashboard/Dashboard.module.css`

- **Problema**: Las TableCards cargan todas juntas sin transición de entrada.
- **Solución**: Staggered `@keyframes cardEnter` (fadeInUp) con `animation-delay: calc(var(--i) * 60ms)` usando inline style `--i` según índice.
- **Impacto**: Medio — hace la carga inicial más pulida.

#### 7. Menú contextual ⋯ (CompartidaCard)

- **Problema**: `.menu` aparece/desaparece sin animación cuando `menuOpen` cambia.
- **Solución**: `@keyframes menuFade` → `opacity:0; translateY(-4px)` → `opacity:1; translateY(0)` de 130ms.
- **Impacto**: Medio — detalles de polish.

#### 8. LoginPromptModal — `client/src/components/shared/LoginPromptModal.module.css`

- **Problema**: El modal aparece de golpe (render condicional directo).
- **Solución**: Overlay con `@keyframes fadeIn` + modal inner con `@keyframes scaleIn` (`scale(0.95) → scale(1)`).
- **Impacto**: Medio — el modal aparece en múltiples secciones.

#### 9. Reacciones emoji en TableDetail — `client/src/pages/tables/TableDetail.module.css`

- **Problema**: El picker de `REACTION_EMOJIS` aparece de golpe. Al seleccionar, no hay feedback.
- **Solución**: Picker con `@keyframes slideUpFade`. Emoji seleccionado: `@keyframes emojiBounce` → scale(1.4) → scale(1).
- **Impacto**: Medio — feature divertido, animations lo hacen más satisfactorio.

---

### 🟢 Prioridad baja (polish opcional)

#### 10. SeatTrack (TableCard / TableDetail)

- **Problema**: La barra de lugares (`seatFill`) no anima al cambiar su width.
- **Solución**: `transition: width 0.4s ease` en `.seatFill`. Simple pero efectivo.

#### 11. Compartida "featured" badge

- **Problema**: El badge `🔥 Compartida del día` es estático.
- **Solución**: `@keyframes featuredPulse` → glow de box-shadow que va y viene.

#### 12. Friend request button (UserProfilePublic)

- **Problema**: El estado "Enviar solicitud" → "Solicitud enviada" cambia sin animación.
- **Solución**: `@keyframes checkFlash` → color verde + scale breve al éxito.

---

## Archivos críticos

| Archivo                                                                                          | Animaciones a agregar                                     |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `client/src/pages/compartidas/CompartidaCard.module.css`                                         | heartPop (like), slideDown (comentarios), menuFade (menú) |
| `client/src/pages/compartidas/CompartidaCard.jsx`                                                | Clase temporal para heartPop                              |
| `client/src/pages/dashboard/TableCard.module.css`                                                | joinFlash (unirse), seatFill transition                   |
| `client/src/pages/dashboard/Dashboard.module.css`                                                | cardEnter staggered                                       |
| `client/src/pages/dashboard/Dashboard.jsx`                                                       | Pasar `--i` como style a TableCard                        |
| `client/src/components/layout/Sidebar.module.css` + `BottomNav.module.css` + `Navbar.module.css` | badgePop                                                  |
| `client/src/pages/messages/DirectChat.module.css`                                                | messageIn                                                 |
| `client/src/components/shared/LoginPromptModal.module.css`                                       | fadeIn + scaleIn                                          |
| `client/src/pages/tables/TableDetail.module.css`                                                 | slideUpFade (picker), emojiBounce                         |

## Verificación

- Testear cada animación manualmente en el flujo: Dashboard → unirse a mesa → ver feedback verde.
- Testear like en Compartidas: corazón debe hacer pop.
- Recibir un DM: verificar que el mensaje aparece con slide.
- Hacer aparecer el badge de notificaciones: verificar badgePop.
- Probar en mobile (Chrome DevTools): las animaciones no deben interferir con el scroll.
- Verificar `@media (prefers-reduced-motion: reduce)` si se quiere ser accesible — desactivar keyframes y dejar solo transitions.
