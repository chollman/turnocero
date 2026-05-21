import { useState } from "react";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import {
  CheckIcon,
  XIcon,
  ExternalIcon,
  DocIcon,
  ImageIcon,
} from "./EventoIcons";
import styles from "./InscItem.module.css";

function formatRelative(s, now = Date.now()) {
  if (!s) return "—";
  const d = new Date(s);
  const diff = now - d.getTime();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// `now` lo provee el caller (TriageColumn → EventoInscripciones). Si no llega,
// formatRelative() aplica su propio fallback de Date.now() vía default param.
// `index` indica la posición de este item dentro de su columna; el primer
// pending (index===0) siempre se renderiza expandido sin toggle, para que el
// admin tenga a mano la próxima inscripción a revisar; los pending siguientes
// y todas las confirmadas/rechazadas usan el patrón compacto + toggle.
export default function InscItem({
  reg,
  onAccept,
  onReject,
  onUndo,
  now,
  index = 0,
}) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [banning, setBanning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [notes, setNotes] = useState(reg.adminNotes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const display = getUserDisplay(reg.user);
  const status = reg.status;
  const isPdf = reg.comprobante?.resourceType === "raw";
  const isPermanent = !!reg.permanentlyRejected;
  const isFirstPending = status === "pending" && index === 0;
  const usesCompactPattern = !isFirstPending;

  async function handleAccept() {
    setAccepting(true);
    try {
      await onAccept(reg, notes);
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject(permanent = false) {
    if (permanent) setBanning(true);
    else setRejecting(true);
    try {
      await onReject(reg, notes, permanent);
    } finally {
      setRejecting(false);
      setBanning(false);
    }
  }

  async function handleUndo() {
    setUndoing(true);
    try {
      await onUndo(reg);
    } finally {
      setUndoing(false);
    }
  }

  const comprobanteBlock = reg.comprobante?.url ? (
    <a
      href={reg.comprobante.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.comprobante}
    >
      <span className={styles.thumb}>
        {isPdf ? "PDF" : <ImageIcon size={18} />}
      </span>
      <span className={styles.comprobanteInfo}>
        <span className={styles.comprobanteName}>
          {isPdf ? "comprobante.pdf" : "comprobante.jpg"}
        </span>
        <span className={styles.comprobanteOpen}>
          Abrir <ExternalIcon size={10} />
        </span>
      </span>
    </a>
  ) : status === "pending" ? (
    <div className={styles.noComprobante}>
      <DocIcon size={14} /> Sin comprobante adjunto
    </div>
  ) : null;

  // Pill compacto que reemplaza el bloque `.notes` largo en la vista colapsada
  // — el admin puede scannear el estado sin abrir cada inscripción.
  const statusPill =
    status === "confirmed" ? (
      <span className={`${styles.statusPill} ${styles.statusPillConfirmed}`}>
        ✓ Confirmada
      </span>
    ) : status === "rejected" ? (
      <span
        className={`${styles.statusPill} ${
          isPermanent ? styles.statusPillBlocked : styles.statusPillRejected
        }`}
      >
        {isPermanent ? "⛔ Bloqueado" : "↺ Puede reintentar"}
      </span>
    ) : status === "pending" ? (
      <span className={`${styles.statusPill} ${styles.statusPillPending}`}>
        ● Pendiente
      </span>
    ) : null;

  const pendingActions = (
    <>
      {showNotes ? (
        <textarea
          className={styles.notesInput}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas internas (opcional)"
          rows={2}
          maxLength={500}
        />
      ) : (
        <button
          type="button"
          className={styles.notesToggle}
          onClick={() => setShowNotes(true)}
        >
          + Agregar nota
        </button>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnReject}
          onClick={() => handleReject(false)}
          disabled={accepting || rejecting || banning}
          title="Rechazar este intento — el usuario puede volver a enviar un comprobante"
        >
          <XIcon size={11} />
          &nbsp;{rejecting ? "Rechazando…" : "Rechazar"}
        </button>
        <button
          type="button"
          className={styles.btnAccept}
          onClick={handleAccept}
          disabled={accepting || rejecting || banning}
        >
          <CheckIcon size={11} />
          &nbsp;{accepting ? "Confirmando…" : "Confirmar"}
        </button>
      </div>
      <button
        type="button"
        className={styles.btnBan}
        onClick={() => handleReject(true)}
        disabled={accepting || rejecting || banning}
        title="Bloquear permanentemente — el usuario no podrá volver a inscribirse en este evento"
      >
        ⛔ {banning ? "Bloqueando…" : "Bloquear del evento"}
      </button>
    </>
  );

  const resolvedDetails = (
    <>
      {status === "rejected" && (
        <p
          className={`${styles.notes} ${
            isPermanent ? styles.notesPermanent : ""
          }`}
        >
          {isPermanent
            ? "⛔ Bloqueado del evento"
            : "↺ Puede volver a intentar"}
          {reg.adminNotes ? ` · ${reg.adminNotes}` : ""}
        </p>
      )}
      {status === "confirmed" && reg.adminNotes && (
        <p className={styles.notes}>✦ {reg.adminNotes}</p>
      )}
      <button
        type="button"
        className={styles.btnUndo}
        onClick={handleUndo}
        disabled={undoing}
      >
        ↺ {undoing ? "Revirtiendo…" : "Revertir decisión"}
      </button>
    </>
  );

  return (
    <div className={styles.item}>
      <div className={styles.head}>
        <Avatar user={reg.user} size="md" />
        <div className={styles.userBlock}>
          <span className={styles.name}>{display.name}</span>
          {reg.user?.username && (
            <span className={styles.handle}>@{reg.user.username}</span>
          )}
        </div>
        <span className={styles.meta}>
          {status === "pending"
            ? formatRelative(reg.submittedAt, now)
            : formatRelative(reg.reviewedAt, now)}
        </span>
      </div>

      {/* Primer pending: vista completa siempre (sin toggle).
          Resto (pending #2+, confirmed, rejected): compacta + toggle. */}
      {isFirstPending && (
        <>
          {comprobanteBlock}
          {pendingActions}
        </>
      )}

      {usesCompactPattern && (
        <>
          <div className={styles.compactRow}>
            {statusPill}
            <button
              type="button"
              className={styles.detailsToggle}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Ocultar detalles" : "Ver detalles"}
            </button>
          </div>
          {expanded && (
            <div className={styles.detailsContainer}>
              {comprobanteBlock}
              {status === "pending" ? pendingActions : resolvedDetails}
            </div>
          )}
        </>
      )}
    </div>
  );
}
