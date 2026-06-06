import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import AvatarCropModal from "../../components/shared/AvatarCropModal";
import useSearchTerm from "../../hooks/useSearchTerm";
import SearchRowSkeleton from "./SearchRowSkeleton";
import Pagination from "./Pagination";
import styles from "./BgWatchProfile.module.css";

function playerMeta(p) {
  const parts = [];
  if (p.numPlays > 0) {
    parts.push(`${p.numPlays} partida${p.numPlays === 1 ? "" : "s"}`);
  }
  if (p.lastPlayedDate) parts.push(`última: ${p.lastPlayedDate}`);
  return parts.join(" · ");
}

// Construye un "user" para <Avatar> a partir de una fila curada: si está
// vinculada usa el usuario de TurnoCero (gana su avatar), si no el overlay.
function rowAvatarUser(row) {
  if (row.linkedUser) return row.linkedUser;
  return {
    _id: row.key,
    displayName: row.name,
    username: row.username,
    avatar: row.avatar || undefined,
  };
}

/**
 * Pestaña "Jugadores": cura el roster de jugadores de las partidas del dueño.
 * Editar nombre (overlay local), reasignar @BGG (se reescribe en BGG), subir
 * avatar (local, solo si no está vinculado a TurnoCero) y fusionar duplicados.
 * Montado solo para dueño/admin (gate en BgWatchProfile).
 */
export default function JugadoresPanel({ bggUsername }) {
  const { user } = useAuth();
  const isOwner =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);

  const searchTerm = useSearchTerm(q);
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    (pageToLoad) => {
      const myId = ++reqIdRef.current;
      setLoading(true);
      setError(false);
      axios
        .get(API.bgg.JUGADORES(bggUsername), {
          params: { page: pageToLoad, q: searchTerm || undefined },
        })
        .then(({ data }) => {
          if (myId !== reqIdRef.current) return;
          setItems(data.items || []);
          setPage(data.page || pageToLoad);
          setPages(data.pages || 1);
          setTotal(data.total || 0);
        })
        .catch(() => {
          if (myId === reqIdRef.current) setError(true);
        })
        .finally(() => {
          if (myId === reqIdRef.current) setLoading(false);
        });
    },
    [bggUsername, searchTerm],
  );

  useEffect(() => {
    fetchPage(1);
  }, [searchTerm, fetchPage]);

  const reload = () => fetchPage(page);

  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <p className={styles.sectionHelp}>
        Estos son los jugadores de tus partidas. Podés corregir el nombre, fijar
        su usuario de BoardGameGeek o fusionar duplicados.
      </p>

      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder="Buscar jugador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label="Buscar jugador"
        />
      </div>

      {loading && items.length === 0 && <SearchRowSkeleton rows={5} />}

      {error && (
        <p className={styles.dimText}>No se pudo cargar la lista de jugadores.</p>
      )}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={q ? "Sin coincidencias" : "Sin jugadores aún"}
          text={
            q
              ? "Ningún jugador coincide con tu búsqueda."
              : "Cuando cargues partidas con otros jugadores van a aparecer acá."
          }
        />
      )}

      {items.length > 0 && (
        <ul className={styles.gameSearchList}>
          {items.map((row) => {
            const meta = playerMeta(row);
            return (
              <li key={row.key} className={styles.jugadorRow}>
                <Avatar user={rowAvatarUser(row)} size="sm" />
                <div className={styles.gameSearchInfo}>
                  <span className={styles.gameSearchName}>
                    {row.name || row.username || "Sin nombre"}
                    {row.username && (
                      <span className={styles.coPlayerHandle}>
                        {" "}
                        @{row.username}
                      </span>
                    )}
                    {row.isLinked && (
                      <span className={styles.playerTagFriend}>
                        miembro TurnoCero
                      </span>
                    )}
                  </span>
                  {meta && (
                    <span className={styles.gameSearchMeta}>{meta}</span>
                  )}
                </div>
                <div className={styles.jugadorActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setEditing(row)}
                    disabled={row.isLinked}
                    title={
                      row.isLinked
                        ? "Vinculado a un usuario de TurnoCero (no editable)"
                        : "Editar jugador"
                    }
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setMerging(row)}
                  >
                    Fusionar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <Pagination page={page} totalPages={pages} onPage={(p) => fetchPage(p)} />
      )}

      {total > 0 && (
        <p className={styles.dimText}>
          {total} jugador{total === 1 ? "" : "es"}
        </p>
      )}

      {editing && (
        <EditPlayerModal
          bggUsername={bggUsername}
          player={editing}
          isOwner={isOwner}
          onClose={(changed) => {
            setEditing(null);
            if (changed) reload();
          }}
        />
      )}

      {merging && (
        <MergePlayerModal
          bggUsername={bggUsername}
          source={merging}
          onClose={(merged) => {
            setMerging(null);
            if (merged) reload();
          }}
        />
      )}
    </div>
  );
}

// ── Editar jugador (nombre / @BGG / avatar) ────────────────────────────────
function EditPlayerModal({ bggUsername, player, isOwner, onClose }) {
  const [name, setName] = useState(player.name || "");
  const [bgg, setBgg] = useState(player.username || "");
  const [avatar, setAvatar] = useState(player.avatar || null);
  const [cropFile, setCropFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);

  const fail = (e) =>
    setErr(e?.response?.data?.message || "No se pudo guardar el cambio.");

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
      const { data } = await axios.patch(API.bgg.JUGADOR_BGG(bggUsername), {
        rawKeys: player.rawKeys,
        bggUsername: handle,
      });
      setDirty(true);
      // La identidad cambió de clave → cerramos y refrescamos.
      onClose(true);
      if (data.merged) {
        // best-effort: nada más que hacer, el refetch ya lo refleja.
      }
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

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Editar jugador</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={() => onClose(dirty)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

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

        {/* @BGG — solo el dueño puede reasignar (reescribe en BGG) */}
        {isOwner && (
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
                {busy === "bgg" ? "Reasignando…" : "Reasignar"}
              </button>
            </div>
            <p className={styles.dimText}>
              Esto reescribe todas las partidas donde aparece este jugador en
              BoardGameGeek. Puede tardar unos segundos.
            </p>
          </div>
        )}

        {msg && <p className={styles.editOk}>{msg}</p>}
        {err && <p className={styles.editErr}>{err}</p>}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => onClose(dirty)}
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
function MergePlayerModal({ bggUsername, source, onClose }) {
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
      await axios.post(API.bgg.JUGADOR_MERGE(bggUsername), {
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
        title="Fusionar jugadores"
        message={
          target
            ? `¿Fusionar "${source.name || source.username}" dentro de "${target.name || target.username}"? Esta acción no se puede deshacer fácilmente.`
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
