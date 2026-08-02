import Meeple from "../../components/shared/Meeple";
import { useEffect, useMemo, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import {
  useEventoInscripcionesQuery,
  eventoKeys,
  confirmarInscripcion,
  rechazarInscripcion,
  revertirInscripcion,
} from "../../queries/eventos";
import { dateParts } from "../../utils/eventoDate";
import useTickingNow from "../../utils/useTickingNow";
import TriageColumn from "./TriageColumn";
import { ArrowLeftIcon } from "./EventoIcons";
import styles from "./EventoInscripciones.module.css";

export default function EventoInscripciones() {
  const { t } = useTranslation("eventos");
  const { id } = useParams();
  const { isActuallyAdmin, loading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const queryClient = useQueryClient();

  // Ticker para refrescar las "horas relativas" de las inscripciones cada 30s.
  const now = useTickingNow();

  // Esperar a que termine el auth-loading y verificar admin antes de pegar a
  // la API — un usuario regular ya queda fuera por el <Navigate> de abajo, no
  // tiene sentido gastar un request 403.
  const queryEnabled = !authLoading && isActuallyAdmin;
  const {
    data,
    isPending: queryLoading,
    isError: notFound,
  } = useEventoInscripcionesQuery(id, { enabled: queryEnabled });
  const loading = authLoading || (queryEnabled && queryLoading);

  // Real-time: escuchar nuevas inscripciones y revisiones del propio evento.
  // El socket se monta cuando hay admin autenticado e id, y NO depende de
  // `data` — si dependiera, cada incoming update reescribiría data.evento
  // (vía evento:updated) y dispararía un leave+rejoin del socket. El check
  // de `data?.evento` que estaba antes era defensivo pero innecesario: el
  // server ignora los join:evento de eventos inexistentes, y los listeners
  // usan queryClient.setQueryData(key, prev => prev ? ... : prev) para
  // no-op si la query todavía no tiene datos.
  useEffect(() => {
    if (!isActuallyAdmin) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    // Emitir en `connect` (initial + reconnect). El server tiene los handlers
    // de join:* registrados antes de su await de auth, sin race.
    socket.on("connect", () => socket.emit("join:evento", id));

    socket.on("evento:registration-created", (payload) => {
      if (payload?.eventoId !== id) return;
      queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => {
        if (!prev) return prev;
        const exists = prev.registrations.some(
          (r) => r._id === payload.registration?._id,
        );
        const next = exists
          ? prev.registrations.map((r) =>
              r._id === payload.registration._id ? payload.registration : r,
            )
          : [...prev.registrations, payload.registration];
        return { ...prev, registrations: next };
      });
    });

    socket.on("evento:registration-cancelled", (payload) => {
      if (payload?.eventoId !== id) return;
      queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          registrations: prev.registrations.filter(
            (r) => r._id !== payload.registrationId,
          ),
        };
      });
    });

    socket.on("evento:registration-reviewed", (payload) => {
      if (payload?.eventoId !== id) return;
      queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.user?._id === payload.userId
              ? {
                  ...r,
                  status: payload.status,
                  reviewedAt: payload.reviewedAt,
                  adminNotes: payload.adminNotes ?? r.adminNotes,
                  permanentlyRejected: !!payload.permanentlyRejected,
                  submittedAt: payload.submittedAt || r.submittedAt,
                }
              : r,
          ),
        };
      });
    });

    socket.on("evento:updated", (payload) => {
      if (payload?.eventoId !== id) return;
      const ev = payload.evento;
      if (!ev) return;
      // Spread completo del payload sobre el evento previo. Antes lista white-
      // listeada de campos (title/status/eventDate/maxParticipants) — si el
      // server agregaba un campo nuevo al broadcast, este listener no lo
      // reflejaba. El spread genérico es seguro porque el payload del server
      // (PUT response → emitToEventoRoom) NO incluye registrations ni counts;
      // ver `routes/eventos.js`. Solo el evento "header".
      queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) =>
        prev
          ? {
              ...prev,
              evento: { ...prev.evento, ...ev },
            }
          : prev,
      );
    });

    return () => {
      socket.emit("leave:evento", id);
      socket.disconnect();
    };
  }, [id, isActuallyAdmin, queryClient]);

  const accept = useCallback(
    async (reg, adminNotes) => {
      try {
        await confirmarInscripcion(id, reg.user._id, adminNotes);
        queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.user._id === reg.user._id
              ? {
                  ...r,
                  status: "confirmed",
                  reviewedAt: new Date().toISOString(),
                  adminNotes,
                  permanentlyRejected: false,
                }
              : r,
          ),
        }));
      } catch (err) {
        addToast({
          type: "error",
          title: t("inscripciones.acceptErrorTitle"),
          message:
            err.response?.data?.message ||
            t("inscripciones.acceptErrorMessage"),
        });
      }
    },
    [id, addToast, t, queryClient],
  );

  const reject = useCallback(
    async (reg, adminNotes, permanent = false) => {
      try {
        await rechazarInscripcion(id, reg.user._id, adminNotes, permanent);
        queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.user._id === reg.user._id
              ? {
                  ...r,
                  status: "rejected",
                  reviewedAt: new Date().toISOString(),
                  adminNotes,
                  permanentlyRejected: !!permanent,
                }
              : r,
          ),
        }));
      } catch (err) {
        addToast({
          type: "error",
          title: t("inscripciones.rejectErrorTitle"),
          message:
            err.response?.data?.message ||
            t("inscripciones.rejectErrorMessage"),
        });
      }
    },
    [id, addToast, t, queryClient],
  );

  // Revertir: vuelve el registro a 'pending' como si el usuario recién se
  // hubiera inscripto. Persiste server-side (limpia reviewedAt/Notes/permanent).
  const undo = useCallback(
    async (reg) => {
      try {
        const { data: result } = await revertirInscripcion(id, reg.user._id);
        queryClient.setQueryData(eventoKeys.inscripciones(id), (prev) => ({
          ...prev,
          registrations: prev.registrations.map((r) =>
            r.user._id === reg.user._id
              ? {
                  ...r,
                  status: "pending",
                  submittedAt: result.submittedAt,
                  reviewedAt: null,
                  reviewedBy: null,
                  adminNotes: null,
                  permanentlyRejected: false,
                }
              : r,
          ),
        }));
      } catch (err) {
        addToast({
          type: "error",
          title: t("inscripciones.undoErrorTitle"),
          message:
            err.response?.data?.message || t("inscripciones.undoErrorMessage"),
        });
      }
    },
    [id, addToast, t, queryClient],
  );

  const groups = useMemo(() => {
    const regs = data?.registrations || [];
    return {
      pending: regs.filter((r) => r.status === "pending"),
      confirmed: regs.filter((r) => r.status === "confirmed"),
      rejected: regs.filter((r) => r.status === "rejected"),
    };
  }, [data]);

  // Derivamos counts de `registrations` para garantizar consistencia con las
  // columnas. Antes había doble-conteo entre el optimistic update en los
  // handlers (accept/reject/undo) y el listener de socket que también incrementa.
  const counts = useMemo(() => {
    const regs = data?.registrations || [];
    const pending = regs.filter((r) => r.status === "pending").length;
    const confirmed = regs.filter((r) => r.status === "confirmed").length;
    return {
      total: regs.length,
      pending,
      confirmed,
      rejected: regs.filter((r) => r.status === "rejected").length,
      // El cupo ocupado incluye pendientes + confirmadas (las rechazadas no
      // ocupan). Mismo criterio que TicketStub/TimelineRow/PosterCard para
      // que el contador "X/max" sea consistente en toda la app.
      occupied: pending + confirmed,
    };
  }, [data]);

  if (!authLoading && !isActuallyAdmin) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>{t("inscripciones.loading")}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>{t("inscripciones.notFound")}</p>
        <Link to="/eventos" className={styles.backLink}>
          {t("inscripciones.back")}
        </Link>
      </div>
    );
  }

  const evento = data?.evento || {};
  const d = dateParts(evento.eventDate);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {t("inscripciones.metaTitle", {
            title: evento.title,
          })}
        </title>
      </Helmet>

      <header className={styles.header}>
        <div className={styles.context}>
          <Link to={`/eventos/${id}`} className={styles.contextLink}>
            <ArrowLeftIcon size={11} /> {t("inscripciones.backToEvent")}
          </Link>
          <span className={styles.eyebrow}>
            <Meeple />
            {t("inscripciones.eyebrow")}
          </span>
          <h1 className={styles.title}>
            {evento.title || t("inscripciones.fallbackTitle")}
          </h1>
          {d && (
            <span className={styles.subtitle}>
              {t("inscripciones.subtitle", {
                weekday: d.weekdayLong,
                day: d.day,
                month: d.monthLong,
                time: d.time,
              })}
            </span>
          )}
        </div>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>
              {t("inscripciones.statPending")}
            </span>
            <span className={`${styles.statValue} ${styles.statOrange}`}>
              {counts.pending}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>
              {t("inscripciones.statConfirmed")}
            </span>
            <span className={`${styles.statValue} ${styles.statGreen}`}>
              {counts.confirmed}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>
              {t("inscripciones.statRejected")}
            </span>
            <span className={`${styles.statValue} ${styles.statMuted}`}>
              {counts.rejected}
            </span>
          </div>
          {evento.maxParticipants && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                {t("inscripciones.statCupo")}
              </span>
              <span className={styles.statValue}>
                <span className={styles.statAccent}>{counts.occupied}</span>
                <span className={styles.statMutedInline}>
                  /{evento.maxParticipants}
                </span>
              </span>
            </div>
          )}
        </div>
      </header>

      <div className={styles.columns}>
        <TriageColumn
          title={t("inscripciones.colPendingTitle")}
          status="pending"
          items={groups.pending}
          emptyText={t("inscripciones.colPendingEmpty")}
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
        <TriageColumn
          title={t("inscripciones.colConfirmedTitle")}
          status="confirmed"
          items={groups.confirmed}
          emptyText={t("inscripciones.colConfirmedEmpty")}
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
        <TriageColumn
          title={t("inscripciones.colRejectedTitle")}
          status="rejected"
          items={groups.rejected}
          emptyText={t("inscripciones.colRejectedEmpty")}
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
      </div>
    </div>
  );
}
