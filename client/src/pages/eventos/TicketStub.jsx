import { useState } from "react";
import ComprobanteDropzone from "./ComprobanteDropzone";
import { dateParts, countdown, formatFee } from "../../utils/eventoDate";
import {
  CheckIcon,
  ClockIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  RefreshIcon,
} from "./EventoIcons";
import styles from "./TicketStub.module.css";

const STATUS_LABEL = {
  open: "Abierto",
  closed: "Cerrado",
  cancelled: "Cancelado",
  draft: "Borrador",
};

export default function TicketStub({
  evento,
  user = null,
  isHost = false,
  userRegistration = null,
  pendingCount = 0,
  onInscribirse,
  onCancelRegistration,
  onLoginRequest,
  onOpenInscripciones,
  onEdit,
  onDelete,
  onCancelEvent,
  onReopen,
  inscribing = false,
  cancellingReg = false,
  // `now` lo provee el caller (EventoDetail). Si no llega, countdown() usa
  // su propio fallback al evaluar el delta temporal.
  now,
}) {
  const [showForm, setShowForm] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const d = dateParts(evento.eventDate);
  const cd = countdown(evento.eventDate, now);
  const isFree = !evento.fee;
  const hasMax = !!(evento.maxParticipants && evento.maxParticipants > 0);
  const confirmed = evento.registrationCount?.confirmed ?? 0;
  const pendingRegs = evento.registrationCount?.pending ?? 0;
  // Active inscriptions (pending + confirmed) — see TimelineRow for rationale.
  const participants = confirmed + pendingRegs;
  const isFull = hasMax && participants >= evento.maxParticipants;
  const fillPct = hasMax
    ? Math.min(100, (participants / evento.maxParticipants) * 100)
    : 0;
  const isPast = cd.tone === "past";
  const status = userRegistration?.status || null;

  async function handleSubmit() {
    if (!isFree && !comprobante) {
      setLocalErr("Adjuntá el comprobante para continuar.");
      return;
    }
    setLocalErr("");
    try {
      await onInscribirse(comprobante);
      setShowForm(false);
      setComprobante(null);
    } catch (err) {
      setLocalErr(
        err?.response?.data?.message ||
          err?.message ||
          "No pudimos enviar tu inscripción.",
      );
    }
  }

  // El form se renderiza tanto en el flujo de inscripción nueva como en el
  // "Volver a intentar" tras un rechazo no-permanente — antes el ladder
  // matcheaba la rama de status="rejected" y nunca llegaba a la de showForm,
  // dejando el click muerto.
  const inscriptionForm = (
    <div className={styles.formContainer}>
      <div className={styles.form}>
        {evento.conditions && (
          <div>
            <div className={styles.formLabel}>◆ Condiciones</div>
            <p className={styles.formText}>{evento.conditions}</p>
          </div>
        )}
        {!isFree && evento.transferDetails && (
          <div>
            <div className={styles.formLabel}>
              ◆ Datos de transferencia · {formatFee(evento.fee)}
            </div>
            <div className={styles.transferBox}>{evento.transferDetails}</div>
          </div>
        )}
        {!isFree && (
          <div>
            <div className={styles.formLabel}>◆ Comprobante *</div>
            <ComprobanteDropzone file={comprobante} onFile={setComprobante} />
          </div>
        )}
        {localErr && <p className={styles.formError}>{localErr}</p>}
        <div className={styles.formActions}>
          <button
            className={styles.ghostBtn}
            type="button"
            onClick={() => {
              setShowForm(false);
              setComprobante(null);
              setLocalErr("");
            }}
            disabled={inscribing}
          >
            Cancelar
          </button>
          <button
            className={styles.cta}
            type="button"
            onClick={handleSubmit}
            disabled={inscribing || (!isFree && !comprobante)}
          >
            {inscribing ? "Enviando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.stub}>
      <div className={styles.top}>
        <div className={styles.label}>◆ Marcá la fecha</div>
        {d && (
          <div className={styles.dateBlock}>
            <span className={styles.day}>{d.day}</span>
            <div className={styles.dateRight}>
              <div className={styles.month}>{d.monthLong}</div>
              <div className={styles.weekday}>
                {d.weekdayLong} · {d.year}
              </div>
            </div>
          </div>
        )}
        {d && <div className={styles.time}>⏱ {d.time} hs (hora local)</div>}
        {!isPast && evento.status === "open" && cd.text && (
          <div
            className={`${styles.countdown} ${styles[`countdown_${cd.tone}`] || ""}`}
          >
            ● {cd.text}
          </div>
        )}
        {isPast && cd.text && (
          <div className={`${styles.countdown} ${styles.countdownPast}`}>
            ● {cd.text}
          </div>
        )}
      </div>

      <div className={styles.tear}>
        <div className={styles.dashes} />
      </div>

      <div className={styles.bottom}>
        <div className={styles.rowItem}>
          <span className={styles.rowLabel}>Inscripción</span>
          <span
            className={`${styles.rowValue} ${isFree ? styles.rowValueFree : ""}`}
          >
            {formatFee(evento.fee)}
          </span>
        </div>
        <div className={styles.rowItem}>
          <span className={styles.rowLabel}>Cupo</span>
          <span className={styles.rowValue}>
            {hasMax ? (
              <>
                {participants}
                <span className={styles.cupoTotal}>
                  /{evento.maxParticipants}
                </span>
              </>
            ) : (
              `${participants} · sin límite`
            )}
          </span>
        </div>
        {hasMax && (
          <div className={styles.cuposBar}>
            <div
              className={`${styles.cuposFill} ${isFull ? styles.cuposFillFull : ""}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        )}
        <div className={styles.rowItem}>
          <span className={styles.rowLabel}>Estado</span>
          <span className={`${styles.rowValue} ${styles.rowValueAccent}`}>
            {STATUS_LABEL[evento.status] || evento.status}
          </span>
        </div>

        <div className={styles.ctaBlock}>
          {isHost ? (
            <>
              {onOpenInscripciones && (
                <button
                  className={styles.cta}
                  onClick={onOpenInscripciones}
                  type="button"
                >
                  Gestionar inscripciones
                  {pendingCount > 0 ? ` · ${pendingCount} pendientes` : ""}
                </button>
              )}
              <div className={styles.adminBlock}>
                <div className={styles.adminTitle}>◆ Acciones de host</div>
                <div className={styles.adminActions}>
                  {onEdit && (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={onEdit}
                    >
                      <EditIcon size={11} />
                      &nbsp;Editar
                    </button>
                  )}
                  {evento.status === "cancelled" && onReopen ? (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={onReopen}
                    >
                      <RefreshIcon size={11} />
                      &nbsp;Reabrir
                    </button>
                  ) : (onDelete || onCancelEvent) && !confirmDelete ? (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <TrashIcon size={11} />
                      &nbsp;Cancelar
                    </button>
                  ) : null}
                </div>
                {confirmDelete && (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>
                      ¿Cancelar este evento?
                    </span>
                    <button
                      className={`${styles.adminBtn} ${styles.adminBtnConfirm}`}
                      onClick={() => {
                        setConfirmDelete(false);
                        (onDelete || onCancelEvent)();
                      }}
                      type="button"
                    >
                      Sí
                    </button>
                    <button
                      className={styles.adminBtn}
                      onClick={() => setConfirmDelete(false)}
                      type="button"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : !user ? (
            <button
              className={styles.cta}
              type="button"
              onClick={onLoginRequest}
            >
              Iniciá sesión para inscribirte
            </button>
          ) : status === "confirmed" ? (
            <div className={`${styles.state} ${styles.stateConfirmed}`}>
              <CheckIcon size={20} />
              <span className={styles.stateTitle}>
                ¡Inscripción confirmada!
              </span>
              <span className={styles.stateSub}>Tu lugar está reservado</span>
            </div>
          ) : status === "pending" ? (
            <>
              <div className={`${styles.state} ${styles.statePending}`}>
                <ClockIcon size={20} />
                <span className={styles.stateTitle}>Pendiente de revisión</span>
                <span className={styles.stateSub}>
                  El admin revisará tu comprobante
                </span>
              </div>
              {userRegistration?.comprobante?.url && (
                <a
                  href={userRegistration.comprobante.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ghostBtn}
                >
                  Ver comprobante enviado
                </a>
              )}
              {!confirmCancel ? (
                <button
                  className={styles.ghostBtn}
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancelar inscripción
                </button>
              ) : (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmText}>
                    ¿Cancelar tu inscripción?
                  </span>
                  <button
                    className={`${styles.adminBtn} ${styles.adminBtnConfirm}`}
                    type="button"
                    onClick={async () => {
                      await onCancelRegistration();
                      setConfirmCancel(false);
                    }}
                    disabled={cancellingReg}
                  >
                    {cancellingReg ? "…" : "Sí"}
                  </button>
                  <button
                    className={styles.adminBtn}
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                  >
                    No
                  </button>
                </div>
              )}
            </>
          ) : status === "rejected" ? (
            <>
              <div className={`${styles.state} ${styles.stateRejected}`}>
                <XIcon size={20} />
                <span className={styles.stateTitle}>
                  {userRegistration?.permanentlyRejected
                    ? "Inscripción rechazada permanentemente"
                    : "Inscripción rechazada"}
                </span>
                <span className={styles.stateSub}>
                  {userRegistration?.permanentlyRejected
                    ? "El organizador te bloqueó del evento. No podés volver a intentar."
                    : "Podés volver a enviar tu comprobante"}
                </span>
                {userRegistration?.adminNotes && (
                  <span className={styles.stateSub}>
                    ✦ {userRegistration.adminNotes}
                  </span>
                )}
              </div>
              {!userRegistration?.permanentlyRejected &&
                (showForm ? (
                  inscriptionForm
                ) : (
                  <button
                    type="button"
                    className={styles.cta}
                    onClick={() => {
                      setShowForm(true);
                      setLocalErr("");
                    }}
                  >
                    Volver a intentar{" "}
                    {isFree ? "· Gratis" : `· ${formatFee(evento.fee)}`}
                  </button>
                ))}
            </>
          ) : evento.status === "cancelled" ? (
            <button className={styles.ghostBtn} disabled type="button">
              Evento cancelado
            </button>
          ) : evento.status === "closed" ? (
            <button className={styles.ghostBtn} disabled type="button">
              Inscripciones cerradas
            </button>
          ) : evento.status === "draft" ? (
            <button className={styles.ghostBtn} disabled type="button">
              Aún no publicado
            </button>
          ) : isFull ? (
            <button className={styles.ghostBtn} disabled type="button">
              Sin cupo disponible
            </button>
          ) : showForm ? (
            inscriptionForm
          ) : (
            <button
              className={styles.cta}
              type="button"
              onClick={() => setShowForm(true)}
            >
              Inscribirme {isFree ? "· Gratis" : `· ${formatFee(evento.fee)}`}
            </button>
          )}

          {status === "confirmed" && evento.transferDetails && (
            <details className={styles.transferDetails}>
              <summary>Ver datos de transferencia</summary>
              <div className={styles.transferBox}>{evento.transferDetails}</div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
