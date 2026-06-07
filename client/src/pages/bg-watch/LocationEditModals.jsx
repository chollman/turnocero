import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import useSearchTerm from "../../hooks/useSearchTerm";
import SearchRowSkeleton from "./SearchRowSkeleton";
import styles from "./BgWatchProfile.module.css";

export function locationMeta(l) {
  const parts = [];
  if (l.numPlays > 0) {
    parts.push(`${l.numPlays} partida${l.numPlays === 1 ? "" : "s"}`);
  }
  if (l.lastPlayedDate) parts.push(`última: ${l.lastPlayedDate}`);
  return parts.join(" · ");
}

// ── Editar ubicación (nombre / fusionar) ───────────────────────────────────
//
// `onClose(result)` comunica el desenlace al caller:
//   - false      → no hubo cambios
//   - "updated"  → cambió el nombre → refrescar
//   - "merged"   → se fusionó (la identidad cambió) → salir de la vista
export function EditLocationModal({ bggUsername, location, onClose }) {
  const [name, setName] = useState(location.name || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  const closeWithChanges = () => onClose(dirty ? "updated" : false);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("El nombre no puede estar vacío.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await axios.patch(API.bgg.UBICACION_NOMBRE(bggUsername), {
        rawKeys: location.rawKeys,
        name: trimmed,
      });
      setDirty(true);
      setMsg("Nombre guardado.");
    } catch (e) {
      setErr(e?.response?.data?.message || "No se pudo guardar el cambio.");
    } finally {
      setBusy(false);
    }
  };

  // Mientras está abierto el modal de fusión, ocultamos el de edición: su
  // backdrop (z-index alto) taparía al de fusión / la confirmación.
  if (showMerge) {
    return (
      <MergeLocationModal
        bggUsername={bggUsername}
        source={location}
        onClose={(merged) => (merged ? onClose("merged") : setShowMerge(false))}
      />
    );
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Editar ubicación</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={closeWithChanges}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div>
          <label className={styles.fieldLabel}>Nombre</label>
          <div className={styles.editInlineRow}>
            <input
              type="text"
              className={styles.modalInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={saveName}
              disabled={busy}
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
          <p className={styles.dimText}>
            Se aplica en TurnoCero a toda la historia de esta ubicación. No
            modifica las partidas ya cargadas en BoardGameGeek.
          </p>
        </div>

        {msg && <p className={styles.editOk}>{msg}</p>}
        {err && <p className={styles.editErr}>{err}</p>}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnGhost}
            style={{ marginRight: "auto" }}
            onClick={() => setShowMerge(true)}
          >
            Fusionar con otra ubicación
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={closeWithChanges}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fusionar ubicación (source → target) ───────────────────────────────────
export function MergeLocationModal({ bggUsername, source, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [merging, setMerging] = useState(false);
  const [err, setErr] = useState("");
  const searchTerm = useSearchTerm(q);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    axios
      .get(API.bgg.UBICACIONES(bggUsername), {
        params: { q: searchTerm || undefined, limit: 50 },
      })
      .then(({ data }) => {
        if (myId !== reqIdRef.current) return;
        // Excluir la propia ubicación (por solapamiento de rawKeys).
        const srcKeys = new Set(source.rawKeys);
        setItems(
          (data.items || []).filter(
            (it) => !it.rawKeys.some((k) => srcKeys.has(k)),
          ),
        );
      })
      .catch(() => {
        if (myId === reqIdRef.current) setItems([]);
      })
      .finally(() => {
        if (myId === reqIdRef.current) setLoading(false);
      });
  }, [bggUsername, searchTerm, source.rawKeys]);

  const doMerge = async () => {
    if (!target) return;
    setMerging(true);
    setErr("");
    try {
      await axios.post(API.bgg.UBICACION_MERGE(bggUsername), {
        sourceRawKeys: source.rawKeys,
        targetRawKeys: target.rawKeys,
      });
      onClose(true);
    } catch (e) {
      setErr(e?.response?.data?.message || "No se pudo fusionar.");
      setMerging(false);
    }
  };

  return (
    <>
      {/* Mientras está abierta la confirmación ocultamos este modal: su backdrop
          (z-index alto) taparía al ConfirmActionModal y no se podría confirmar. */}
      {!target && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>Fusionar ubicación</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => onClose(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <p className={styles.sectionHelp}>
              Elegí con qué ubicación querés fusionar a{" "}
              <strong>{source.name}</strong>. Las partidas de ambas van a contar
              como un solo lugar.
            </p>

            <input
              type="text"
              className={styles.modalInput}
              placeholder="Buscar ubicación destino…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={100}
              aria-label="Buscar ubicación destino"
            />

            {loading && <SearchRowSkeleton rows={4} />}

            {!loading && items.length === 0 && (
              <p className={styles.dimText}>
                No hay otras ubicaciones para fusionar.
              </p>
            )}

            {!loading && items.length > 0 && (
              <ul className={styles.gameSearchList}>
                {items.map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      className={styles.gameSearchItem}
                      onClick={() => setTarget(row)}
                    >
                      <div className={styles.gameSearchInfo}>
                        <span className={styles.gameSearchName}>
                          {row.name}
                        </span>
                        {locationMeta(row) && (
                          <span className={styles.gameSearchMeta}>
                            {locationMeta(row)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {err && <p className={styles.editErr}>{err}</p>}
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={!!target}
        title="Fusionar ubicaciones"
        message={
          target
            ? `¿Fusionar "${source.name}" dentro de "${target.name}"? Esta acción no se puede deshacer fácilmente.`
            : ""
        }
        confirmLabel="Fusionar"
        cancelLabel="Cancelar"
        loading={merging}
        onConfirm={doMerge}
        onCancel={() => !merging && setTarget(null)}
      />
    </>
  );
}
