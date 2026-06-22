import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Fragment,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import useLocalStorageState from "../../utils/useLocalStorageState";
import useTickingNow from "../../utils/useTickingNow";
import { groupByMonth, getMonthsLong } from "../../utils/eventoDate";
import ListFilters from "../../components/shared/ListFilters";
import EmptyState from "../../components/shared/EmptyState";
import { ArtEvento, ArtSearch } from "../../components/shared/EmptyArt";
import { GhostRows } from "../../components/shared/EmptyGhosts";
import TimelineRow from "./TimelineRow";
import PosterCard from "./PosterCard";
import EventoSkeleton from "./EventoSkeleton";
import EventoForm from "./EventoForm";
import { GridIcon, ListIcon, PlusIcon, SearchIcon } from "./EventoIcons";
import styles from "./Eventos.module.css";

const ALL_FILTERS = [
  { value: "all", label: "Todos", adminOnly: false },
  { value: "open", label: "Abiertos", adminOnly: false },
  { value: "mine", label: "Mis inscr.", adminOnly: false, requiresAuth: true },
  { value: "closed", label: "Cerrados", adminOnly: false },
  { value: "draft", label: "Borradores", adminOnly: true },
  { value: "cancelled", label: "Cancelados", adminOnly: true },
];

// Radio máximo del slider de distancia (km). 0 = sin filtro.
const MAX_RADIUS_KM = 100;

export default function Eventos() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const brandName = useBrandName();
  const isAdmin = !!user?.isAdmin;
  const userId = user?._id;
  const hasDireccion = Boolean(user?.direccion?.lat && user?.direccion?.lng);

  const [eventos, setEventos] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Slider de radio. 0 = sin filtro (default). Solo se aplica si user tiene direccion.
  const [radiusKm, setRadiusKm] = useState(0);
  const debouncedRadius = useDebouncedValue(radiusKm, 300);
  // Búsqueda por título. Debounce 300ms para no saturar el endpoint en cada
  // tecla. El server escapa los metacharacters de regex.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  // Default 'open' — al entrar el usuario ve sólo los eventos abiertos a inscripción.
  // Persistimos en localStorage para que la elección sobreviva entre sesiones;
  // si el chip guardado deja de ser visible (admin degradado, logout), un effect
  // de abajo lo resetea a 'open'.
  const [filter, setFilter] = useLocalStorageState(
    "turnocero_eventos_filter",
    "open",
  );
  const [viewMode, setViewMode] = useLocalStorageState(
    "turnocero_eventos_view",
    "timeline",
  );

  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  // `now` se refresca cada 30s para que las countdowns ("en X días") y el
  // divisor "Hoy" se actualicen sin necesidad de re-renderizar manualmente.
  const now = useTickingNow();

  const load = useCallback(
    async (pageNum = 1, replace = true) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { page: pageNum, limit: 12 };
        if (
          filter === "open" ||
          filter === "closed" ||
          filter === "draft" ||
          filter === "cancelled"
        ) {
          params.status = filter;
        }
        if (hasDireccion && debouncedRadius > 0) {
          params.maxDistanceKm = debouncedRadius;
        }
        if (debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }
        const { data } = await axios.get(API.eventos.LIST, { params });
        setEventos((prev) =>
          replace ? data.eventos : [...prev, ...data.eventos],
        );
        setTotalPages(data.pages);
        setPage(pageNum);
      } catch (err) {
        // Mostramos toast solo en errores reales (no canceled / abort). Si el
        // fetch falla, antes el feed quedaba vacío sin feedback al user.
        if (err?.code !== "ERR_CANCELED") {
          addToast({
            type: "error",
            title: "No pudimos cargar los eventos",
            message: "Reintentá en unos segundos.",
          });
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, hasDireccion, debouncedRadius, debouncedSearch, addToast],
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  // Predicado que decide si un evento debe aparecer bajo el filter activo.
  // Lo usan los listeners de socket para no agregar eventos que no califican
  // (ej. un draft broadcasteado a un cliente con chip "Abiertos") y para sacar
  // los que dejaron de calificar tras un evento:updated. `filter` y `userId`
  // se capturan por closure — re-ejecutar el effect del socket cuando cambian
  // no es problema porque los listeners se re-registran con el filter nuevo.
  const matchesActiveFilter = useCallback(
    (ev) => {
      if (!ev) return false;
      if (filter === "all") return true;
      if (filter === "mine") {
        if (!user) return false;
        const isHost = ev.author?._id === userId;
        const hasReg =
          ev.userRegistration?.status &&
          ["pending", "confirmed", "rejected"].includes(
            ev.userRegistration.status,
          );
        return isHost || hasReg;
      }
      return ev.status === filter;
    },
    [filter, user, userId],
  );

  // Real-time: la lista recibe broadcasts del room eventos:list para mantener
  // counts/status/eventos nuevos al día sin recargar. Solo emite cuando el
  // usuario está autenticado (el room requiere auth).
  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    // Opt-in al room de broadcast. Emitir en `connect` cubre initial connect
    // y reconnects. El server tiene el handler registrado pre-await, sin race.
    socket.on("connect", () => socket.emit("join:eventos-list"));

    socket.on("evento:created", (payload) => {
      if (!payload?.evento) return;
      // Solo agregarlo si matchea el filter activo — un evento closed
      // broadcasteado no debería aparecer en la lista "Abiertos".
      if (!matchesActiveFilter(payload.evento)) return;
      setEventos((prev) => {
        if (prev.some((e) => e._id === payload.evento._id)) return prev;
        return [payload.evento, ...prev];
      });
    });

    socket.on("evento:updated", (payload) => {
      if (!payload?.eventoId || !payload.evento) return;
      const merged = { ...payload.evento };
      // Si el evento cambió de status y ya no matchea el filter activo,
      // sacarlo del array para mantener la vista consistente.
      const stillVisible = matchesActiveFilter(merged);
      setEventos((prev) => {
        if (!stillVisible)
          return prev.filter((e) => e._id !== payload.eventoId);
        const exists = prev.some((e) => e._id === payload.eventoId);
        if (exists) {
          return prev.map((e) =>
            e._id === payload.eventoId ? { ...e, ...payload.evento } : e,
          );
        }
        // Si pasó a estar visible recién (ej. draft → open), agregarlo.
        return [payload.evento, ...prev];
      });
    });

    socket.on("evento:counts-changed", (payload) => {
      if (!payload?.eventoId || !payload.counts) return;
      setEventos((prev) =>
        prev.map((e) =>
          e._id === payload.eventoId
            ? { ...e, registrationCount: payload.counts }
            : e,
        ),
      );
    });

    socket.on("evento:deleted", (payload) => {
      if (!payload?.eventoId) return;
      setEventos((prev) => prev.filter((e) => e._id !== payload.eventoId));
    });

    return () => {
      socket.emit("leave:eventos-list");
      socket.disconnect();
    };
    // matchesActiveFilter cambia cuando cambia el filter activo — re-registrar
    // los listeners con la closure nueva es el comportamiento deseado, sin
    // necesidad de mantener una ref.
  }, [user, matchesActiveFilter]);

  // Client-side filter for "mine" (server doesn't support it).
  // El server ordena por `createdAt` desc — ordenamos por `eventDate` ASC para
  // que la grilla de posters y la timeline coincidan (la timeline re-ordena
  // por mes internamente, así que esta sort es lo que arregla la vista cards).
  // Eventos sin eventDate van al final.
  const visibleEventos = useMemo(() => {
    const base =
      filter !== "mine"
        ? eventos
        : !user
          ? []
          : eventos.filter((ev) => {
              const isHost = ev.author?._id === userId;
              const hasReg =
                ev.userRegistration?.status &&
                ["pending", "confirmed", "rejected"].includes(
                  ev.userRegistration.status,
                );
              return isHost || hasReg;
            });
    return base.slice().sort((a, b) => {
      const ta = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
      const tb = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
      return ta - tb;
    });
  }, [eventos, filter, user, userId]);

  const groups = useMemo(() => groupByMonth(visibleEventos), [visibleEventos]);
  const upcoming = useMemo(() => {
    return eventos.filter(
      (e) => e.status === "open" && new Date(e.eventDate) > now,
    ).length;
  }, [eventos, now]);
  // Derivamos del ticker `now` (refrescado cada 30s) para que el hero
  // "Agenda · Mes Año" siga al cambio de mes si la pestaña queda abierta
  // cruzando medianoche del último día.
  const nowDate = new Date(now);
  const monthNow = getMonthsLong()[nowDate.getMonth()];
  const yearNow = nowDate.getFullYear();

  // Si el filtro persistido en localStorage ya no es visible para este usuario
  // (admin degradado a usuario regular, o usuario que cerró sesión y tenía
  // "mine" guardado), volver al default "open".
  useEffect(() => {
    const def = ALL_FILTERS.find((f) => f.value === filter);
    const visible =
      def && (!def.adminOnly || isAdmin) && (!def.requiresAuth || !!user);
    if (!visible) setFilter("open");
  }, [filter, isAdmin, user, setFilter]);

  function startCreating() {
    setCreating(true);
    setTimeout(() => {
      const node = formRef.current;
      if (node && typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 30);
  }

  async function handleCreate(fd) {
    setSubmitting(true);
    try {
      const { data } = await axios.post(API.eventos.LIST, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Si el evento recién creado coincide con el filtro activo, lo
      // prependeamos. Si no (p.ej. admin con filter='open' crea un draft),
      // cambiamos al filtro de su status para que el admin no "pierda" su
      // creación en una vista que no la incluye.
      const matchesFilter =
        filter === "all" || filter === "mine" || filter === data.status;
      if (matchesFilter) {
        // Dedup: el server emite `evento:created` por socket al actor también,
        // y la socket suele llegar ANTES que la response HTTP. Sin esta guarda
        // el evento aparecía duplicado (ver feedback_optimistic_vs_socket.md).
        setEventos((prev) => {
          if (prev.some((e) => e._id === data._id)) return prev;
          return [data, ...prev];
        });
      } else {
        setFilter(data.status);
      }
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Divisor "Hoy" entre el último pasado y el primer futuro — sólo en filtro
  // "Todos" y sólo cuando hay eventos a ambos lados de la línea temporal.
  const firstFutureId = useMemo(() => {
    if (filter !== "all") return null;
    const sorted = visibleEventos
      .filter((e) => e.eventDate)
      .slice()
      .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    const future = sorted.find((e) => new Date(e.eventDate).getTime() >= now);
    const hasPast = sorted.some((e) => new Date(e.eventDate).getTime() < now);
    return future && hasPast ? future._id : null;
    // `now` viene del state ticker (cada 30s); el dep array sigue omitiéndolo
    // a propósito porque un drift sub-segundo en el divisor es irrelevante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEventos, filter]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Eventos — ${brandName}`}</title>
        <meta
          name="description"
          content="Eventos y torneos de la comunidad de juegos de mesa"
        />
      </Helmet>

      {/* Editorial hero */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>
            Agenda · {monthNow} {yearNow}
          </div>
          <h1 className={styles.heroTitle}>
            Eventos de la <em>comunidad</em>.
          </h1>
          <p className={styles.heroSub}>
            Torneos, encuentros y demos producidos por la comunidad de{" "}
            {brandName}. Reservá tu lugar o sumá tu evento.
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Próximos</span>
            <span
              className={`${styles.heroStatValue} ${styles.heroStatValueAccent}`}
            >
              {upcoming}
            </span>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Total</span>
            <span className={styles.heroStatValue}>{eventos.length}</span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar eventos por nombre"
          />
        </div>

        <div className={styles.controlsRight}>
          <ListFilters
            chips={ALL_FILTERS}
            activeChip={filter}
            onChipChange={setFilter}
            defaultChip="open"
            isAdmin={isAdmin}
            isAuthenticated={!!user}
            showDistance={!!user}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            hasDireccion={hasDireccion}
            maxRadiusKm={MAX_RADIUS_KM}
          />

          <div
            className={styles.viewToggle}
            role="group"
            aria-label="Cambiar vista"
          >
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "timeline" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("timeline")}
              aria-label="Vista timeline"
              aria-pressed={viewMode === "timeline"}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "poster" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("poster")}
              aria-label="Vista posters"
              aria-pressed={viewMode === "poster"}
            >
              <GridIcon />
            </button>
          </div>

          {isAdmin && !creating && (
            <button
              type="button"
              className={styles.newBtn}
              onClick={startCreating}
            >
              <PlusIcon size={13} /> Nuevo evento
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {isAdmin && creating && (
        <div className={styles.formWrap} ref={formRef}>
          <EventoForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
            submitting={submitting}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        viewMode === "poster" ? (
          <div className={styles.posterGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <EventoSkeleton key={i} variant="poster" />
            ))}
          </div>
        ) : (
          <div className={styles.timeline}>
            {[0, 1, 2].map((i) => (
              <EventoSkeleton key={i} variant="timeline" />
            ))}
          </div>
        )
      ) : visibleEventos.length === 0 ? (
        filter === "mine" ? (
          <EmptyState
            variant="filtered"
            compact
            art={<ArtSearch />}
            eyebrow="Sin inscripciones"
            title={
              <>
                No tenés <em>inscripciones</em> todavía.
              </>
            }
            text="Cuando te anotes a un evento, lo vas a ver acá."
            secondary={
              page < totalPages
                ? {
                    label: loadingMore ? "Cargando…" : "Cargar más eventos",
                    icon: "compass",
                    onClick: () => load(page + 1, false),
                  }
                : {
                    label: "Ver todos los eventos",
                    icon: "compass",
                    onClick: () => setFilter("all"),
                  }
            }
          />
        ) : filter === "open" && !debouncedSearch.trim() ? (
          <EmptyState
            art={<ArtEvento />}
            ghost={<GhostRows />}
            eyebrow="Agenda despejada"
            title={
              <>
                Nada en la <em>agenda</em> todavía.
              </>
            }
            text="No hay eventos próximos. Si organizás torneos o encuentros, este es el lugar para convocarlos."
            primary={
              isAdmin
                ? { label: "Crear el primer evento", onClick: startCreating }
                : undefined
            }
            secondary={{
              label: "Ver cerrados",
              icon: "compass",
              onClick: () => setFilter("closed"),
            }}
          />
        ) : (
          <EmptyState
            variant="filtered"
            compact
            art={<ArtSearch />}
            eyebrow="Sin coincidencias"
            title={
              <>
                Ningún evento con <em>esos filtros.</em>
              </>
            }
            text="No encontramos eventos para esa combinación."
            secondary={{
              label: "Limpiar filtros",
              icon: "clear",
              onClick: () => {
                setSearch("");
                setFilter("open");
              },
            }}
          />
        )
      ) : viewMode === "poster" ? (
        <div className={styles.posterGrid}>
          {visibleEventos.map((ev, i) => (
            <PosterCard
              key={ev._id}
              evento={ev}
              index={i}
              isHost={ev.author?._id === userId}
              userRegistrationStatus={ev.userRegistration?.status || null}
              now={now}
            />
          ))}
        </div>
      ) : (
        <div className={styles.timeline}>
          {groups.map((g) => (
            <section key={g.key} className={styles.monthSection}>
              <div className={styles.monthHeader}>
                <span className={styles.monthHeaderLabel}>Mes</span>
                <span className={styles.monthHeaderName}>{g.name}</span>
                <span className={styles.monthHeaderYear}>{g.year}</span>
                <span className={styles.monthHeaderRule} />
                <span className={styles.monthHeaderCount}>
                  {g.events.length} eventos
                </span>
              </div>
              {g.events.map((ev, i) => (
                <Fragment key={ev._id}>
                  {ev._id === firstFutureId && (
                    <div
                      className={styles.nowDivider}
                      aria-label="A partir de hoy"
                    >
                      <span className={styles.nowDividerLabel}>
                        ● Hoy · próximos eventos
                      </span>
                      <span className={styles.nowDividerRule} />
                    </div>
                  )}
                  <TimelineRow
                    evento={ev}
                    index={i}
                    isHost={ev.author?._id === userId}
                    userRegistrationStatus={ev.userRegistration?.status || null}
                    now={now}
                  />
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      )}

      {!loading &&
        page < totalPages &&
        filter !== "mine" &&
        visibleEventos.length > 0 && (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={() => load(page + 1, false)}
              disabled={loadingMore}
            >
              {loadingMore ? "Cargando…" : "Ver más eventos"}
            </button>
          </div>
        )}

      {/* FAB — mobile only, admin only. Hidden while the create form is open. */}
      {isAdmin && !creating && (
        <button
          type="button"
          className={styles.fab}
          onClick={startCreating}
          aria-label="Nuevo evento"
        >
          <PlusIcon size={13} /> Nuevo evento
        </button>
      )}
    </div>
  );
}
