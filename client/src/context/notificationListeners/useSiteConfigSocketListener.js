import { useSocketListeners } from "./useSocketListeners";

// El admin cambia toggles en /panel-admin → server broadcast
// `site-config:updated` con el nuevo SiteConfig → todos los clientes
// actualizan su context (gates de sección, etc).
export function useSiteConfigSocketListener({ socket, applyServerConfig }) {
  useSocketListeners(
    socket,
    () => ({
      "site-config:updated": (config) => applyServerConfig(config),
    }),
    [applyServerConfig],
  );
}
