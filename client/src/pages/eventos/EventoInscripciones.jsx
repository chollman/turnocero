import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { dateParts } from "../../utils/eventoDate";
import TriageColumn from "./TriageColumn";
import { ArrowLeftIcon } from "./EventoIcons";
import styles from "./EventoInscripciones.module.css";

export default function EventoInscripciones() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState("");

  // Ticker para refrescar las "horas relativas" de las inscripciones cada 30s.
  // Sin esto, Date.now() inline en render rompe react-hooks/purity.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tickerId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tickerId);
  }, []);

  useEffect(() => {
    // Esperar a que termine el auth-loading y verificar admin antes de pegar
    // a la API. Un usuario regular ya queda fuera por el <Navigate> de abajo;
    // no tiene sentido gastar un request 403.
    if (authLoading) return undefined;
    if (!user?.isAdmin) {
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
  }, [id, authLoading, user?.isAdmin]);

  // Real-time: escuchar nuevas inscripciones y revisiones del propio evento.
  // El socket se monta cuando hay admin autenticado e id, y NO depende de
  // `data` — si dependiera, cada incoming update reescribiría data.evento
  // (vía evento:updated) y dispararía un leave+rejoin del socket. El check
  // de `data?.evento` que estaba antes era defensivo pero innecesario: el
  // server ignora los join:evento de eventos inexistentes, y los listeners
  // usan setData(prev => prev ? ... : prev) para no-op si data llega null.
  useEffect(() => {
    if (!user?.isAdmin) return undefined;
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
      setData((prev) =>
        prev
          ? {
              ...prev,
              evento: {
                ...prev.evento,
                title: ev.title,
                status: ev.status,
                eventDate: ev.eventDate,
                maxParticipants: ev.maxParticipants,
              },
            }
          : prev,
      );
    });

    return () => {
      socket.emit("leave:evento", id);
      socket.disconnect();
    };
  }, [id, user?.isAdmin]);

  const accept = useCallback(
    async (reg, adminNotes) => {
      setActionError("");
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
        setActionError(
          err.response?.data?.message || "No pudimos confirmar la inscripción.",
        );
      }
    },
    [id],
  );

  const reject = useCallback(
    async (reg, adminNotes, permanent = false) => {
      setActionError("");
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
        setActionError(
          err.response?.data?.message || "No pudimos rechazar la inscripción.",
        );
      }
    },
    [id],
  );

  // Revertir: vuelve el registro a 'pending' como si el usuario recién se
  // hubiera inscripto. Persiste server-side (limpia reviewedAt/Notes/permanent).
  const undo = useCallback(
    async (reg) => {
      setActionError("");
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
        setActionError(
          err.response?.data?.message || "No pudimos revertir la inscripción.",
        );
      }
    },
    [id],
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
    return {
      total: regs.length,
      pending: regs.filter((r) => r.status === "pending").length,
      confirmed: regs.filter((r) => r.status === "confirmed").length,
      rejected: regs.filter((r) => r.status === "rejected").length,
    };
  }, [data]);

  if (!authLoading && !user?.isAdmin) return <Navigate to="/" replace />;

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
                <span className={styles.statAccent}>{counts.confirmed}</span>
                <span className={styles.statMutedInline}>
                  /{evento.maxParticipants}
                </span>
              </span>
            </div>
          )}
        </div>
      </header>

      {actionError && <p className={styles.actionError}>{actionError}</p>}

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
