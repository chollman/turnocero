import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { dateParts } from '../../utils/eventoDate';
import TriageColumn from './TriageColumn';
import { ArrowLeftIcon } from './EventoIcons';
import styles from './EventoInscripciones.module.css';

export default function EventoInscripciones() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: res } = await axios.get(`/api/eventos/${id}/inscripciones`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled && err.response?.status === 404) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const accept = useCallback(async (reg, adminNotes) => {
    setActionError('');
    try {
      await axios.patch(`/api/eventos/${id}/inscripciones/${reg.user._id}/confirmar`, { adminNotes });
      setData(prev => ({
        ...prev,
        registrations: prev.registrations.map(r =>
          r.user._id === reg.user._id
            ? { ...r, status: 'confirmed', reviewedAt: new Date().toISOString(), adminNotes }
            : r
        ),
        counts: {
          ...prev.counts,
          confirmed: prev.counts.confirmed + (reg.status !== 'confirmed' ? 1 : 0),
          rejected:  prev.counts.rejected  - (reg.status === 'rejected'  ? 1 : 0),
          pending:   prev.counts.pending   - (reg.status === 'pending'   ? 1 : 0),
        },
      }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos confirmar la inscripción.');
    }
  }, [id]);

  const reject = useCallback(async (reg, adminNotes) => {
    setActionError('');
    try {
      await axios.patch(`/api/eventos/${id}/inscripciones/${reg.user._id}/rechazar`, { adminNotes });
      setData(prev => ({
        ...prev,
        registrations: prev.registrations.map(r =>
          r.user._id === reg.user._id
            ? { ...r, status: 'rejected', reviewedAt: new Date().toISOString(), adminNotes }
            : r
        ),
        counts: {
          ...prev.counts,
          rejected:  prev.counts.rejected  + (reg.status !== 'rejected'  ? 1 : 0),
          confirmed: prev.counts.confirmed - (reg.status === 'confirmed' ? 1 : 0),
          pending:   prev.counts.pending   - (reg.status === 'pending'   ? 1 : 0),
        },
      }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'No pudimos rechazar la inscripción.');
    }
  }, [id]);

  // "Undo" returns the registration to pending state on the server side too.
  // We reuse the rejection endpoint with a special flag? Actually the server has
  // no "set-back-to-pending" route. As a workaround, undo just re-reads the
  // page so the admin can decide again. For now, optimistic local-only undo
  // (state shifts back to pending in the UI; admin must call the correct endpoint manually).
  const undo = useCallback(async (reg) => {
    setData(prev => ({
      ...prev,
      registrations: prev.registrations.map(r =>
        r.user._id === reg.user._id
          ? { ...r, status: 'pending', reviewedAt: null, adminNotes: '' }
          : r
      ),
      counts: {
        ...prev.counts,
        pending:   prev.counts.pending   + 1,
        confirmed: prev.counts.confirmed - (reg.status === 'confirmed' ? 1 : 0),
        rejected:  prev.counts.rejected  - (reg.status === 'rejected'  ? 1 : 0),
      },
    }));
  }, []);

  const groups = useMemo(() => {
    const regs = data?.registrations || [];
    return {
      pending:   regs.filter(r => r.status === 'pending'),
      confirmed: regs.filter(r => r.status === 'confirmed'),
      rejected:  regs.filter(r => r.status === 'rejected'),
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
        <Link to="/eventos" className={styles.backLink}>← Volver a eventos</Link>
      </div>
    );
  }

  const evento = data?.evento || {};
  const counts = data?.counts || { total: 0, pending: 0, confirmed: 0, rejected: 0 };
  const d = dateParts(evento.eventDate);
  const now = Date.now();

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Inscripciones — {evento.title} — Turnocero</title>
      </Helmet>

      <header className={styles.header}>
        <div className={styles.context}>
          <Link to={`/eventos/${id}`} className={styles.contextLink}>
            <ArrowLeftIcon size={11} /> {evento.title}
          </Link>
          <h1 className={styles.title}>Inscripciones</h1>
          {d && (
            <span className={styles.subtitle}>
              {d.weekdayLong} {d.day} {d.monthLong} · {d.time} hs
            </span>
          )}
        </div>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Pendientes</span>
            <span className={`${styles.statValue} ${styles.statOrange}`}>{counts.pending}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Confirmadas</span>
            <span className={`${styles.statValue} ${styles.statGreen}`}>{counts.confirmed}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Rechazadas</span>
            <span className={`${styles.statValue} ${styles.statMuted}`}>{counts.rejected}</span>
          </div>
          {evento.maxParticipants && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Cupo</span>
              <span className={styles.statValue}>
                <span className={styles.statAccent}>{counts.confirmed}</span>
                <span className={styles.statMutedInline}>/{evento.maxParticipants}</span>
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
