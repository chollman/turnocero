import { useContext } from "react";
import { CommunityContext } from "../context/CommunityContext";

// Nombre de marca a mostrar en texto user-facing (wordmark, <title>, prose).
// Fuente única: `CommunityContext.brand.name`, que ya resuelve:
//   - modo tenant (subdominio) → nombre/brandName de esa comunidad
//   - skin de comunidad con brandName aplicado en el sitio normal → ese brandName
//   - resto → "TurnoCero"
// Usarlo en vez de hardcodear "TurnoCero" para que el subdominio reemplace la
// marca en todos lados. NO usar para referencias a la PLATAFORMA (ej. la página
// Colabora / donaciones o los términos legales), que siguen siendo "TurnoCero".
//
// Lee el contexto con useContext (null-safe), NO con useCommunity(): así los
// componentes que lo usan no crashean en tests/montajes sin CommunityProvider —
// simplemente caen a "TurnoCero".
export function useBrandName() {
  const ctx = useContext(CommunityContext);
  return ctx?.brand?.name || "TurnoCero";
}
