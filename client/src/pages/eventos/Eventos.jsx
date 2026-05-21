import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import useLocalStorageState from '../../utils/useLocalStorageState';
import { groupByMonth, MESES_LARGO } from '../../utils/eventoDate';
import TimelineRow from './TimelineRow';
import PosterCard from './PosterCard';
import EventoSkeleton from './EventoSkeleton';
import EventoForm from './EventoForm';
import { GridIcon, ListIcon, PlusIcon } from './EventoIcons';
import styles from './Eventos.module.css';

const ALL_FILTERS = [
  { value: 'all',       label: 'Todos',      adminOnly: false },
  { value: 'open',      label: 'Abiertos',   adminOnly: false },
  { value: 'mine',      label: 'Mis inscr.', adminOnly: false, requiresAuth: true },
  { value: 'closed',    label: 'Cerrados',   adminOnly: false },
  { value: 'draft',     label: 'Borradores', adminOnly: true },
  { value: 'cancelled', label: 'Cancelados', adminOnly: true },
];

export default function Eventos() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const userId = user?._id;

  const [eventos, setEventos] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useLocalStorageState('turnocero_eventos_view', 'timeline');

  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  const load = useCallback(async (pageNum = 1, replace = true) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = { page: pageNum, limit: 12 };
      if (filter === 'open' || filter === 'closed' || filter === 'draft' || filter === 'cancelled') {
        params.status = filter;
      }
      const { data } = await axios.get('/api/eventos', { params });
      setEventos(prev => replace ? data.eventos : [...prev, ...data.eventos]);
      setTotalPages(data.pages);
      setPage(pageNum);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => { load(1, true); }, [load]);

  // Real-time: la lista recibe broadcasts del room eventos:list para mantener
  // counts/status/eventos nuevos al día sin recargar. Solo emite cuando el
  // usuario está autenticado (el room requiere auth).
  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'] });
    // Opt-in al room de broadcast. Emitir en `connect` cubre initial connect
    // y reconnects. El server tiene el handler registrado pre-await, sin race.
    socket.on('connect', () => socket.emit('join:eventos-list'));

    socket.on('evento:created', (payload) => {
      if (!payload?.evento) return;
      setEventos(prev => {
        if (prev.some(e => e._id === payload.evento._id)) return prev;
        return [payload.evento, ...prev];
      });
    });

    socket.on('evento:updated', (payload) => {
      if (!payload?.eventoId || !payload.evento) return;
      setEventos(prev => prev.map(e =>
        e._id === payload.eventoId ? { ...e, ...payload.evento } : e,
      ));
    });

    socket.on('evento:counts-changed', (payload) => {
      if (!payload?.eventoId || !payload.counts) return;
      setEventos(prev => prev.map(e =>
        e._id === payload.eventoId ? { ...e, registrationCount: payload.counts } : e,
      ));
    });

    socket.on('evento:deleted', (payload) => {
      if (!payload?.eventoId) return;
      setEventos(prev => prev.filter(e => e._id !== payload.eventoId));
    });

    return () => {
      socket.emit('leave:eventos-list');
      socket.disconnect();
    };
  }, [user]);

  // Client-side filter for "mine" (server doesn't support it).
  const visibleEventos = useMemo(() => {
    if (filter !== 'mine') return eventos;
    if (!user) return [];
    return eventos.filter(ev => {
      const isHost = ev.author?._id === userId;
      const hasReg = ev.userRegistration?.status &&
        ['pending', 'confirmed', 'rejected'].includes(ev.userRegistration.status);
      return isHost || hasReg;
    });
  }, [eventos, filter, user, userId]);

  const groups = useMemo(() => groupByMonth(visibleEventos), [visibleEventos]);
  const upcoming = useMemo(() => {
    const now = Date.now();
    return eventos.filter(e => e.status === 'open' && new Date(e.eventDate) > now).length;
  }, [eventos]);
  const monthNow = MESES_LARGO[new Date().getMonth()];
  const yearNow = new Date().getFullYear();

  const visibleFilters = useMemo(() => {
    return ALL_FILTERS.filter(f => (!f.adminOnly || isAdmin) && (!f.requiresAuth || !!user));
  }, [isAdmin, user]);

  function startCreating() {
    setCreating(true);
    setTimeout(() => {
      const node = formRef.current;
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 30);
  }

  async function handleCreate(fd) {
    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/eventos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEventos(prev => [data, ...prev]);
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  const now = Date.now();

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Eventos — Turnocero</title>
        <meta name="description" content="Eventos y torneos de la comunidad de juegos de mesa" />
      </Helmet>

      {/* Editorial hero */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>Agenda · {monthNow} {yearNow}</div>
          <h1 className={styles.heroTitle}>
            Eventos de la <em>comunidad</em>.
          </h1>
          <p className={styles.heroSub}>
            Torneos, encuentros y demos producidos por la comunidad de Turnocero.
            Reservá tu lugar o sumá tu evento.
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Próximos</span>
            <span className={`${styles.heroStatValue} ${styles.heroStatValueAccent}`}>{upcoming}</span>
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
        <div className={styles.chips}>
          {visibleFilters.map(f => (
            <button
              key={f.value}
              type="button"
              className={`${styles.chip} ${filter === f.value ? styles.chipActive : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.controlsRight}>
          <div className={styles.viewToggle} role="group" aria-label="Cambiar vista">
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'timeline' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('timeline')}
              aria-label="Vista timeline"
              aria-pressed={viewMode === 'timeline'}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'poster' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('poster')}
              aria-label="Vista posters"
              aria-pressed={viewMode === 'poster'}
            >
              <GridIcon />
            </button>
          </div>

          {isAdmin && !creating && (
            <button type="button" className={styles.newBtn} onClick={startCreating}>
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
        viewMode === 'poster' ? (
          <div className={styles.posterGrid}>
            {[0, 1, 2, 3, 4, 5].map(i => <EventoSkeleton key={i} variant="poster" />)}
          </div>
        ) : (
          <div className={styles.timeline}>
            {[0, 1, 2].map(i => <EventoSkeleton key={i} variant="timeline" />)}
          </div>
        )
      ) : visibleEventos.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>◆</span>
          <p className={styles.emptyText}>
            {filter === 'mine'
              ? 'No tenés inscripciones en eventos cargados.'
              : 'No hay eventos para esos filtros.'}
          </p>
          {filter === 'mine' && page < totalPages && (
            <button
              type="button"
              className={styles.emptyBtn}
              onClick={() => load(page + 1, false)}
              disabled={loadingMore}
            >
              {loadingMore ? 'Cargando…' : 'Cargar más eventos →'}
            </button>
          )}
        </div>
      ) : viewMode === 'poster' ? (
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
          {groups.map(g => (
            <section key={g.key} className={styles.monthSection}>
              <div className={styles.monthHeader}>
                <span className={styles.monthHeaderLabel}>Mes</span>
                <span className={styles.monthHeaderName}>{g.name}</span>
                <span className={styles.monthHeaderYear}>{g.year}</span>
                <span className={styles.monthHeaderRule} />
                <span className={styles.monthHeaderCount}>{g.events.length} eventos</span>
              </div>
              {g.events.map((ev, i) => (
                <TimelineRow
                  key={ev._id}
                  evento={ev}
                  index={i}
                  isHost={ev.author?._id === userId}
                  userRegistrationStatus={ev.userRegistration?.status || null}
                  now={now}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {!loading && page < totalPages && filter !== 'mine' && visibleEventos.length > 0 && (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={() => load(page + 1, false)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Cargando…' : 'Ver más eventos'}
          </button>
        </div>
      )}
    </div>
  );
}
