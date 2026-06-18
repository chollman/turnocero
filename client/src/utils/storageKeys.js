// Centralización de las keys de Web Storage usadas en la app. Antes vivían
// como strings sueltos en AuthContext, VerifyEmail, ResetPassword, etc. —
// un typo o rename silencioso podía romper la app sin warning.
//
// Object.freeze evita mutación accidental.

export const STORAGE_KEYS = Object.freeze({
  // localStorage
  TOKEN: "token",
  VIEW_AS_USER: "viewAsUser",
  THEME: "turnocero_theme",
  SIDEBAR_COLLAPSED: "turnocero_sidebar_collapsed",
  // Última ruta visitada — para restaurarla cuando la PWA (standalone) arranca
  // en el start_url "/" y pierde el deep-link al refrescar/reabrir.
  LAST_ROUTE: "turnocero_last_route",
  // Estado del prompt proactivo de notificaciones push: JSON
  // { dismissedAt: epochMs|null, sessionCount: number }.
  PUSH_PROMPT: "turnocero_push_prompt",
  // sessionStorage
  BANNED_MESSAGE: "bannedMessage",
  FLASH_MESSAGE: "flashMessage",
  PENDING_VERIFY_EMAIL: "turnocero_pending_verify_email",
});
