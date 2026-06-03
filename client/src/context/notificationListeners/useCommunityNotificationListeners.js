import { useSocketListeners } from "./useSocketListeners";

// Listeners de comunidades. Side-effect crítico: cuando al usuario lo
// aceptan/rechazan en una comunidad (`community:join-resolved`), recargar las
// memberships del CommunityContext para que el selector de comunidad y las
// preferencias (/perfil) reflejen el cambio SIN recargar la página.
//
// El reload NO se gatea por sección: queremos que las memberships estén
// siempre frescas (incluso si la UI de comunidades estuviera oculta). Por eso
// `community:join-resolved` no figura en EVENT_SECTION → `gated` lo deja pasar.
export function useCommunityNotificationListeners({
  socket,
  gated,
  reloadCommunity,
}) {
  useSocketListeners(
    socket,
    () => ({
      "community:join-resolved": gated("community:join-resolved", () => {
        reloadCommunity?.();
      }),
    }),
    [gated, reloadCommunity],
  );
}
