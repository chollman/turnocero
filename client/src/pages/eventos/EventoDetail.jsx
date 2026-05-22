import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import useTickingNow from "../../utils/useTickingNow";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, formatFee } from "../../utils/eventoDate";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import TicketStub from "./TicketStub";
import EventoForm from "./EventoForm";
import { ArrowLeftIcon, ImageIcon } from "./EventoIcons";
import styles from "./EventoDetail.module.css";

const STATUS_EYEBROW = {
  open: "Inscripciones abiertas",
  closed: "Inscripciones cerradas",
  cancelled: "Evento cancelado",
  draft: "Borrador · no visible",
};

export default function EventoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveEvento } = useNotifications();
  const userId = user?._id;

  // Mientras el usuario esté viendo este evento, las notificaciones que
  // lleguen para él se marcan leídas y los toasts se suprimen (mismo
  // patrón que TableDetail/TorneoDetail).
  useEffect(() => {
    setActiveEvento(id);
    return () => setActiveEvento(null);
  }, [id, setActiveEvento]);

  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [inscribing, setInscribing] = useState(false);
  const [cancellingReg, setCancellingReg] = useState(false);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionError, setActionError] = useState("");

  // Ticker para que TicketStub refresque su countdown ("en X días").
  const now = useTickingNow();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/eventos/${id}`);
        if (cancelled) return;
        setEvento(data);
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
  }, [id]);

  // Real-time: cualquier viewer (incluido el user que se inscribió) recibe
  // updates de status/counts del evento. El user dueño del registro recibe
  // además `evento:registration-reviewed` por su personal room user:<id>.
  useEffect(() => {
    if (!evento) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    // Emitir en `connect` (initial + reconnect). El server registra todos los
    // handlers ANTES de su auth-await, así que el emit no se pierde por race.
    socket.on("connect", () => socket.emit("join:evento", id));

    socket.on("evento:counts-changed", (payload) => {
      if (payload?.eventoId !== id || !payload.counts) return;
      setEvento((prev) =>
        prev ? { ...prev, registrationCount: payload.counts } : prev,
      );
    });

    socket.on("evento:registration-reviewed", (payload) => {
      if (payload?.eventoId !== id) return;
      setEvento((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (payload.counts) next.registrationCount = payload.counts;

        // Si soy el usuario afectado, actualizar mi userRegistration
        if (user?._id && payload.userId === user._id) {
          next.userRegistration = {
            ...(prev.userRegistration || {}),
            _id: payload.registrationId,
            status: payload.status,
            submittedAt:
              payload.submittedAt || prev.userRegistration?.submittedAt,
            adminNotes: payload.adminNotes ?? null,
            permanentlyRejected: !!payload.permanentlyRejected,
          };
        }

        // Mantener confirmedRegistrations al día: agregar al confirmar, sacar
        // cuando deja de estar confirmado. Necesita el reg populated con
        // info de user (vino en payload.registration).
        const list = prev.confirmedRegistrations || [];
        if (payload.status === "confirmed" && payload.registration?.user) {
          const exists = list.some((r) => r._id === payload.registration._id);
          next.confirmedRegistrations = exists
            ? list.map((r) =>
                r._id === payload.registration._id
                  ? {
                      _id: payload.registration._id,
                      user: payload.registration.user,
                    }
                  : r,
              )
            : [
                ...list,
                {
                  _id: payload.registration._id,
                  user: payload.registration.user,
                },
              ];
        } else if (payload.status !== "confirmed") {
          next.confirmedRegistrations = list.filter(
            (r) =>
              r._id !== payload.registrationId &&
              r.user?._id !== payload.userId,
          );
        }

        return next;
      });
    });

    socket.on("evento:updated", (payload) => {
      if (payload?.eventoId !== id || !payload.evento) return;
      // Mismo problema que el PUT directo: el payload trae userRegistration:null
      // porque el server no conoce al caller del socket. Usamos el helper que
      // preserva la inscripción del usuario que está mirando.
      setEvento((prev) =>
        prev ? mergeEventoUpdate(prev, payload.evento) : payload.evento,
      );
    });

    return () => {
      socket.emit("leave:evento", id);
      socket.disconnect();
    };
    // Optional chaining a propósito: `evento` y `user` pueden ser null antes
    // del fetch inicial y mientras se desautentica. Acceder con `.` crudo
    // hace crashear el árbol entero; con `?.` el effect simplemente espera
    // al primer estado válido. `evento` queda fuera del dep array a propósito
    // — sólo nos interesa reconectar el socket cuando cambia el _id, no en
    // cada update de counts/userRegistration que dispararía leave+rejoin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?._id, id, user?._id]);

  async function handleInscribirse(comprobanteFile) {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    setInscribing(true);
    setActionError("");
    try {
      const fd = new FormData();
      if (comprobanteFile) fd.append("comprobante", comprobanteFile);
      const { data: userReg } = await axios.post(
        `/api/eventos/${id}/inscribirse`,
        fd,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      // Sólo actualizamos `userRegistration` localmente. Los counts los
      // refresca el broadcast `evento:counts-changed` que el server emite
      // antes de responder — si los tocamos optimistamente acá, doblamos:
      // el socket entrega el count autoritativo (+1) y el optimistic suma
      // 1 encima → +2.
      setEvento((prev) => ({
        ...prev,
        userRegistration: userReg,
      }));
    } catch (err) {
      const msg =
        err.response?.data?.message || "No pudimos enviar tu inscripción.";
      setActionError(msg);
      throw err;
    } finally {
      setInscribing(false);
    }
  }

  async function handleCancelRegistration() {
    setCancellingReg(true);
    setActionError("");
    try {
      await axios.delete(`/api/eventos/${id}/inscribirse`);
      // Mismo patrón que handleInscribirse: el socket evento:counts-changed
      // ya viene con el count autoritativo, así que no tocamos counts acá.
      // Sólo limpiamos userRegistration.
      setEvento((prev) => ({
        ...prev,
        userRegistration: null,
      }));
    } catch (err) {
      setActionError(
        err.response?.data?.message || "No pudimos cancelar tu inscripción.",
      );
    } finally {
      setCancellingReg(false);
    }
  }

  // Helper para mergear updates que vienen del server (PUT response o
  // socket `evento:updated`) preservando los campos viewer-dependientes que
  // el server no puede llenar:
  //
  //   - `userRegistration`: el server lo deriva del caller del request,
  //     pero un broadcast a la `evento:<id>` room no tiene contexto del
  //     viewer. Llega siempre como null y pisaría el badge "inscripto" en
  //     pantalla.
  //   - `confirmedRegistrations`: el PUT del server NO popula este campo
  //     (sólo conoce el evento, no quién mira); mergear crudo lo borraría
  //     y vaciaría la lista de inscriptos.
  //
  // Patrón aplicable a cualquier detail page que mezcle (a) datos del
  // evento/objeto que cambian con cada update y (b) datos derivados del
  // viewer que el server no puede recalcular en un broadcast. Si otro
  // feature necesita esto, copiar el helper local hasta tener 3+ usuarios.
  function mergeEventoUpdate(prev, data, overrides = {}) {
    return {
      ...prev,
      ...data,
      userRegistration:
        prev?.userRegistration ?? data?.userRegistration ?? null,
      confirmedRegistrations:
        data?.confirmedRegistrations ?? prev?.confirmedRegistrations ?? [],
      ...overrides,
    };
  }

  async function handleSaveEdit(fd) {
    setSavingEdit(true);
    setActionError("");
    try {
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvento((prev) => mergeEventoUpdate(prev, data));
      setEditing(false);
    } catch (err) {
      setActionError(
        err.response?.data?.message || "No pudimos guardar los cambios.",
      );
      throw err;
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCancelEvent() {
    setActionError("");
    try {
      const fd = new FormData();
      fd.append("status", "cancelled");
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvento((prev) =>
        mergeEventoUpdate(prev, data, { status: "cancelled" }),
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "No pudimos cancelar el evento.",
      );
    }
  }

  async function handleReopenEvent() {
    setActionError("");
    try {
      const fd = new FormData();
      fd.append("status", "open");
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvento((prev) => mergeEventoUpdate(prev, data, { status: "open" }));
    } catch (err) {
      setActionError(
        err.response?.data?.message || "No pudimos reabrir el evento.",
      );
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skelBack} />
        <div className={styles.layout}>
          <div className={styles.skelMain}>
            <div className={styles.skelHero} />
            <div className={styles.skelTitleBlock}>
              <div className={styles.skelEyebrow} />
              <div className={styles.skelTitle} />
              <div className={styles.skelTitleShort} />
            </div>
            <div className={styles.skelMeta}>
              <div className={styles.skelMetaCell} />
              <div className={styles.skelMetaCell} />
              <div className={styles.skelMetaCell} />
              <div className={styles.skelMetaCell} />
            </div>
            <div className={styles.skelSection}>
              <div className={styles.skelSectionHead} />
              <div className={styles.skelLine} />
              <div className={styles.skelLine} />
              <div className={`${styles.skelLine} ${styles.skelLineShort}`} />
            </div>
            <div className={styles.skelSection}>
              <div className={styles.skelSectionHead} />
              <div className={styles.skelLine} />
              <div className={`${styles.skelLine} ${styles.skelLineShort}`} />
            </div>
          </div>
          <aside className={styles.aside}>
            <div className={styles.skelStub} />
          </aside>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <p className={styles.notFoundEyebrow}>◆ 404</p>
          <h1 className={styles.notFoundTitle}>Evento no encontrado</h1>
          <Link to="/eventos" className={styles.notFoundLink}>
            ← Volver a eventos
          </Link>
        </div>
      </div>
    );
  }

  const d = dateParts(evento.eventDate);
  const isFree = !evento.fee;
  const hasMax = !!(evento.maxParticipants && evento.maxParticipants > 0);
  const confirmedCount = evento.registrationCount?.confirmed ?? 0;
  const pendingCount = evento.registrationCount?.pending ?? 0;
  // Cuentan al cupo todas las inscripciones activas (pendientes + confirmadas).
  const activeCount = confirmedCount + pendingCount;
  const isHost = userId && evento.author?._id === userId;
  const authorDisplay = getUserDisplay(evento.author);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{evento.title} — Turnocero</title>
        <meta
          name="description"
          content={
            evento.description?.slice(0, 160) || `Evento: ${evento.title}`
          }
        />
      </Helmet>

      {lightbox && evento.image?.url && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setLightbox(false)}
          >
            ✕
          </button>
          <img
            src={evento.image.url}
            alt={evento.title}
            className={styles.lightboxImg}
          />
        </div>
      )}

      <LoginPromptModal
        isOpen={showLoginPrompt}
        message="Iniciá sesión para inscribirte en este evento"
        onClose={() => setShowLoginPrompt(false)}
      />

      <Link to="/eventos" className={styles.back}>
        <ArrowLeftIcon size={11} /> Volver a eventos
      </Link>

      <div className={styles.layout}>
        <main className={styles.main}>
          {editing ? (
            <EventoForm
              mode="edit"
              initialEvento={evento}
              onSubmit={handleSaveEdit}
              onCancel={() => setEditing(false)}
              submitting={savingEdit}
            />
          ) : (
            <>
              <div className={styles.hero}>
                {evento.image?.url ? (
                  <button
                    type="button"
                    className={styles.heroBtn}
                    onClick={() => setLightbox(true)}
                    aria-label="Ver imagen ampliada"
                  >
                    <img
                      src={evento.image.url}
                      alt={evento.title}
                      className={styles.heroImg}
                    />
                  </button>
                ) : (
                  <div className={styles.heroFallback}>
                    <div className={styles.heroFallbackInner}>
                      <ImageIcon size={48} />
                      <span>imagen del evento · {evento.title}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.titleBlock}>
                <div className={styles.eyebrow}>
                  {STATUS_EYEBROW[evento.status] || ""}
                </div>
                <h1 className={styles.title}>{evento.title}</h1>
              </div>

              <div className={styles.metaStrip}>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Cuándo</span>
                  <span className={styles.metaValue}>
                    {d
                      ? `${d.weekdayLong} ${d.day} ${d.monthLong}`
                      : "A confirmar"}
                  </span>
                  {d && (
                    <span className={`${styles.metaValue} ${styles.metaTime}`}>
                      {d.time} hs
                    </span>
                  )}
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Dónde</span>
                  <span className={styles.metaValue}>
                    {(() => {
                      const t = typeof evento.location === "string"
                        ? evento.location
                        : evento.location?.texto || "";
                      // En el detalle mostramos "calle, ciudad" — formato cómodo,
                      // sin ruido de provincia/país. Si el admin seteó displayName,
                      // se usa eso. La dirección completa queda accesible en el
                      // title (tooltip).
                      const display = getLocationDisplay(evento.location, "regular");
                      return (
                        <span title={t}>{display || "Por confirmar"}</span>
                      );
                    })()}
                    {(() => {
                      // formatDistanceKm devuelve null para distancias que
                      // redondean a 0m (evita "0 m" / "Aquí mismo" redundantes).
                      const d = formatDistanceKm(evento.distanceKm);
                      return d ? (
                        <span style={{ marginLeft: 6, color: "var(--green)", fontWeight: 600, fontSize: "0.85em" }}>
                          · {d}
                        </span>
                      ) : null;
                    })()}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Inscripción</span>
                  <span
                    className={`${styles.metaValue} ${isFree ? styles.metaValueFree : ""}`}
                  >
                    {formatFee(evento.fee)}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Cupo</span>
                  <span className={styles.metaValue}>
                    {hasMax
                      ? `${activeCount} de ${evento.maxParticipants}`
                      : `${activeCount} inscriptos`}
                  </span>
                </div>
              </div>

              {actionError && (
                <p className={styles.actionError}>{actionError}</p>
              )}

              {evento.description && (
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>◆ Descripción</span>
                    <span className={styles.sectionRule} />
                  </div>
                  <p className={styles.body}>{evento.description}</p>
                </section>
              )}

              {evento.conditions && (
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>◆ Condiciones</span>
                    <span className={styles.sectionRule} />
                  </div>
                  <p className={styles.body}>{evento.conditions}</p>
                </section>
              )}

              {evento.author && (
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>◆ Organiza</span>
                    <span className={styles.sectionRule} />
                  </div>
                  <div className={styles.hostCard}>
                    <Avatar user={evento.author} size="xl" />
                    <div className={styles.hostCardDetails}>
                      <div className={styles.hostCardLabel}>
                        Host del evento
                      </div>
                      <div className={styles.hostCardName}>
                        {authorDisplay.name}
                      </div>
                      {evento.author.username && (
                        <div className={styles.hostCardSub}>
                          @{evento.author.username}
                        </div>
                      )}
                    </div>
                    {!authorDisplay.isDeleted && evento.author?._id && (
                      <Link
                        to={`/usuarios/${evento.author._id}`}
                        className={styles.hostCardLink}
                      >
                        Ver perfil
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {evento.confirmedRegistrations?.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>
                      ◆ Inscriptos confirmados ·{" "}
                      {evento.confirmedRegistrations.length}
                    </span>
                    <span className={styles.sectionRule} />
                  </div>
                  <div className={styles.participantsGrid}>
                    {evento.confirmedRegistrations.map((r) => {
                      const d2 = getUserDisplay(r.user);
                      return (
                        <div key={r._id} className={styles.participant}>
                          <Avatar user={r.user} size="sm" />
                          <span>{d2.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        <aside className={styles.aside}>
          <TicketStub
            evento={evento}
            user={user}
            isHost={isHost}
            userRegistration={evento.userRegistration}
            pendingCount={pendingCount}
            inscribing={inscribing}
            cancellingReg={cancellingReg}
            now={now}
            onInscribirse={handleInscribirse}
            onCancelRegistration={handleCancelRegistration}
            onLoginRequest={() => setShowLoginPrompt(true)}
            onOpenInscripciones={
              isHost
                ? () => navigate(`/eventos/${id}/inscripciones`)
                : undefined
            }
            onEdit={isHost ? () => setEditing(true) : undefined}
            onCancelEvent={
              isHost && evento.status !== "cancelled"
                ? handleCancelEvent
                : undefined
            }
            onReopen={
              isHost && evento.status === "cancelled"
                ? handleReopenEvent
                : undefined
            }
          />
        </aside>
      </div>
    </div>
  );
}
