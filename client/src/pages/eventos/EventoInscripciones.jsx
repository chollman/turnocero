import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { dateParts } from "../../utils/eventoDate";
import useTickingNow from "../../utils/useTickingNow";
import TriageColumn from "./TriageColumn";
import { ArrowLeftIcon } from "./EventoIcons";
import styles from "./EventoInscripciones.module.css";

export default function EventoInscripciones() {
  const { id } = useParams();
  const { isActuallyAdmin, loading: authLoading } = useAuth();
  const { addToast } = useNotifications();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Ticker para refrescar las "horas relativas" de las inscripciones cada 30s.
  const now = useTickingNow();

  useEffect(() => {
    // Esperar a que termine el auth-loading y verificar admin antes de pegar
    // a la API. Un usuario regular ya queda fuera por el <Navigate> de abajo;
    // no tiene sentido gastar un request 403.
    if (authLoading) return undefined;
    if (!isActuallyAdmin) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: res } = await axios.get(
          `/api/eventos/${id}/inscripciones`,
        );
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled && err.response?.status === 404) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, isActuallyAdmin]);

  // Real-time: escuchar nuevas inscripciones y revisiones del propio evento.
  // El socket se monta cuando hay admin autenticado e id, y NO depende de
  // `data` — si dependiera, cada incoming update reescribiría data.evento
  // (vía evento:updated) y dispararía un leave+rejoin del socket. El check
  // de `data?.evento` que estaba antes era defensivo pero innecesario: el
  // server ignora los join:evento de eventos inexistentes, y los listeners
  // usan setData(prev => prev ? ... : prev) para no-op si data llega null.
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
      setData((prev) => {
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
      setData((prev) => {
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
      setData((prev) => {
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
      setData((prev) =>
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
  }, [id, isActuallyAdmin]);

  const accept = useCallback(
    async (reg, adminNotes) => {
      try {
        await axios.patch(
          `/api/eventos/${id}/inscripciones/${reg.user._id}/confirmar`,
          { adminNotes },
        );
        setData((prev) => ({
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
          title: "No pudimos confirmar la inscripción",
          message: err.response?.data?.message || "Reintentá en unos segundos.",
        });
      }
    },
    [id, addToast],
  );

  const reject = useCallback(
    async (reg, adminNotes, permanent = false) => {
      try {
        await axios.patch(
          `/api/eventos/${id}/inscripciones/${reg.user._id}/rechazar`,
          {
            adminNotes,
            permanent,
          },
        );
        setData((prev) => ({
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
          title: "No pudimos rechazar la inscripción",
          message: err.response?.data?.message || "Reintentá en unos segundos.",
        });
      }
    },
    [id, addToast],
  );

  // Revertir: vuelve el registro a 'pending' como si el usuario recién se
  // hubiera inscripto. Persiste server-side (limpia reviewedAt/Notes/permanent).
  const undo = useCallback(
    async (reg) => {
      try {
        const { data: result } = await axios.patch(
          `/api/eventos/${id}/inscripciones/${reg.user._id}/revertir`,
        );
        setData((prev) => ({
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
          title: "No pudimos revertir la inscripción",
          message: err.response?.data?.message || "Reintentá en unos segundos.",
        });
      }
    },
    [id, addToast],
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
        <p className={styles.loading}>Cargando inscripciones…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <p className={styles.notFound}>Evento no encontrado.</p>
        <Link to="/eventos" className={styles.backLink}>
          ← Volver a eventos
        </Link>
      </div>
    );
  }

  const evento = data?.evento || {};
  const d = dateParts(evento.eventDate);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Inscripciones — {evento.title} — Turnocero</title>
      </Helmet>

      <header className={styles.header}>
        <div className={styles.context}>
          <Link to={`/eventos/${id}`} className={styles.contextLink}>
            <ArrowLeftIcon size={11} /> Volver al evento
          </Link>
          <span className={styles.eyebrow}>◆ Gestión de inscripciones</span>
          <h1 className={styles.title}>{evento.title || "Evento"}</h1>
          {d && (
            <span className={styles.subtitle}>
              {d.weekdayLong} {d.day} {d.monthLong} · {d.time} hs
            </span>
          )}
        </div>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Pendientes</span>
            <span className={`${styles.statValue} ${styles.statOrange}`}>
              {counts.pending}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Confirmadas</span>
            <span className={`${styles.statValue} ${styles.statGreen}`}>
              {counts.confirmed}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Rechazadas</span>
            <span className={`${styles.statValue} ${styles.statMuted}`}>
              {counts.rejected}
            </span>
          </div>
          {evento.maxParticipants && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Cupo</span>
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
          title="Pendientes de revisión"
          status="pending"
          items={groups.pending}
          emptyText="Nada por revisar 🎉"
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
        <TriageColumn
          title="Confirmadas"
          status="confirmed"
          items={groups.confirmed}
          emptyText="Sin inscripciones confirmadas"
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
        <TriageColumn
          title="Rechazadas"
          status="rejected"
          items={groups.rejected}
          emptyText="Sin rechazos"
          onAccept={accept}
          onReject={reject}
          onUndo={undo}
          now={now}
        />
      </div>
    </div>
  );
}
