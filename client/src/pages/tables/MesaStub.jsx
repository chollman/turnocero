import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SeatTrack from "../../components/shared/SeatTrack";
import { dateParts, countdown } from "../../utils/eventoDate";
import { getLocationDisplay } from "../../utils/location";
import styles from "./MesaStub.module.css";

const CheckIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const CrownIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 19h18l-2-11-4 3-3-6-3 6-4-3z" />
  </svg>
);

const EditIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// Sticky "ticket stub" para el detalle de una mesa. Inspirado en el de
// Eventos pero adaptado al modelo de mesas:
//   - sin fee/comprobante (las mesas son siempre gratis)
//   - acceso público vs privado en lugar de open/closed/draft
//   - CTAs por userState (idle / hosting / joined / pending / full / anon /
//     cancelled)
//
// El parent (TableDetail) le pasa los handlers cableados a la API; el stub
// es presentacional + manejo de confirm-popovers locales (cancel mesa,
// confirmar leave).
export default function MesaStub({
  table,
  userState = "idle",
  pendingCount = 0,
  busy = false,
  onJoin,
  onCancelRequest,
  onLeave,
  onEdit,
  onCancelMesa,
  onLoginRequest,
  now,
  // Slot opcional para el chat privado de la mesa. Cuando el viewer es
  // participante, el parent (TableDetail) le pasa el header "Chat" + el
  // <TableChat>; en otros estados queda null y la sección no se renderiza.
  chatSlot = null,
}) {
  const { t } = useTranslation("tables");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmCancelMesa, setConfirmCancelMesa] = useState(false);

  const d = dateParts(table.date);
  const cd = countdown(table.date, now);
  const isCancelled = table.status === "cancelled";
  const isPrivate = table.privacy === "private";
  const totalSeats = (table.maxPlayers || 0) + 1;
  const filledSeats = (table.players?.length || 0) + 1;
  const available = totalSeats - filledSeats;
  const isFull = available <= 0;
  const locationTexto =
    getLocationDisplay(table.location, "regular") || t("stub.locationTbd");

  const showCountdown =
    !isCancelled && cd.text && cd.tone !== "past" && userState !== "full";

  return (
    <aside className={styles.stub}>
      <div className={styles.top}>
        <div className={styles.label}><Meeple />{t("stub.label")}</div>
        {d && (
          <div className={styles.dateBlock}>
            <span className={styles.day}>{d.day}</span>
            <div className={styles.dateRight}>
              <div className={styles.month}>{d.monthLong}</div>
              <div className={styles.weekday}>
                {t("stub.weekdayYear", { weekday: d.weekdayLong, year: d.year })}
              </div>
            </div>
          </div>
        )}
        {d && (
          <div className={styles.time}>{t("stub.time", { time: d.time })}</div>
        )}
        {showCountdown && (
          <div
            className={`${styles.countdown} ${styles[`countdown_${cd.tone}`] || ""}`}
          >
            ● {cd.text}
          </div>
        )}
        {cd.tone === "past" && cd.text && !isCancelled && (
          <div className={`${styles.countdown} ${styles.countdown_past}`}>
            ● {cd.text}
          </div>
        )}
      </div>

      <div className={styles.tear} aria-hidden="true">
        <div className={styles.dashes} />
      </div>

      <div className={styles.bottom}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("stub.rowGame")}</span>
          <span className={styles.rowValue} title={table.boardGame}>
            {table.boardGame}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("stub.rowLocation")}</span>
          <span className={styles.rowValue} title={locationTexto}>
            {locationTexto || t("stub.locationTbd")}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("stub.rowPlayers")}</span>
          <span
            className={`${styles.rowValue} ${isFull ? styles.rowValue_full : ""}`}
          >
            {filledSeats}/{totalSeats}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("stub.rowAccess")}</span>
          <span className={styles.rowValue}>
            {isPrivate ? t("stub.accessPrivate") : t("stub.accessPublic")}
          </span>
        </div>
        <div className={styles.seatTrackWrap}>
          <SeatTrack filled={filledSeats} total={totalSeats} full={isFull} />
        </div>

        <div className={styles.ctaBlock}>
          {isCancelled ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("stub.cancelled")}
            </button>
          ) : userState === "past" ? (
            // Mesa finalizada (fecha pasada) — viewer no-admin queda en modo
            // sólo-lectura para acciones que mutan la mesa. Chat/fotos/
            // comentarios/ratings se manejan en sus propias secciones; acá
            // sólo damos el estado del CTA.
            <div className={`${styles.state} ${styles.state_past}`}>
              <ClockIcon size={16} />
              <span className={styles.stateTitle}>{t("stub.pastTitle")}</span>
              <span className={styles.stateSub}>{t("stub.pastSub")}</span>
            </div>
          ) : userState === "anon" ? (
            <button
              type="button"
              className={styles.cta}
              onClick={onLoginRequest}
            >
              {t("stub.anonCta")}
            </button>
          ) : userState === "hosting" ? (
            <>
              <div className={`${styles.state} ${styles.state_hosting}`}>
                <CrownIcon size={16} />
                <span className={styles.stateTitle}>{t("stub.hostTitle")}</span>
                <span className={styles.stateSub}>
                  {pendingCount > 0
                    ? t("stub.hostPending", { count: pendingCount })
                    : t("stub.hostUpToDate")}
                </span>
              </div>
              <div className={styles.adminBlock}>
                <div className={styles.adminTitle}>
                  <Meeple />
                  {t("stub.hostActions")}
                </div>
                <div className={styles.adminActions}>
                  {onEdit && (
                    <button
                      type="button"
                      className={styles.adminBtn}
                      onClick={onEdit}
                      disabled={busy}
                    >
                      <EditIcon size={11} />
                      &nbsp;{t("stub.edit")}
                    </button>
                  )}
                  {onCancelMesa && !confirmCancelMesa && (
                    <button
                      type="button"
                      className={styles.adminBtn}
                      onClick={() => setConfirmCancelMesa(true)}
                      disabled={busy}
                    >
                      <TrashIcon size={11} />
                      &nbsp;{t("stub.cancel")}
                    </button>
                  )}
                </div>
                {confirmCancelMesa && (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>
                      {t("stub.confirmCancelMesa")}
                    </span>
                    <button
                      type="button"
                      className={`${styles.adminBtn} ${styles.adminBtnConfirm}`}
                      onClick={() => {
                        setConfirmCancelMesa(false);
                        onCancelMesa();
                      }}
                      disabled={busy}
                    >
                      {t("stub.yes")}
                    </button>
                    <button
                      type="button"
                      className={styles.adminBtn}
                      onClick={() => setConfirmCancelMesa(false)}
                    >
                      {t("stub.no")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : userState === "joined" ? (
            <>
              <div className={`${styles.state} ${styles.state_joined}`}>
                <CheckIcon size={16} />
                <span className={styles.stateTitle}>{t("stub.joinedTitle")}</span>
                <span className={styles.stateSub}>{t("stub.joinedSub")}</span>
              </div>
              {!confirmLeave ? (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setConfirmLeave(true)}
                  disabled={busy}
                >
                  {t("stub.leave")}
                </button>
              ) : (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmText}>
                    {t("stub.confirmLeave")}
                  </span>
                  <button
                    type="button"
                    className={`${styles.adminBtn} ${styles.adminBtnConfirm}`}
                    onClick={async () => {
                      await onLeave();
                      setConfirmLeave(false);
                    }}
                    disabled={busy}
                  >
                    {t("stub.yes")}
                  </button>
                  <button
                    type="button"
                    className={styles.adminBtn}
                    onClick={() => setConfirmLeave(false)}
                  >
                    {t("stub.no")}
                  </button>
                </div>
              )}
            </>
          ) : userState === "pending" ? (
            <>
              <div className={`${styles.state} ${styles.state_pending}`}>
                <ClockIcon size={16} />
                <span className={styles.stateTitle}>
                  {t("stub.pendingTitle")}
                </span>
                <span className={styles.stateSub}>{t("stub.pendingSub")}</span>
              </div>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={onCancelRequest}
                disabled={busy}
              >
                {t("stub.cancelRequest")}
              </button>
            </>
          ) : isFull ? (
            <button className={styles.ghostBtn} disabled type="button">
              {t("stub.full")}
            </button>
          ) : (
            <button
              type="button"
              className={styles.cta}
              onClick={onJoin}
              disabled={busy}
            >
              {isPrivate ? t("stub.requestSeat") : t("stub.joinMesa")}
            </button>
          )}
        </div>
      </div>

      {/* Chat privado al pie del stub — solo visible cuando el viewer es
          participante (el padre se encarga de pasarlo o no). El header
          con sectionHead + InfoTooltip vive en el slot para mantener la
          tipografía consistente con las otras secciones del detalle. */}
      {chatSlot && <div className={styles.chatSection}>{chatSlot}</div>}
    </aside>
  );
}
