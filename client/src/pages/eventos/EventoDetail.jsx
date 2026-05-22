import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import useTickingNow from "../../utils/useTickingNow";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Modal from "../../components/shared/Modal";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, formatFee } from "../../utils/eventoDate";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import TicketStub from "./TicketStub";
import EventoForm from "./EventoForm";
import EventoLudoteca from "./EventoLudoteca";
import EventoMesas from "./EventoMesas";
import useEventoSocket from "./useEventoSocket";
import { ArrowLeftIcon, ImageIcon } from "./EventoIcons";
import styles from "./EventoDetail.module.css";

const STATUS_EYEBROW = {
  open: "Inscripciones abiertas",
  closed: "Inscripciones cerradas",
  cancelled: "Evento cancelado",
  draft: "Borrador · no visible",
};

// Tabs válidos. Defaults a 'detalle' (vista actual). El estado se sincroniza
// con `?tab=` para deep-link y back-button friendly.
const VALID_TABS = ["detalle", "ludoteca", "mesas"];

export default function EventoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { setActiveEvento, addToast } = useNotifications();
  const userId = user?._id;

  // Tab activo: useState como fuente única de verdad. Inicializa leyendo el
  // query param `?tab=`; deep-link funciona, y un setState provoca re-render
  // inmediato sin depender de la reactividad de useSearchParams (que en
  // algunas versiones de react-router-dom no dispara re-render al setear).
  const [activeTab, setActiveTabState] = useState(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    return VALID_TABS.includes(urlTab) ? urlTab : "detalle";
  });
  // Dirección del slide al cambiar de tab: "right" cuando el user va hacia
  // adelante en el orden VALID_TABS (Detalle → Ludoteca → Mesas), "left"
  // hacia atrás. Default "right" para que el primer mount también deslice.
  const [tabDirection, setTabDirection] = useState("right");
  // Sync URL ↔ state cuando el user vuelve atrás/adelante (cambia location.search).
  useEffect(() => {
    const urlTab = new URLSearchParams(location.search).get("tab");
    const validated = VALID_TABS.includes(urlTab) ? urlTab : "detalle";
    setActiveTabState((prev) => {
      if (prev === validated) return prev;
      const fromIdx = VALID_TABS.indexOf(prev);
      const toIdx = VALID_TABS.indexOf(validated);
      setTabDirection(toIdx > fromIdx ? "right" : "left");
      return validated;
    });
  }, [location.search]);
  // Setter público: actualiza state y refleja en URL via replaceState (sin
  // crear entrada en el history para cada click).
  const setActiveTab = (tab) => {
    setActiveTabState((prev) => {
      if (prev !== tab) {
        const fromIdx = VALID_TABS.indexOf(prev);
        const toIdx = VALID_TABS.indexOf(tab);
        setTabDirection(toIdx > fromIdx ? "right" : "left");
      }
      return tab;
    });
    const next = new URLSearchParams(window.location.search);
    if (tab === "detalle") next.delete("tab");
    else next.set("tab", tab);
    const search = next.toString();
    const newUrl = search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  };

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
        setLudotecaItems(data.ludoteca || []);
        // Mesas: fetch en paralelo. Falla silenciosa (UI cae al fetch
        // propio de EventoMesas como fallback si seguimos en la página).
        axios
          .get(`/api/eventos/${id}/mesas`)
          .then(({ data: mesasData }) => {
            if (cancelled) return;
            setMesasItems(mesasData.tables || []);
          })
          .catch(() => {
            if (cancelled) return;
            setMesasItems([]);
          });
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

  // Real-time: extraído al hook useEventoSocket. Mantiene los callbacks en
  // refs para no reconectar el socket en cada render (antes el effect tenía
  // un eslint-disable de exhaustive-deps por esta razón). Conecta en paralelo
  // con el fetch HTTP — todos los callbacks tolerán prev=null si llegan antes.
  // Ludoteca state — al tope para que el badge "Ludoteca (N)" se actualice
  // en vivo via socket sin esperar a que el user abra esa tab.
  const [ludotecaItems, setLudotecaItems] = useState(null);
  // Mesas state — mismo patrón. Fetcheado por separado al GET del evento
  // (la lista de mesas asociadas no viene en `evento.ludoteca` porque son
  // documentos del modelo `Table` con `eventoId`). El badge Mesas (N) usa
  // este state.
  const [mesasItems, setMesasItems] = useState(null);

  useEventoSocket(id, {
    onLudotecaChanged: (payload) => {
      if (!payload) return;
      setLudotecaItems((prev) => {
        const list = prev || [];
        if (payload.action === "added" && payload.item) {
          if (list.some((it) => it._id === payload.item._id)) return list;
          return [...list, payload.item];
        }
        if (payload.action === "updated" && payload.item) {
          return list.map((it) =>
            it._id === payload.item._id ? payload.item : it,
          );
        }
        if (payload.action === "removed" && payload.itemId) {
          return list.filter((it) => it._id !== payload.itemId);
        }
        return list;
      });
    },
    onCountsChanged: (payload) => {
      if (!payload.counts) return;
      setEvento((prev) =>
        prev ? { ...prev, registrationCount: payload.counts } : prev,
      );
    },
    onReviewed: (payload) => {
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
        // cuando deja de estar confirmado. Contrato del server (ver
        // reloadRegPopulated + emitToEventoRoom en server/routes/eventos.js):
        //   - `payload.registration.user` SIEMPRE viene populated con
        //     { _id, username, displayName, avatar } cuando status==='confirmed'.
        //   - Si el server cambia ese contrato, hay que actualizar este
        //     handler y el de socket en EventoInscripciones.jsx.
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
    },
    onUpdated: (payload) => {
      if (!payload.evento) return;
      // El payload trae userRegistration:null porque el server no conoce al
      // caller del socket. mergeEventoUpdate preserva la inscripción del user
      // y la lista de confirmados del estado previo.
      setEvento((prev) =>
        prev ? mergeEventoUpdate(prev, payload.evento) : payload.evento,
      );
    },
    onMesaCreated: (payload) => {
      // El server emite `evento:mesa-created` con `{ eventoId, tableId }`.
      // No incluye el table populado, así que pedimos la lista entera (es
      // chica y poco frecuente). Dedupe por _id en handleAdded del child
      // cubre la race optimistic vs socket (ver feedback_optimistic_vs_socket).
      if (!payload?.tableId) return;
      axios
        .get(`/api/eventos/${id}/mesas`)
        .then(({ data }) => setMesasItems(data.tables || []))
        .catch(() => {});
    },
  });

  // Contrato de error en estos handlers (post B6+B7):
  //   - Errores del server SIEMPRE se muestran como toast global (addToast).
  //   - Los handlers que se llaman desde un caller que necesita saber del
  //     fail para no cerrar su UI (TicketStub form, EventoForm) re-lanzan
  //     el error después del toast — el caller atrapa y mantiene su UI.
  //   - Los handlers que no necesitan signal (cancel/reopen del host) NO
  //     re-lanzan. El toast es suficiente.
  // El state local `actionError` + `<p>` inline fueron eliminados — el toast
  // global lo reemplaza con auto-dismiss y centralización.
  async function handleInscribirse(comprobanteFile) {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    setInscribing(true);
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
      addToast({
        type: "error",
        title: "No pudimos enviar tu inscripción",
        message: err.response?.data?.message || "Reintentá en unos segundos.",
      });
      throw err;
    } finally {
      setInscribing(false);
    }
  }

  async function handleCancelRegistration() {
    setCancellingReg(true);
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
      addToast({
        type: "error",
        title: "No pudimos cancelar tu inscripción",
        message: err.response?.data?.message || "Reintentá en unos segundos.",
      });
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
    try {
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvento((prev) => mergeEventoUpdate(prev, data));
      setEditing(false);
    } catch (err) {
      addToast({
        type: "error",
        title: "No pudimos guardar los cambios",
        message: err.response?.data?.message || "Reintentá en unos segundos.",
      });
      throw err;
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCancelEvent() {
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
      addToast({
        type: "error",
        title: "No pudimos cancelar el evento",
        message: err.response?.data?.message || "Reintentá en unos segundos.",
      });
    }
  }

  async function handleShare() {
    // Web Share API es asíncrona y solo está disponible en contextos seguros
    // (https + permisos del navegador). Caemos al clipboard si no está
    // disponible o el user cancela.
    const url = `${window.location.origin}/eventos/${id}`;
    const shareData = {
      title: `${evento.title} – Turnocero`,
      text: evento.description
        ? evento.description.slice(0, 200)
        : `Sumate a este evento en Turnocero.`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      // AbortError = user canceló: no es error, no mostramos toast.
      if (err?.name === "AbortError") return;
    }
    // Fallback: copiar al clipboard.
    try {
      await navigator.clipboard.writeText(url);
      addToast({
        type: "error",
        title: "Link copiado",
        message: "Pegá el enlace del evento donde quieras compartirlo.",
      });
    } catch {
      addToast({
        type: "error",
        title: "No pudimos compartir",
        message: "Copiá el link manualmente desde la barra de direcciones.",
      });
    }
  }

  async function handleReopenEvent() {
    try {
      const fd = new FormData();
      fd.append("status", "open");
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvento((prev) => mergeEventoUpdate(prev, data, { status: "open" }));
    } catch (err) {
      addToast({
        type: "error",
        title: "No pudimos reabrir el evento",
        message: err.response?.data?.message || "Reintentá en unos segundos.",
      });
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

  // canActInEvento (mirror del helper server-side):
  //   - admin del sitio: sí
  //   - author del evento: sí
  //   - registrant con status='confirmed': sí
  //   - el resto (pending, rejected, stranger, guest): no
  // Habilita los botones "Agregar juego" en la ludoteca y "Crear mesa" en
  // mesas del evento. El server REVALIDA, así que esto es solo UX.
  // Computación inline (no useMemo) porque está después del early-return de
  // `loading`/`notFound` — hooks condicionales rompen la regla de React.
  const canActInEvento =
    !!user &&
    (user.isAdmin ||
      isHost ||
      evento?.userRegistration?.status === "confirmed");

  // Las tabs se muestran solo a usuarios autenticados — guests sólo ven el
  // detalle (vista actual). En edit mode (admin editando) las tabs se ocultan
  // para no distraer del form.
  const showTabs = !!user && !editing;
  const ludotecaCount = ludotecaItems?.length ?? 0;
  const mesasCount = mesasItems?.length ?? 0;

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

      <Modal
        isOpen={!!lightbox && !!evento.image?.url}
        onClose={() => setLightbox(false)}
        ariaLabel={`Imagen ampliada: ${evento.title}`}
        backdropClassName={styles.lightbox}
        className={styles.lightboxContent}
      >
        <button
          className={styles.lightboxClose}
          onClick={() => setLightbox(false)}
          type="button"
          aria-label="Cerrar imagen"
        >
          ✕
        </button>
        {evento.image?.url && (
          <img
            src={evento.image.url}
            alt={evento.title}
            className={styles.lightboxImg}
          />
        )}
      </Modal>

      <LoginPromptModal
        isOpen={showLoginPrompt}
        message="Iniciá sesión para inscribirte en este evento"
        onClose={() => setShowLoginPrompt(false)}
      />

      <div className={styles.headerRow}>
        <Link to="/eventos" className={styles.back}>
          <ArrowLeftIcon size={11} /> Volver a eventos
        </Link>
        {evento.status !== "draft" && evento.status !== "cancelled" && (
          <button
            type="button"
            onClick={handleShare}
            className={styles.shareBtn}
            aria-label="Compartir evento"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Compartir
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <main className={styles.main}>
          {showTabs && (
            <nav
              className={styles.tabs}
              role="tablist"
              aria-label="Secciones del evento"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "detalle"}
                className={`${styles.tab} ${activeTab === "detalle" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("detalle")}
              >
                Detalle
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ludoteca"}
                className={`${styles.tab} ${activeTab === "ludoteca" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("ludoteca")}
              >
                Ludoteca
                {ludotecaCount > 0 && (
                  <span className={styles.tabBadge}>{ludotecaCount}</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "mesas"}
                className={`${styles.tab} ${activeTab === "mesas" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("mesas")}
              >
                Mesas
                {mesasCount > 0 && (
                  <span className={styles.tabBadge}>{mesasCount}</span>
                )}
              </button>
            </nav>
          )}

          {/* Wrapper aislante: `.tabContentWrap` es sibling de `.tabs` y
              recibe el `animation: none !important` de la regla global —
              .tabContent adentro NO es sibling de .tabs, así que su slide
              corre sin interferencia. `key={activeTab}` fuerza remount en
              cada switch para re-disparar el keyframe. */}
          <div className={styles.tabContentWrap}>
            <div
              className={styles.tabContent}
              data-direction={tabDirection}
              key={activeTab}
            >
              {activeTab === "ludoteca" && !editing && (
                <EventoLudoteca
                  eventoId={id}
                  evento={evento}
                  items={ludotecaItems}
                  setItems={setLudotecaItems}
                  canAdd={canActInEvento}
                />
              )}

              {activeTab === "mesas" && !editing && (
                <EventoMesas
                  eventoId={id}
                  items={mesasItems}
                  setItems={setMesasItems}
                  canAdd={canActInEvento}
                />
              )}

          {(activeTab === "detalle" || editing) &&
            (editing ? (
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
                      <span
                        className={`${styles.metaValue} ${styles.metaTime}`}
                      >
                        {d.time} hs
                      </span>
                    )}
                  </div>
                  <div className={styles.metaCell}>
                    <span className={styles.metaLabel}>Dónde</span>
                    <span className={styles.metaValue}>
                      {(() => {
                        const t =
                          typeof evento.location === "string"
                            ? evento.location
                            : evento.location?.texto || "";
                        // En el detalle mostramos "calle, ciudad" — formato cómodo,
                        // sin ruido de provincia/país. Si el admin seteó displayName,
                        // se usa eso. La dirección completa queda accesible en el
                        // title (tooltip).
                        const display = getLocationDisplay(
                          evento.location,
                          "regular",
                        );
                        return (
                          <span title={t}>{display || "Por confirmar"}</span>
                        );
                      })()}
                      {(() => {
                        // formatDistanceKm devuelve null para distancias que
                        // redondean a 0m (evita "0 m" / "Aquí mismo" redundantes).
                        const d = formatDistanceKm(evento.distanceKm);
                        return d ? (
                          <span className={styles.distanceBadge}>· {d}</span>
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
            ))}
            </div>
          </div>
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
