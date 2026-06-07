import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import AvatarCropModal from "../../components/shared/AvatarCropModal";
import useSearchTerm from "../../hooks/useSearchTerm";
import SearchRowSkeleton from "./SearchRowSkeleton";
import styles from "./BgWatchProfile.module.css";

export function playerMeta(p) {
  const parts = [];
  if (p.numPlays > 0) {
    parts.push(`${p.numPlays} partida${p.numPlays === 1 ? "" : "s"}`);
  }
  if (p.lastPlayedDate) parts.push(`última: ${p.lastPlayedDate}`);
  return parts.join(" · ");
}

// Construye un "user" para <Avatar> a partir de una fila curada. Un avatar de
// override local gana sobre el del miembro de TurnoCero (override curado); si no
// hay override, cae al usuario de TurnoCero vinculado y luego al overlay base.
export function rowAvatarUser(row) {
  if (row.avatar?.url) {
    return {
      _id: row.key,
      displayName: row.name,
      username: row.username,
      avatar: row.avatar,
    };
  }
  if (row.linkedUser) return { ...row.linkedUser, displayName: row.name };
  return {
    _id: row.key,
    displayName: row.name,
    username: row.username,
    avatar: row.avatar || undefined,
  };
}

// ── Editar jugador (nombre / @BGG / avatar / fusionar) ─────────────────────
//
// `onClose(result)` comunica el desenlace al caller:
//   - false      → no hubo cambios
//   - "updated"  → cambió nombre/avatar/@BGG (misma identidad) → refrescar
//   - "merged"   → se fusionó / se marcó como "vos" (la identidad cambió) →
//                  el caller debería salir de la vista del jugador
export function EditPlayerModal({ bggUsername, player, onClose }) {
  const [name, setName] = useState(player.name || "");
  const [bgg, setBgg] = useState(player.username || "");
  const [avatar, setAvatar] = useState(player.avatar || null);
  const [cropFile, setCropFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const fileRef = useRef(null);

  const fail = (e) =>
    setErr(e?.response?.data?.message || "No se pudo guardar el cambio.");

  const closeWithChanges = () => onClose(dirty ? "updated" : false);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("El nombre no puede estar vacío.");
      return;
    }
    setBusy("name");
    setErr("");
    setMsg("");
    try {
      await axios.patch(API.bgg.JUGADOR_NOMBRE(bggUsername), {
        rawKeys: player.rawKeys,
        name: trimmed,
      });
      setDirty(true);
      setMsg("Nombre guardado.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  };

  const reassignBgg = async () => {
    const handle = bgg.trim().replace(/^@/, "");
    if (!handle) {
      setErr("Ingresá un usuario de BGG.");
      return;
    }
    setBusy("bgg");
    setErr("");
    setMsg("");
    try {
      await axios.patch(API.bgg.JUGADOR_BGG(bggUsername), {
        rawKeys: player.rawKeys,
        bggUsername: handle,
      });
      setDirty(true);
      // La identidad cambió de clave → cerramos y refrescamos.
      onClose("updated");
    } catch (e) {
      fail(e);
      setBusy("");
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setCropFile(f);
    e.target.value = "";
  };

  const confirmAvatar = async (blob) => {
    setBusy("avatar");
    setErr("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      fd.append("rawKeys", JSON.stringify(player.rawKeys));
      const { data } = await axios.put(API.bgg.JUGADOR_AVATAR(bggUsername), fd);
      setAvatar(data.player?.avatar || null);
      setDirty(true);
      setMsg("Avatar actualizado.");
      setCropFile(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  };

  const removeAvatar = async () => {
    setBusy("avatar");
    setErr("");
    setMsg("");
    try {
      await axios.delete(API.bgg.JUGADOR_AVATAR(bggUsername), {
        data: { rawKeys: player.rawKeys },
      });
      setAvatar(null);
      setDirty(true);
      setMsg("Avatar quitado.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  };

  // Mientras está abierto el modal de fusión, ocultamos el de edición: su
  // backdrop (z-index alto) taparía al de fusión / la confirmación.
  if (showMerge) {
    return (
      <MergePlayerModal
        bggUsername={bggUsername}
        source={player}
        onClose={(merged) => (merged ? onClose("merged") : setShowMerge(false))}
      />
    );
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Editar jugador</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={closeWithChanges}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {player.isLinked && (
          <p className={styles.linkedDisclaimer}>
            Este jugador es miembro de TurnoCero. El nombre y la foto que pongas
            acá <strong>reemplazan los de su perfil</strong>, pero solo en tu
            vista de BG Watch (no cambian su perfil ni lo que ven los demás).
          </p>
        )}

        {/* Avatar */}
        <div className={styles.editAvatarRow}>
          <Avatar
            user={{
              _id: player.key,
              displayName: name,
              username: bgg,
              avatar: avatar || undefined,
            }}
            size="xl"
          />
          <div className={styles.jugadorActions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => fileRef.current?.click()}
              disabled={busy === "avatar"}
            >
              {avatar ? "Cambiar foto" : "Subir foto"}
            </button>
            {avatar && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={removeAvatar}
                disabled={busy === "avatar"}
              >
                Quitar
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
          </div>
        </div>

        {/* Nombre */}
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
              disabled={busy === "name"}
            >
              {busy === "name" ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>

        {/* @BGG — vínculo local, no reescribe el histórico en BGG. */}
        <div>
          <label className={styles.fieldLabel}>Usuario de BoardGameGeek</label>
          <div className={styles.editInlineRow}>
            <input
              type="text"
              className={styles.modalInput}
              placeholder="@usuario"
              value={bgg}
              onChange={(e) => setBgg(e.target.value)}
              maxLength={50}
            />
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={reassignBgg}
              disabled={busy === "bgg"}
            >
              {busy === "bgg" ? "Vinculando…" : "Vincular"}
            </button>
          </div>
          <p className={styles.dimText}>
            Se aplica en TurnoCero a toda la historia de este jugador. No
            modifica las partidas ya cargadas en BoardGameGeek; las nuevas que
            cargues sí van a usar este usuario.
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
            Fusionar con otro jugador
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

      <AvatarCropModal
        open={!!cropFile}
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onConfirm={confirmAvatar}
      />
    </div>
  );
}

// ── Fusionar jugador (source → target) ─────────────────────────────────────
export function MergePlayerModal({ bggUsername, source, onClose }) {
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
      .get(API.bgg.JUGADORES(bggUsername), {
        params: { q: searchTerm || undefined, limit: 50 },
      })
      .then(({ data }) => {
        if (myId !== reqIdRef.current) return;
        // Excluir el propio jugador (por solapamiento de rawKeys).
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
      if (target.__self) {
        // "Sos vos": marca al jugador como el dueño del perfil (overlay local).
        await axios.post(API.bgg.JUGADOR_YO_MISMO(bggUsername), {
          rawKeys: source.rawKeys,
          value: true,
        });
      } else {
        await axios.post(API.bgg.JUGADOR_MERGE(bggUsername), {
          sourceRawKeys: source.rawKeys,
          targetRawKeys: target.rawKeys,
        });
      }
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
              <h3 className={styles.modalTitle}>Fusionar jugador</h3>
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
              Elegí con qué jugador querés fusionar a{" "}
              <strong>{source.name || source.username}</strong>. Las partidas de
              ambos van a contar como una sola persona.
            </p>

            <input
              type="text"
              className={styles.modalInput}
              placeholder="Buscar jugador destino…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={100}
              aria-label="Buscar jugador destino"
            />

            {/* Opción especial: este jugador sos vos (el dueño del perfil). */}
            <button
              type="button"
              className={styles.selfMergeBtn}
              onClick={() => setTarget({ __self: true })}
            >
              👤 Sos vos (<strong>@{bggUsername}</strong>)
              <span className={styles.gameSearchMeta}>
                Marcar a este jugador como vos mismo
              </span>
            </button>

            {loading && <SearchRowSkeleton rows={4} />}

            {!loading && items.length === 0 && (
              <p className={styles.dimText}>
                No hay otros jugadores para fusionar.
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
                      <Avatar user={rowAvatarUser(row)} size="xs" />
                      <div className={styles.gameSearchInfo}>
                        <span className={styles.gameSearchName}>
                          {row.name || row.username}
                          {row.username && (
                            <span className={styles.coPlayerHandle}>
                              {" "}
                              @{row.username}
                            </span>
                          )}
                        </span>
                        {playerMeta(row) && (
                          <span className={styles.gameSearchMeta}>
                            {playerMeta(row)}
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
        title={target?.__self ? "Sos vos" : "Fusionar jugadores"}
        message={
          target?.__self
            ? `¿Marcar a "${source.name || source.username}" como vos mismo (@${bggUsername})? Sus partidas van a contar como tuyas y dejará de aparecer como compañero.`
            : target
              ? `¿Fusionar "${source.name || source.username}" dentro de "${target.name || target.username}"? Esta acción no se puede deshacer fácilmente.`
              : ""
        }
        confirmLabel={target?.__self ? "Sí, soy yo" : "Fusionar"}
        cancelLabel="Cancelar"
        loading={merging}
        onConfirm={doMerge}
        onCancel={() => !merging && setTarget(null)}
      />
    </>
  );
}
