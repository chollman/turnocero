import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import {
  useEventoQuery,
  useEventoLudotecaQuery,
  useEventoMesasQuery,
  eventoKeys,
  inscribirseEvento,
  cancelarInscripcion,
  updateEvento,
} from "../../queries/eventos";
import useTickingNow from "../../utils/useTickingNow";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Modal from "../../components/shared/Modal";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, formatFee } from "../../utils/eventoDate";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import { getShortUrl } from "../../utils/shortlink";
import TicketStub from "./TicketStub";
import EventoForm from "./EventoForm";
import EventoLudoteca from "./EventoLudoteca";
import EventoMesas from "./EventoMesas";
import useEventoSocket from "./useEventoSocket";
import { ImageIcon } from "./EventoIcons";
import BackButton from "../../components/shared/BackButton";
import styles from "./EventoDetail.module.css";

const STATUS_EYEBROW_KEYS = {
  open: "detail.eyebrowOpen",
  closed: "detail.eyebrowClosed",
  cancelled: "detail.eyebrowCancelled",
  draft: "detail.eyebrowDraft",
};

// Tabs válidos. Defaults a 'detalle' (vista actual). El estado se sincroniza
// con `?tab=` para deep-link y back-button friendly.
const VALID_TABS = ["detalle", "ludoteca", "mesas"];

export default function EventoDetail() {
  const { t } = useTranslation("eventos");
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { setActiveEvento, addToast } = useNotifications();
  const brandName = useBrandName();
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

  const queryClient = useQueryClient();
  const [lightbox, setLightbox] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [inscribing, setInscribing] = useState(false);
  const [cancellingReg, setCancellingReg] = useState(false);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Ticker para que TicketStub refresque su countdown ("en X días").
  const now = useTickingNow();

  const { data: evento, isPending: loading, isError } = useEventoQuery(id);
  // El socket `evento:deleted` fuerza el estado not-found sin esperar un
  // refetch — `notFound` combina el error real de la query (404/otros) con
  // este flag local seteado por el handler onDeleted de abajo.
  const [forcedGone, setForcedGone] = useState(false);
  const notFound = isError || forcedGone;

  // Ludoteca: cache-only (mismo patrón que TableChat/notifications — ver
  // Fases 3/5/6). El server embebe `ludoteca` en el GET /eventos/:id, así
  // que no hay un GET propio que fetchear acá — se siembra desde
  // `evento.ludoteca` una sola vez por id y de ahí en más la mantienen al
  // día el socket + las mutaciones locales (ver shim `setLudotecaItems`).
  const { data: ludotecaItems } = useEventoLudotecaQuery(id);
  useEffect(() => {
    if (evento) {
      queryClient.setQueryData(eventoKeys.ludoteca(id), evento.ludoteca || []);
    }
    // Sembrar solo una vez que el evento de ESTE id llegó — no en cada
    // patch/refetch posterior (el socket ya lleva la cache desde acá).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!evento]);
  const setLudotecaItems = useCallback(
    (updater) =>
      queryClient.setQueryData(eventoKeys.ludoteca(id), (prev) =>
        typeof updater === "function" ? updater(prev ?? null) : updater,
      ),
    [queryClient, id],
  );

  // Mesas del evento — fetch real, separado del detail (el server no lo
  // embebe). Se dispara recién cuando `evento` resolvió, igual que el
  // fetch secuencial original.
  const { data: mesasItems } = useEventoMesasQuery(id, {
    enabled: !!evento,
  });
  const setMesasItems = useCallback(
    (updater) =>
      queryClient.setQueryData(eventoKeys.mesas(id), (prev) =>
        typeof updater === "function" ? updater(prev ?? null) : updater,
      ),
    [queryClient, id],
  );

  // Real-time: extraído al hook useEventoSocket. Mantiene los callbacks en
  // refs para no reconectar el socket en cada render (antes el effect tenía
  // un eslint-disable de exhaustive-deps por esta razón). Conecta en paralelo
  // con el fetch HTTP — todos los callbacks tolerán prev=null si llegan antes.
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
      queryClient.setQueryData(eventoKeys.detail(id), (prev) =>
        prev ? { ...prev, registrationCount: payload.counts } : prev,
      );
    },
    onReviewed: (payload) => {
      queryClient.setQueryData(eventoKeys.detail(id), (prev) => {
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
      queryClient.setQueryData(eventoKeys.detail(id), (prev) =>
        prev ? mergeEventoUpdate(prev, payload.evento) : payload.evento,
      );
    },
    onMesaCreated: (payload) => {
      // El server emite `evento:mesa-created` con `{ eventoId, tableId }`.
      // No incluye el table populado, así que refetcheamos la lista entera
      // (es chica y poco frecuente). Dedupe por _id en handleAdded del
      // child cubre la race optimistic vs socket (ver
      // feedback_optimistic_vs_socket).
      if (!payload?.tableId) return;
      queryClient.invalidateQueries({ queryKey: eventoKeys.mesas(id) });
    },
    onDeleted: () => {
      // Admin eliminó el evento mientras estábamos viéndolo — caemos al
      // estado not-found para que el render coincida con el GET 404 que
      // ahora vería un refresh. Las notificaciones persistentes
      // (`evento_cancelled` con `eventoDeleted: true`) ya avisan al user;
      // este handler solo cierra el UI obsoleto.
      setForcedGone(true);
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
      const { data: userReg } = await inscribirseEvento(id, fd);
      // Sólo actualizamos `userRegistration` localmente. Los counts los
      // refresca el broadcast `evento:counts-changed` que el server emite
      // antes de responder — si los tocamos optimistamente acá, doblamos:
      // el socket entrega el count autoritativo (+1) y el optimistic suma
      // 1 encima → +2.
      queryClient.setQueryData(eventoKeys.detail(id), (prev) => ({
        ...prev,
        userRegistration: userReg,
      }));
    } catch (err) {
      addToast({
        type: "error",
        title: t("detail.inscribirseErrorTitle"),
        message:
          err.response?.data?.message || t("detail.inscribirseErrorMessage"),
      });
      throw err;
    } finally {
      setInscribing(false);
    }
  }

  async function handleCancelRegistration() {
    setCancellingReg(true);
    try {
      await cancelarInscripcion(id);
      // Mismo patrón que handleInscribirse: el socket evento:counts-changed
      // ya viene con el count autoritativo, así que no tocamos counts acá.
      // Sólo limpiamos userRegistration.
      queryClient.setQueryData(eventoKeys.detail(id), (prev) => ({
        ...prev,
        userRegistration: null,
      }));
    } catch (err) {
      addToast({
        type: "error",
        title: t("detail.cancelRegErrorTitle"),
        message:
          err.response?.data?.message || t("detail.cancelRegErrorMessage"),
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
      const { data } = await updateEvento(id, fd);
      queryClient.setQueryData(eventoKeys.detail(id), (prev) =>
        mergeEventoUpdate(prev, data),
      );
      setEditing(false);
    } catch (err) {
      addToast({
        type: "error",
        title: t("detail.saveEditErrorTitle"),
        message:
          err.response?.data?.message || t("detail.saveEditErrorMessage"),
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
      const { data } = await updateEvento(id, fd);
      queryClient.setQueryData(eventoKeys.detail(id), (prev) =>
        mergeEventoUpdate(prev, data, { status: "cancelled" }),
      );
    } catch (err) {
      addToast({
        type: "error",
        title: t("detail.cancelEventErrorTitle"),
        message:
          err.response?.data?.message || t("detail.cancelEventErrorMessage"),
      });
    }
  }

  async function handleShare() {
    // Web Share API es asíncrona y solo está disponible en contextos seguros
    // (https + permisos del navegador). Caemos al clipboard si no está
    // disponible o el user cancela. Usamos el short link cuando resuelve; si no,
    // el deeplink largo (que siempre funciona).
    const longUrl = `${window.location.origin}/eventos/${id}`;
    const url =
      (await getShortUrl({
        type: "evento",
        ref: id,
        origin: window.location.origin,
      })) || longUrl;
    const shareData = {
      title: `${evento.title} – ${brandName}`,
      text: evento.description
        ? evento.description.slice(0, 200)
        : t("detail.shareText", { brand: brandName }),
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
        title: t("detail.shareLinkCopiedTitle"),
        message: t("detail.shareLinkCopiedMessage"),
      });
    } catch {
      addToast({
        type: "error",
        title: t("detail.shareErrorTitle"),
        message: t("detail.shareErrorMessage"),
      });
    }
  }

  async function handleReopenEvent() {
    try {
      const fd = new FormData();
      fd.append("status", "open");
      const { data } = await updateEvento(id, fd);
      queryClient.setQueryData(eventoKeys.detail(id), (prev) =>
        mergeEventoUpdate(prev, data, { status: "open" }),
      );
    } catch (err) {
      addToast({
        type: "error",
        title: t("detail.reopenEventErrorTitle"),
        message:
          err.response?.data?.message || t("detail.reopenEventErrorMessage"),
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
          <p className={styles.notFoundEyebrow}>
            <Meeple />
            404
          </p>
          <h1 className={styles.notFoundTitle}>
            {t("detail.notFoundTitle")}
          </h1>
          <Link to="/eventos" className={styles.notFoundLink}>
            {t("detail.notFoundLink")}
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

  // "Compartir tu experiencia" → crear una compartida vinculada a este evento.
  // Espejo del gating del server (routes/compartidas.js): author o inscripción
  // confirmed/pending (más amplio que canActInEvento, que es solo confirmed).
  const canCompartirExperiencia =
    !!user &&
    evento.status !== "draft" &&
    evento.status !== "cancelled" &&
    (isHost ||
      ["confirmed", "pending"].includes(evento?.userRegistration?.status));

  // Las tabs se muestran solo a usuarios autenticados — guests sólo ven el
  // detalle (vista actual). En edit mode (admin editando) las tabs se ocultan
  // para no distraer del form.
  const showTabs = !!user && !editing;
  const ludotecaCount = ludotecaItems?.length ?? 0;
  const mesasCount = mesasItems?.length ?? 0;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {t("detail.metaTitle", {
            title: evento.title,
            brand: brandName,
          })}
        </title>
        <meta
          name="description"
          content={
            evento.description?.slice(0, 160) ||
            t("detail.metaDescription", { title: evento.title })
          }
        />
      </Helmet>

      <Modal
        isOpen={!!lightbox && !!evento.image?.url}
        onClose={() => setLightbox(false)}
        ariaLabel={t("detail.lightboxAria", { title: evento.title })}
        backdropClassName={styles.lightbox}
        className={styles.lightboxContent}
      >
        <button
          className={styles.lightboxClose}
          onClick={() => setLightbox(false)}
          type="button"
          aria-label={t("detail.closeImage")}
        >
          ✕
        </button>
        {evento.image?.url && (
          <img
            src={evento.image.url}
            alt={evento.title}
            className={styles.lightboxImg}
            loading="lazy"
            decoding="async"
          />
        )}
      </Modal>

      <LoginPromptModal
        isOpen={showLoginPrompt}
        message={t("detail.loginPrompt")}
        onClose={() => setShowLoginPrompt(false)}
      />

      <div className={styles.headerRow}>
        <BackButton to="/eventos" flush>
          {t("detail.back")}
        </BackButton>
        {(evento.status !== "draft" && evento.status !== "cancelled") ||
        canCompartirExperiencia ? (
          <div className={styles.headerActions}>
            {canCompartirExperiencia && (
              <button
                type="button"
                onClick={() => navigate(`/compartidas?evento=${id}`)}
                className={styles.shareBtn}
                aria-label={t("detail.shareExperienceAria")}
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {t("detail.shareExperience")}
              </button>
            )}
            {evento.status !== "draft" && evento.status !== "cancelled" && (
              <button
                type="button"
                onClick={handleShare}
                className={styles.shareBtn}
                aria-label={t("detail.shareAria")}
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
                {t("detail.share")}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.layout}>
        <main className={styles.main}>
          {showTabs && (
            <nav
              className={styles.tabs}
              role="tablist"
              aria-label={t("detail.tabsAria")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "detalle"}
                className={`${styles.tab} ${activeTab === "detalle" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("detalle")}
              >
                {t("detail.tabDetalle")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ludoteca"}
                className={`${styles.tab} ${activeTab === "ludoteca" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("ludoteca")}
              >
                {t("detail.tabLudoteca")}
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
                {t("detail.tabMesas")}
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
                  eventDate={evento.eventDate}
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
                          aria-label={t("detail.viewLargeImage")}
                        >
                          <img
                            src={evento.image.url}
                            alt={evento.title}
                            className={styles.heroImg}
                            decoding="async"
                          />
                        </button>
                      ) : (
                        <div className={styles.heroFallback}>
                          <div className={styles.heroFallbackInner}>
                            <ImageIcon size={48} />
                            <span>
                              {t("detail.fallbackImage", {
                                title: evento.title,
                              })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.titleBlock}>
                      <div className={styles.eyebrow}>
                        {STATUS_EYEBROW_KEYS[evento.status]
                          ? t(STATUS_EYEBROW_KEYS[evento.status])
                          : ""}
                      </div>
                      <h1 className={styles.title}>{evento.title}</h1>
                    </div>

                    <div className={styles.metaStrip}>
                      <div className={styles.metaCell}>
                        <span className={styles.metaLabel}>
                          {t("detail.metaWhen")}
                        </span>
                        <span className={styles.metaValue}>
                          {d
                            ? `${d.weekdayLong} ${d.day} ${d.monthLong}`
                            : t("detail.metaWhenTbd")}
                        </span>
                        {d && (
                          <span
                            className={`${styles.metaValue} ${styles.metaTime}`}
                          >
                            {t("detail.metaTime", { time: d.time })}
                          </span>
                        )}
                      </div>
                      <div className={styles.metaCell}>
                        <span className={styles.metaLabel}>
                          {t("detail.metaWhere")}
                        </span>
                        <span className={styles.metaValue}>
                          {(() => {
                            const tt =
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
                              <span title={tt}>
                                {display || t("detail.metaWhereTbd")}
                              </span>
                            );
                          })()}
                          {(() => {
                            // formatDistanceKm devuelve null para distancias que
                            // redondean a 0m (evita "0 m" / "Aquí mismo" redundantes).
                            const d = formatDistanceKm(evento.distanceKm);
                            return d ? (
                              <span className={styles.distanceBadge}>
                                · {d}
                              </span>
                            ) : null;
                          })()}
                        </span>
                      </div>
                      <div className={styles.metaCell}>
                        <span className={styles.metaLabel}>
                          {t("detail.metaFee")}
                        </span>
                        <span
                          className={`${styles.metaValue} ${isFree ? styles.metaValueFree : ""}`}
                        >
                          {formatFee(evento.fee)}
                        </span>
                      </div>
                      <div className={styles.metaCell}>
                        <span className={styles.metaLabel}>
                          {t("detail.metaCupo")}
                        </span>
                        <span className={styles.metaValue}>
                          {hasMax
                            ? t("detail.cupoOf", {
                                active: activeCount,
                                max: evento.maxParticipants,
                              })
                            : t("detail.cupoInscriptos", {
                                active: activeCount,
                              })}
                        </span>
                      </div>
                    </div>

                    {evento.description && (
                      <section className={styles.section}>
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionLabel}>
                            <Meeple />
                            {t("detail.sectionDescription")}
                          </span>
                          <span className={styles.sectionRule} />
                        </div>
                        <p className={styles.body}>{evento.description}</p>
                      </section>
                    )}

                    {evento.conditions && (
                      <section className={styles.section}>
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionLabel}>
                            <Meeple />
                            {t("detail.sectionConditions")}
                          </span>
                          <span className={styles.sectionRule} />
                        </div>
                        <p className={styles.body}>{evento.conditions}</p>
                      </section>
                    )}

                    {evento.author && (
                      <section className={styles.section}>
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionLabel}>
                            <Meeple />
                            {t("detail.sectionOrganiza")}
                          </span>
                          <span className={styles.sectionRule} />
                        </div>
                        <div className={styles.hostCard}>
                          <Avatar user={evento.author} size="xl" />
                          <div className={styles.hostCardDetails}>
                            <div className={styles.hostCardLabel}>
                              {t("detail.hostLabel")}
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
                              {t("detail.viewProfile")}
                            </Link>
                          )}
                        </div>
                      </section>
                    )}

                    {evento.confirmedRegistrations?.length > 0 && (
                      <section className={styles.section}>
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionLabel}>
                            <Meeple />
                            {t("detail.confirmedTitle", {
                              count: evento.confirmedRegistrations.length,
                            })}
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
