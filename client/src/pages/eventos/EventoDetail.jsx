import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import LoginPromptModal from '../../components/shared/LoginPromptModal';
import Avatar from '../../components/shared/Avatar';
import { getUserDisplay } from '../../utils/userDisplay';
import { dateParts, formatFee } from '../../utils/eventoDate';
import TicketStub from './TicketStub';
import EventoForm from './EventoForm';
import { ArrowLeftIcon, ImageIcon } from './EventoIcons';
import styles from './EventoDetail.module.css';

const STATUS_EYEBROW = {
  open:      'Inscripciones abiertas',
  closed:    'Inscripciones cerradas',
  cancelled: 'Evento cancelado',
  draft:     'Borrador · no visible',
};

export default function EventoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id;

  const [evento, setEvento]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [inscribing, setInscribing] = useState(false);
  const [cancellingReg, setCancellingReg] = useState(false);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionError, setActionError] = useState('');

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
    return () => { cancelled = true; };
  }, [id]);

  async function handleInscribirse(comprobanteFile) {
    if (!user) { setShowLoginPrompt(true); return; }
    setInscribing(true);
    setActionError('');
    try {
      const fd = new FormData();
      if (comprobanteFile) fd.append('comprobante', comprobanteFile);
      const { data: userReg } = await axios.post(`/api/eventos/${id}/inscribirse`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEvento(prev => ({
        ...prev,
        userRegistration: userReg,
        registrationCount: {
          ...prev.registrationCount,
          total:   (prev.registrationCount?.total   || 0) + 1,
          pending: (prev.registrationCount?.pending || 0) + 1,
        },
      }));
    } catch (err) {
      const msg = err.response?.data?.message || 'No pudimos enviar tu inscripción.';
      setActionError(msg);
      throw err;
    } finally {
      setInscribing(false);
    }
  }

  async function handleCancelRegistration() {
    setCancellingReg(true);
    setActionError('');
    try {
      await axios.delete(`/api/eventos/${id}/inscribirse`);
      setEvento(prev => ({
        ...prev,
        userRegistration: null,
        registrationCount: {
          ...prev.registrationCount,
          total:   Math.max(0, (prev.registrationCount?.total   || 1) - 1),
          pending: Math.max(0, (prev.registrationCount?.pending || 1) - 1),
        },
      }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos cancelar tu inscripción.');
    } finally {
      setCancellingReg(false);
    }
  }

  async function handleSaveEdit(fd) {
    setSavingEdit(true);
    setActionError('');
    try {
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEvento(prev => ({ ...prev, ...data }));
      setEditing(false);
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos guardar los cambios.');
      throw err;
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCancelEvent() {
    setActionError('');
    try {
      const fd = new FormData();
      fd.append('status', 'cancelled');
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEvento(prev => ({ ...prev, ...data, status: 'cancelled' }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos cancelar el evento.');
    }
  }

  async function handleReopenEvent() {
    setActionError('');
    try {
      const fd = new FormData();
      fd.append('status', 'open');
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEvento(prev => ({ ...prev, ...data, status: 'open' }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos reabrir el evento.');
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonMeta} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <p className={styles.notFoundEyebrow}>◆ 404</p>
          <h1 className={styles.notFoundTitle}>Evento no encontrado</h1>
          <Link to="/eventos" className={styles.notFoundLink}>← Volver a eventos</Link>
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
        <meta name="description" content={evento.description?.slice(0, 160) || `Evento: ${evento.title}`} />
      </Helmet>

      {lightbox && evento.image?.url && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>✕</button>
          <img src={evento.image.url} alt={evento.title} className={styles.lightboxImg} />
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
                    <img src={evento.image.url} alt={evento.title} className={styles.heroImg} />
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
                  {STATUS_EYEBROW[evento.status] || ''}
                </div>
                <h1 className={styles.title}>{evento.title}</h1>
              </div>

              <div className={styles.metaStrip}>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Cuándo</span>
                  <span className={styles.metaValue}>
                    {d ? `${d.weekdayLong} ${d.day} ${d.monthLong}` : 'A confirmar'}
                  </span>
                  {d && <span className={`${styles.metaValue} ${styles.metaTime}`}>{d.time} hs</span>}
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Dónde</span>
                  <span className={styles.metaValue}>{evento.location || 'Por confirmar'}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Inscripción</span>
                  <span className={`${styles.metaValue} ${isFree ? styles.metaValueFree : ''}`}>
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
                      <div className={styles.hostCardLabel}>Host del evento</div>
                      <div className={styles.hostCardName}>{authorDisplay.name}</div>
                      {evento.author.username && (
                        <div className={styles.hostCardSub}>@{evento.author.username}</div>
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
                      ◆ Inscriptos confirmados · {evento.confirmedRegistrations.length}
                    </span>
                    <span className={styles.sectionRule} />
                  </div>
                  <div className={styles.participantsGrid}>
                    {evento.confirmedRegistrations.map(r => {
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
            onInscribirse={handleInscribirse}
            onCancelRegistration={handleCancelRegistration}
            onLoginRequest={() => setShowLoginPrompt(true)}
            onOpenInscripciones={isHost ? () => navigate(`/eventos/${id}/inscripciones`) : undefined}
            onEdit={isHost ? () => setEditing(true) : undefined}
            onCancelEvent={isHost && evento.status !== 'cancelled' ? handleCancelEvent : undefined}
            onReopen={isHost && evento.status === 'cancelled' ? handleReopenEvent : undefined}
          />
        </aside>
      </div>
    </div>
  );
}
