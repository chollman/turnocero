/* global React, Icon, Avatar, MOCK_EVENTS, NOW, dateParts */
const { useState, useMemo, useCallback } = React;

function formatRelative(s) {
  if (!s) return '—';
  const d = new Date(s);
  const diff = NOW.getTime() - d.getTime();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days} días`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function InscItem({ reg, status, onAccept, onReject, onUndo }) {
  return (
    <div className="inscItem">
      <div className="inscItemHead">
        <Avatar user={reg} size="lg" square />
        <div className="inscItemUser">
          <span className="inscItemName">{reg.name}</span>
          <span className="inscItemHandle">@{reg.handle}</span>
        </div>
        {status === 'pending' && (
          <span className="inscItemMeta" style={{ color: 'var(--orange)' }}>
            {formatRelative(reg.submittedAt)}
          </span>
        )}
        {status === 'rejected' && (
          <span className="inscItemMeta">{formatRelative(reg.reviewedAt)}</span>
        )}
      </div>

      {status === 'pending' && (
        <>
          <a href="#" onClick={e => e.preventDefault()} className="comprobanteCard">
            <div className="comprobanteThumb">
              {reg.comprobanteType === 'pdf' ? 'PDF' : <Icon.Image size={18} />}
            </div>
            <div className="comprobanteInfo">
              <div className="comprobanteName">
                {reg.comprobanteType === 'pdf' ? 'comprobante.pdf' : 'transferencia.jpg'}
              </div>
              <div className="comprobanteOpen">Abrir comprobante <Icon.External /></div>
            </div>
          </a>
          <div className="inscItemActions">
            <button className="inscBtnReject" onClick={onReject}>
              <Icon.X size={11}/>&nbsp;Rechazar
            </button>
            <button className="inscBtnAccept" onClick={onAccept}>
              <Icon.Check size={11}/>&nbsp;Confirmar
            </button>
          </div>
        </>
      )}

      {status === 'rejected' && (
        <>
          {reg.notes && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0, padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6, letterSpacing: '0.02em' }}>
              ✦ {reg.notes}
            </p>
          )}
          <button className="inscBtnUndo" onClick={onUndo}>↺ Revertir decisión</button>
        </>
      )}
    </div>
  );
}

function TriageColumn({ title, status, items, color, accept, reject, undo, emptyText }) {
  const colorClass = status === 'pending' ? 'triageColPending' : status === 'confirmed' ? 'triageColConfirmed' : 'triageColRejected';
  const labelClass = status === 'pending' ? 'triageColLabelOrange' : status === 'confirmed' ? 'triageColLabelGreen' : '';

  return (
    <div className={`triageCol ${colorClass}`}>
      <div className="triageColHead">
        <span className={`triageColLabel ${labelClass}`}>
          ◆ {title}
        </span>
        <span className="triageColCount">{items.length}</span>
      </div>
      <div className="triageBody">
        {items.length === 0 ? (
          <div className="triageEmpty">{emptyText}</div>
        ) : (
          items.map((reg, i) => (
            <InscItem
              key={`${reg.handle}-${i}`}
              reg={reg}
              status={status}
              onAccept={() => accept(reg)}
              onReject={() => reject(reg)}
              onUndo={() => undo(reg)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function InscripcionesScreen({ eventId, onBack }) {
  // Find event with the richest inscription data
  const baseEvento = useMemo(
    () => MOCK_EVENTS.find(e => e._id === eventId && e.pendingRegs) || MOCK_EVENTS.find(e => e.pendingRegs) || MOCK_EVENTS[0],
    [eventId]
  );

  const [pending, setPending] = useState(baseEvento.pendingRegs || []);
  const [confirmed, setConfirmed] = useState(
    (baseEvento.confirmedRegs || []).map(r => ({ ...r, handle: r.handle || r.name.toLowerCase().replace(/\s/g, '').replace('.', '') }))
  );
  const [rejected, setRejected] = useState(baseEvento.rejectedRegs || []);

  const accept = useCallback((reg) => {
    setPending(p => p.filter(x => x.handle !== reg.handle));
    setConfirmed(c => [...c, reg]);
  }, []);

  const reject = useCallback((reg) => {
    setPending(p => p.filter(x => x.handle !== reg.handle));
    setRejected(r => [...r, { ...reg, reviewedAt: new Date().toISOString(), notes: 'Rechazada desde la bandeja' }]);
  }, []);

  const undo = useCallback((reg) => {
    setRejected(r => r.filter(x => x.handle !== reg.handle));
    setPending(p => [...p, reg]);
  }, []);

  const d = dateParts(baseEvento.eventDate);

  return (
    <div className="page">
      <div className="inscHeader">
        <div className="inscEventContext">
          <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="inscEventLink">
            <Icon.ArrowLeft size={11} /> {baseEvento.title}
          </a>
          <h1 className="inscTitle">Inscripciones</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {d.weekdayLong} {d.day} {d.monthLong} · {d.time} hs
          </span>
        </div>

        <div className="inscStatRow">
          <div className="inscStat">
            <span className="inscStatLabel">Pendientes</span>
            <span className="inscStatValue inscStatValueOrange">{pending.length}</span>
          </div>
          <div className="inscStat">
            <span className="inscStatLabel">Confirmadas</span>
            <span className="inscStatValue inscStatValueGreen">{confirmed.length}</span>
          </div>
          <div className="inscStat">
            <span className="inscStatLabel">Rechazadas</span>
            <span className="inscStatValue" style={{ color: 'var(--text-muted)' }}>{rejected.length}</span>
          </div>
          {baseEvento.maxParticipants && (
            <div className="inscStat">
              <span className="inscStatLabel">Cupo</span>
              <span className="inscStatValue">
                <span style={{ color: 'var(--accent-light)' }}>{confirmed.length}</span>
                <span style={{ color: 'var(--text-muted)' }}>/{baseEvento.maxParticipants}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="triageCols">
        <TriageColumn
          title="Pendientes de revisión"
          status="pending"
          items={pending}
          accept={accept}
          reject={reject}
          undo={undo}
          emptyText="Nada por revisar 🎉"
        />
        <TriageColumn
          title="Confirmadas"
          status="confirmed"
          items={confirmed}
          accept={accept}
          reject={reject}
          undo={undo}
          emptyText="Sin inscripciones confirmadas"
        />
        <TriageColumn
          title="Rechazadas"
          status="rejected"
          items={rejected}
          accept={accept}
          reject={reject}
          undo={undo}
          emptyText="Sin rechazos"
        />
      </div>
    </div>
  );
}

window.InscripcionesScreen = InscripcionesScreen;
