/**
 * Maps a URL pathname to a stable nav id.
 * Used by Sidebar and GuestSidebar (incl. their mobile drawer modes) to
 * highlight the active nav item. Keep this function in sync with the route
 * tree in App.jsx.
 */
export function getActiveNavId(pathname) {
  if (pathname === "/mi") return "feed";
  if (pathname.startsWith("/panel-admin")) return "panel";
  if (pathname === "/mesas/crear") return "create";
  if (pathname.startsWith("/mesas")) return "dash";
  if (pathname.startsWith("/noticias")) return "noticias";
  if (pathname.startsWith("/torneos")) return "torneos";
  if (pathname.startsWith("/eventos")) return "eventos";
  if (pathname.startsWith("/calendario")) return "calendario";
  if (pathname === "/" || pathname.startsWith("/compartidas"))
    return "compartidas";
  if (pathname === "/notificaciones") return "notif";
  if (pathname.startsWith("/mensajes-admin")) return "adminChat";
  if (pathname.startsWith("/mensajes")) return "mensajes";
  if (pathname === "/bg-watch") return "bgwatchCta";
  if (pathname.startsWith("/bg-watch")) return "bgwatch";
  if (pathname.startsWith("/usuarios")) return "users";
  if (pathname.startsWith("/perfil")) return "profile";
  if (pathname.startsWith("/base-de-datos")) return "db";
  if (pathname.startsWith("/utilidades")) return "utilidades";
  return null;
}
