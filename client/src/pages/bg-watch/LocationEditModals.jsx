import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  useUbicacionesMergeSearchQuery,
  renameLocation,
  mergeLocations,
} from "../../queries/bgWatch";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import useSearchTerm from "../../hooks/useSearchTerm";
import i18n from "../../i18n";
import SearchRowSkeleton from "./SearchRowSkeleton";
import styles from "./BgWatchProfile.module.css";

export function locationMeta(l) {
  const parts = [];
  if (l.numPlays > 0) {
    parts.push(i18n.t("bgwatch:locationEdit.metaPlays", { count: l.numPlays }));
  }
  if (l.lastPlayedDate) {
    parts.push(
      i18n.t("bgwatch:locationEdit.metaLast", { date: l.lastPlayedDate }),
    );
  }
  return parts.join(" · ");
}

// ── Editar ubicación (nombre / fusionar) ───────────────────────────────────
//
// `onClose(result)` comunica el desenlace al caller:
//   - false      → no hubo cambios
//   - "updated"  → cambió el nombre → refrescar
//   - "merged"   → se fusionó (la identidad cambió) → salir de la vista
export function EditLocationModal({ bggUsername, location, onClose }) {
  const { t } = useTranslation("bgwatch");
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
      setErr(t("locationEdit.nameEmpty"));
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await renameLocation(bggUsername, location.rawKeys, trimmed);
      setDirty(true);
      setMsg(t("locationEdit.nameSaved"));
    } catch (e) {
      setErr(e?.response?.data?.message || t("locationEdit.saveError"));
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
          <h3 className={styles.modalTitle}>{t("locationEdit.title")}</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={closeWithChanges}
            aria-label={t("locationEdit.close")}
          >
            ✕
          </button>
        </div>

        <div>
          <label className={styles.fieldLabel}>
            {t("locationEdit.nameLabel")}
          </label>
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
              {busy ? t("locationEdit.saving") : t("locationEdit.save")}
            </button>
          </div>
          <p className={styles.dimText}>{t("locationEdit.nameHelp")}</p>
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
            {t("locationEdit.mergeWithAnother")}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={closeWithChanges}
          >
            {t("locationEdit.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fusionar ubicación (source → target) ───────────────────────────────────
export function MergeLocationModal({ bggUsername, source, onClose }) {
  const { t } = useTranslation("bgwatch");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [merging, setMerging] = useState(false);
  const [err, setErr] = useState("");
  const searchTerm = useSearchTerm(q);
  const { data: rawItems, isPending: loading } = useUbicacionesMergeSearchQuery({
    bggUsername,
    q: searchTerm,
  });
  // Excluir la propia ubicación (por solapamiento de rawKeys).
  const srcKeys = new Set(source.rawKeys);
  const items = (rawItems || []).filter(
    (it) => !it.rawKeys.some((k) => srcKeys.has(k)),
  );

  const doMerge = async () => {
    if (!target) return;
    setMerging(true);
    setErr("");
    try {
      await mergeLocations(bggUsername, source.rawKeys, target.rawKeys);
      onClose(true);
    } catch (e) {
      setErr(e?.response?.data?.message || t("locationEdit.mergeError"));
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
              <h3 className={styles.modalTitle}>
                {t("locationEdit.mergeTitle")}
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => onClose(false)}
                aria-label={t("locationEdit.close")}
              >
                ✕
              </button>
            </div>

            <p className={styles.sectionHelp}>
              <Trans
                i18nKey="bgwatch:locationEdit.mergeHelp"
                values={{ name: source.name }}
                components={{ strong: <strong /> }}
              />
            </p>

            <input
              type="text"
              className={styles.modalInput}
              placeholder={t("locationEdit.mergeSearchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={100}
              aria-label={t("locationEdit.mergeSearchAria")}
            />

            {loading && <SearchRowSkeleton rows={4} />}

            {!loading && items.length === 0 && (
              <p className={styles.dimText}>
                {t("locationEdit.noOthersToMerge")}
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
        title={t("locationEdit.confirmMergeTitle")}
        message={
          target
            ? t("locationEdit.confirmMergeMessage", {
                source: source.name,
                target: target.name,
              })
            : ""
        }
        confirmLabel={t("locationEdit.confirmMergeBtn")}
        cancelLabel={t("locationEdit.cancel")}
        loading={merging}
        onConfirm={doMerge}
        onCancel={() => !merging && setTarget(null)}
      />
    </>
  );
}
