import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("eventos");
  const STATUS_LABEL = {
    open: t("ticket.statusOpen"),
    closed: t("ticket.statusClosed"),
    cancelled: t("ticket.statusCancelled"),
    draft: t("ticket.statusDraft"),
  };
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
    // Validación local (no llega a la API): este mensaje SÍ vive inline
    // porque es feedback al campo de comprobante mientras se llena el form.
    if (!isFree && !comprobante) {
      setLocalErr(t("ticket.comprobanteRequired"));
      return;
    }
    setLocalErr("");
    try {
      await onInscribirse(comprobante);
      setShowForm(false);
      setComprobante(null);
    } catch {
      // El error del server ya lo muestra el padre vía toast global
      // (addToast). No duplicamos acá — solo mantenemos el form abierto
      // para que el usuario pueda reintentar.
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
            <div className={styles.formLabel}>
              <Meeple />
              {t("ticket.formConditions")}
            </div>
            <p className={styles.formText}>{evento.conditions}</p>
          </div>
        )}
        {!isFree && evento.transferDetails && (
          <div>
            <div className={styles.formLabel}>
              <Meeple />
              {t("ticket.formTransferDetails", { fee: formatFee(evento.fee) })}
            </div>
            <div className={styles.transferBox}>{evento.transferDetails}</div>
          </div>
        )}
        {!isFree && (
          <div>
            <div className={styles.formLabel}>
              <Meeple />
              {t("ticket.formComprobante")}
            </div>
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
            {t("ticket.formCancel")}
          </button>
          <button
            className={styles.cta}
            type="button"
            onClick={handleSubmit}
            disabled={inscribing || (!isFree && !comprobante)}
          >
            {inscribing ? t("ticket.sending") : t("ticket.confirm")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.stub}>
      <div className={styles.top}>
        <div className={styles.label}>
          <Meeple />
          {t("ticket.markDate")}
        </div>
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
        {d && (
          <div className={styles.time}>{t("ticket.time", { time: d.time })}</div>
        )}
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
          <span className={styles.rowLabel}>{t("ticket.feeLabel")}</span>
          <span
            className={`${styles.rowValue} ${isFree ? styles.rowValueFree : ""}`}
          >
            {formatFee(evento.fee)}
          </span>
        </div>
        <div className={styles.rowItem}>
          <span className={styles.rowLabel}>{t("ticket.cupoLabel")}</span>
          <span className={styles.rowValue}>
            {hasMax ? (
              <>
                {participants}
                <span className={styles.cupoTotal}>
                  /{evento.maxParticipants}
                </span>
              </>
            ) : (
              t("ticket.cupoUnlimited", { participants })
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
          <span className={styles.rowLabel}>{t("ticket.statusLabel")}</span>
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
                  {t("ticket.manageRegistrations")}
                  {pendingCount > 0
                    ? t("ticket.manageRegistrationsPending", {
                        count: pendingCount,
                      })
                    : ""}
                </button>
              )}
              <div className={styles.adminBlock}>
                <div className={styles.adminTitle}>
                  <Meeple />
                  {t("ticket.hostActions")}
                </div>
                <div className={styles.adminActions}>
                  {onEdit && (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={onEdit}
                    >
                      <EditIcon size={11} />
                      &nbsp;{t("ticket.edit")}
                    </button>
                  )}
                  {evento.status === "cancelled" && onReopen ? (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={onReopen}
                    >
                      <RefreshIcon size={11} />
                      &nbsp;{t("ticket.reopen")}
                    </button>
                  ) : (onDelete || onCancelEvent) && !confirmDelete ? (
                    <button
                      className={styles.adminBtn}
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <TrashIcon size={11} />
                      &nbsp;{t("ticket.cancel")}
                    </button>
                  ) : null}
                </div>
                {confirmDelete && (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>
                      {t("ticket.confirmCancelEvent")}
                    </span>
                    <button
                      className={`${styles.adminBtn} ${styles.adminBtnConfirm}`}
                      onClick={() => {
                        setConfirmDelete(false);
                        (onDelete || onCancelEvent)();
                      }}
                      type="button"
                    >
                      {t("ticket.yes")}
                    </button>
                    <button
                      className={styles.adminBtn}
                      onClick={() => setConfirmDelete(false)}
                      type="button"
                    >
                      {t("ticket.no")}
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
              {t("ticket.loginToRegister")}
            </button>
          ) : status === "confirmed" ? (
            <div className={`${styles.state} ${styles.stateConfirmed}`}>
              <CheckIcon size={20} />
              <span className={styles.stateTitle}>
                {t("ticket.confirmedTitle")}
              </span>
              <span className={styles.stateSub}>
                {t("ticket.confirmedSub")}
              </span>
            </div>
          ) : status === "pending" ? (
            <>
              <div className={`${styles.state} ${styles.statePending}`}>
                <ClockIcon size={20} />
                <span className={styles.stateTitle}>
                  {t("ticket.pendingTitle")}
                </span>
                <span className={styles.stateSub}>
                  {t("ticket.pendingSub")}
                </span>
              </div>
              {userRegistration?.comprobante?.url && (
                <a
                  href={userRegistration.comprobante.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ghostBtn}
                >
                  {t("ticket.viewSentComprobante")}
                </a>
              )}
              {!confirmCancel ? (
                <button
                  className={styles.ghostBtn}
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                >
                  {t("ticket.cancelRegistration")}
                </button>
              ) : (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmText}>
                    {t("ticket.confirmCancelRegistration")}
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
                    {cancellingReg ? "…" : t("ticket.yes")}
                  </button>
                  <button
                    className={styles.adminBtn}
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                  >
                    {t("ticket.no")}
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
                    ? t("ticket.rejectedPermanentTitle")
                    : t("ticket.rejectedTitle")}
                </span>
                <span className={styles.stateSub}>
                  {userRegistration?.permanentlyRejected
                    ? t("ticket.rejectedPermanentSub")
                    : t("ticket.rejectedSub")}
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
                    {t("ticket.retry")}
                    {isFree
                      ? t("ticket.free")
                      : t("ticket.feeSuffix", { fee: formatFee(evento.fee) })}
                  </button>
                ))}
            </>
          ) : evento.status === "cancelled" ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("ticket.eventCancelled")}
            </button>
          ) : evento.status === "closed" ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("ticket.registrationsClosed")}
            </button>
          ) : evento.status === "draft" ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("ticket.notPublished")}
            </button>
          ) : isFull ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("ticket.noCupo")}
            </button>
          ) : showForm ? (
            inscriptionForm
          ) : (
            <button
              className={styles.cta}
              type="button"
              onClick={() => setShowForm(true)}
            >
              {t("ticket.inscribirme")}
              {isFree
                ? t("ticket.free")
                : t("ticket.feeSuffix", { fee: formatFee(evento.fee) })}
            </button>
          )}

          {status === "confirmed" && evento.transferDetails && (
            <details className={styles.transferDetails}>
              <summary>{t("ticket.viewTransferDetails")}</summary>
              <div className={styles.transferBox}>{evento.transferDetails}</div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
