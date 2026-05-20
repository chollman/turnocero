import { useState } from 'react';
import Avatar from '../../components/shared/Avatar';
import { getUserDisplay } from '../../utils/userDisplay';
import { CheckIcon, XIcon, ExternalIcon, DocIcon, ImageIcon } from './EventoIcons';
import styles from './InscItem.module.css';

function formatRelative(s, now = Date.now()) {
  if (!s) return '—';
  const d = new Date(s);
  const diff = now - d.getTime();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function InscItem({ reg, onAccept, onReject, onUndo, now = Date.now() }) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [notes, setNotes] = useState(reg.adminNotes || '');
  const [showNotes, setShowNotes] = useState(false);

  const display = getUserDisplay(reg.user);
  const status = reg.status;
  const isPdf = reg.comprobante?.resourceType === 'raw';

  async function handleAccept() {
    setAccepting(true);
    try { await onAccept(reg, notes); }
    finally { setAccepting(false); }
  }

  async function handleReject() {
    setRejecting(true);
    try { await onReject(reg, notes); }
    finally { setRejecting(false); }
  }

  async function handleUndo() {
    setUndoing(true);
    try { await onUndo(reg); }
    finally { setUndoing(false); }
  }

  return (
    <div className={styles.item}>
      <div className={styles.head}>
        <Avatar user={reg.user} size="md" />
        <div className={styles.userBlock}>
          <span className={styles.name}>{display.name}</span>
          {reg.user?.username && <span className={styles.handle}>@{reg.user.username}</span>}
        </div>
        <span className={styles.meta}>
          {status === 'pending' ? formatRelative(reg.submittedAt, now) : formatRelative(reg.reviewedAt, now)}
        </span>
      </div>

      {reg.comprobante?.url ? (
        <a
          href={reg.comprobante.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.comprobante}
        >
          <span className={styles.thumb}>
            {isPdf ? 'PDF' : <ImageIcon size={18} />}
          </span>
          <span className={styles.comprobanteInfo}>
            <span className={styles.comprobanteName}>{isPdf ? 'comprobante.pdf' : 'comprobante.jpg'}</span>
            <span className={styles.comprobanteOpen}>
              Abrir <ExternalIcon size={10} />
            </span>
          </span>
        </a>
      ) : status === 'pending' ? (
        <div className={styles.noComprobante}>
          <DocIcon size={14} /> Sin comprobante adjunto
        </div>
      ) : null}

      {(status === 'rejected' || status === 'confirmed') && reg.adminNotes && (
        <p className={styles.notes}>✦ {reg.adminNotes}</p>
      )}

      {status === 'pending' && (
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
              onClick={handleReject}
              disabled={accepting || rejecting}
            >
              <XIcon size={11} />&nbsp;{rejecting ? 'Rechazando…' : 'Rechazar'}
            </button>
            <button
              type="button"
              className={styles.btnAccept}
              onClick={handleAccept}
              disabled={accepting || rejecting}
            >
              <CheckIcon size={11} />&nbsp;{accepting ? 'Confirmando…' : 'Confirmar'}
            </button>
          </div>
        </>
      )}

      {(status === 'confirmed' || status === 'rejected') && (
        <button type="button" className={styles.btnUndo} onClick={handleUndo} disabled={undoing}>
          ↺ {undoing ? 'Revirtiendo…' : 'Revertir decisión'}
        </button>
      )}
    </div>
  );
}
