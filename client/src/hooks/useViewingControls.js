import { useState } from "react";
import { useCommunity } from "../context/CommunityContext";
import { useNotifications } from "../context/NotificationContext";

// Controles compartidos de preferencias de comunidad: el set "ver juntas", el
// toggle de viewing y la elección de skin, con un guard de error común. Lo usan
// el CommunitySwitcher (shell) y CommunityPrefs (/perfil) para no duplicar la
// lógica. `guard` se expone para que callers (p. ej. CommunityPrefs al salir de
// una comunidad) reusen el mismo manejo de busy/error.
export default function useViewingControls() {
  const { memberships, viewing, setViewingPref, setSkinPref } = useCommunity();
  const { addToast } = useNotifications();
  const [busy, setBusy] = useState(false);

  // viewing vacío = todas tildadas (espeja la lógica del server).
  const viewingSet = new Set(
    viewing?.length
      ? viewing
      : (memberships || []).map((m) => String(m.community._id)),
  );

  const guard = async (fn, errMsg) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      addToast?.({
        type: "error",
        message: err?.response?.data?.message || errMsg,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleViewing = (id) => {
    const next = new Set(viewingSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return guard(
      () => setViewingPref([...next]),
      "No pudimos guardar tus preferencias",
    );
  };

  const chooseSkin = (id) =>
    guard(() => setSkinPref(id), "No pudimos cambiar el aspecto");

  return { busy, viewingSet, toggleViewing, chooseSkin, guard };
}
