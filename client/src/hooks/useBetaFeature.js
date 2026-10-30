import { useAuth } from "../context/AuthContext";
import { useSectionEnabled } from "./useSectionEnabled";

// Feature en piloto (ver server/config/betaFeatures.js): la ven los admins y
// los usuarios que un admin habilitó desde /panel-admin (`user.betaFeatures`),
// siempre que el interruptor de la sección esté prendido. Apagado = solo
// admins. Respeta "ver como usuario": un admin previsualizando la ve solo si
// está en la lista. El server aplica la misma regla (`requireBetaFeature`).
export function useBetaFeature(key) {
  const { user } = useAuth();
  const isSectionEnabled = useSectionEnabled();
  if (!user) return false;
  if (user.isAdmin) return true;
  return (
    isSectionEnabled(key) &&
    Array.isArray(user.betaFeatures) &&
    user.betaFeatures.includes(key)
  );
}

export default useBetaFeature;
