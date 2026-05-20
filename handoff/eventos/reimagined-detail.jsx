/* global React, Icon, Avatar, MOCK_EVENTS, NOW, dateParts, countdown, formatFee, formatDateLong */
const { useState, useMemo } = React;

function DetailScreen({ eventId, onBack, onOpenInscripciones }) {
  const evento = useMemo(() => MOCK_EVENTS.find(e => e._id === eventId) || MOCK_EVENTS[0], [eventId]);
  const [showInscriptionForm, setShowInscriptionForm] = useState(false);
  const [hasComprobante, setHasComprobante] = useState(false);

  const d = dateParts(evento.eventDate);
  const cd = countdown(evento.eventDate, NOW.getTime());
  const isFree = !evento.fee;
  const hasMax = evento.maxParticipants && evento.maxParticipants > 0;
  const isFull = hasMax && evento.participants >= evento.maxParticipants;
  const fillPct = hasMax ? Math.min(100, (evento.participants / evento.maxParticipants) * 100) : 0;
  const pendingCount = evento.pendingRegs?.length || 0;
  const userReg = evento.userRegistration;
  const isPast = cd.tone === 'past';

  return (
    <div className="page">
      <button className="detailBack" onClick={onBack}>
        <Icon.ArrowLeft size={11} /> Volver a eventos
      </button>

      <div className="detailLayout">
        <div className="detailMain">
          {/* Hero image */}
          <div className="detailHero">
            {evento.image ? (
              <img src={evento.image} alt={evento.title} />
            ) : (
              <div className="detailHeroFallback">
                <div className="detailHeroFallbackInner">
                  <Icon.Image size={48} />
                  <span>imagen del evento · 16:9 · {evento.title}</span>
                </div>
              </div>
            )}
          </div>

          {/* Title block */}
          <div className="detailTitleBlock">
            <div className="detailEyebrow">
              {evento.status === 'open' && 'Inscripciones abiertas'}
              {evento.status === 'closed' && 'Inscripciones cerradas'}
              {evento.status === 'cancelled' && 'Evento cancelado'}
              {evento.status === 'draft' && 'Borrador · no visible'}
            </div>
            <h1 className="detailTitle">{evento.title}</h1>
          </div>

          {/* Meta strip */}
          <div className="detailMetaStrip">
            <div className="detailMetaCell">
              <span className="detailMetaLabel">Cuándo</span>
              <span className="detailMetaValue">{d.weekdayLong} {d.day} {d.monthLong}</span>
              <span className="detailMetaValue" style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{d.time} hs</span>
            </div>
            <div className="detailMetaCell">
              <span className="detailMetaLabel">Dónde</span>
              <span className="detailMetaValue">{evento.location || 'Por confirmar'}</span>
            </div>
            <div className="detailMetaCell">
              <span className="detailMetaLabel">Inscripción</span>
              <span className="detailMetaValue" style={{ color: isFree ? 'var(--green)' : 'var(--text-primary)' }}>
                {formatFee(evento.fee)}
              </span>
            </div>
            <div className="detailMetaCell">
              <span className="detailMetaLabel">Cupo</span>
              <span className="detailMetaValue">
                {hasMax ? `${evento.participants} de ${evento.maxParticipants}` : `${evento.participants} inscriptos`}
              </span>
            </div>
          </div>

          {/* Description */}
          {evento.description && (
            <section className="detailSection">
              <div className="detailSectionHead">
                <span className="detailSectionLabel">◆ Descripción</span>
                <span className="detailSectionRule" />
              </div>
              <p className="detailBody">{evento.description}</p>
            </section>
          )}

          {/* Conditions */}
          {evento.conditions && (
            <section className="detailSection">
              <div className="detailSectionHead">
                <span className="detailSectionLabel">◆ Condiciones</span>
                <span className="detailSectionRule" />
              </div>
              <p className="detailBody">{evento.conditions}</p>
            </section>
          )}

          {/* Host card */}
          <section className="detailSection">
            <div className="detailSectionHead">
              <span className="detailSectionLabel">◆ Organiza</span>
              <span className="detailSectionRule" />
            </div>
            <div className="hostCard">
              <Avatar user={{ initial: evento.hostInitial, color: evento.hostColor }} size="xl" square />
              <div className="hostCardDetails">
                <div className="hostCardLabel">Host del evento</div>
                <div className="hostCardName">{evento.hostName}</div>
                <div className="hostCardSub">{evento.hostSub || `@${evento.hostHandle || 'usuario'}`}</div>
              </div>
              <a href="#" onClick={e => e.preventDefault()} className="stubGhostBtn" style={{ width: 'auto', padding: '8px 14px' }}>
                Ver perfil
              </a>
            </div>
          </section>

          {/* Participants */}
          {evento.confirmedRegs?.length > 0 && (
            <section className="detailSection">
              <div className="detailSectionHead">
                <span className="detailSectionLabel">◆ Inscriptos confirmados · {evento.confirmedRegs.length}</span>
                <span className="detailSectionRule" />
              </div>
              <div className="participantsGrid">
                {evento.confirmedRegs.map((p, i) => (
                  <div key={i} className="participant">
                    <Avatar user={p} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ─── Ticket stub sidebar ───────────────────────── */}
        <aside>
          <div className="ticketStub">
            <div className="stubTop">
              <div className="stubLabel">◆ Marca la fecha</div>
              <div className="stubDateBlock">
                <span className="stubDay">{d.day}</span>
                <div className="stubDateRight">
                  <div className="stubMonth">{d.monthLong}</div>
                  <div className="stubWeekday">{d.weekdayLong} · {d.year}</div>
                </div>
              </div>
              <div className="stubTime">⏱ {d.time} hs (hora local)</div>
              {!isPast && evento.status === 'open' && (
                <div className={`stubCountdown ${cd.tone === 'urgent' ? 'urgent' : cd.tone === 'soon' ? 'soon' : ''}`}>
                  ● {cd.text}
                </div>
              )}
              {isPast && (
                <div className="stubCountdown" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  ● {cd.text}
                </div>
              )}
            </div>

            <div className="stubTear">
              <div className="stubDashes" />
            </div>

            <div className="stubBottom">
              <div className="stubRow">
                <span className="stubRowLabel">Inscripción</span>
                <span className={`stubRowValue ${isFree ? 'stubRowValueFree' : ''}`}>{formatFee(evento.fee)}</span>
              </div>
              <div className="stubRow">
                <span className="stubRowLabel">Cupo</span>
                <span className="stubRowValue">
                  {hasMax ? <>{evento.participants}<span style={{ color: 'var(--text-muted)' }}>/{evento.maxParticipants}</span></> : `${evento.participants} sin límite`}
                </span>
              </div>
              {hasMax && (
                <div className="stubCuposBar">
                  <div className={`stubCuposFill ${isFull ? 'full' : ''}`} style={{ width: `${fillPct}%` }} />
                </div>
              )}
              <div className="stubRow">
                <span className="stubRowLabel">Estado</span>
                <span className="stubRowValue stubRowValueAccent" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {evento.status === 'open' ? 'Abierto' :
                   evento.status === 'closed' ? 'Cerrado' :
                   evento.status === 'cancelled' ? 'Cancelado' :
                   'Borrador'}
                </span>
              </div>

              {/* CTA block */}
              <div className="stubCtaBlock">
                {evento.isHost ? (
                  <>
                    <button className="stubCta" onClick={onOpenInscripciones}>
                      Gestionar inscripciones {pendingCount > 0 && `· ${pendingCount} pendientes`}
                    </button>
                    <div className="stubAdminBlock">
                      <div className="stubAdminTitle">◆ Acciones de host</div>
                      <div className="stubAdminActions">
                        <button className="stubAdminBtn"><Icon.Edit size={11}/>&nbsp;Editar</button>
                        <button className="stubAdminBtn"><Icon.Trash size={11}/>&nbsp;Cancelar</button>
                      </div>
                    </div>
                  </>
                ) : userReg === 'confirmed' ? (
                  <div className="stubCtaState confirmed">
                    <Icon.Check size={20} />
                    <span className="stubCtaStateTitle">¡Inscripción confirmada!</span>
                    <span className="stubCtaStateSub">Tu lugar está reservado</span>
                  </div>
                ) : userReg === 'pending' ? (
                  <div className="stubCtaState pending">
                    <Icon.Clock size={20} />
                    <span className="stubCtaStateTitle">Pendiente de revisión</span>
                    <span className="stubCtaStateSub">El admin revisará tu comprobante</span>
                  </div>
                ) : userReg === 'rejected' ? (
                  <div className="stubCtaState rejected">
                    <Icon.X size={20} />
                    <span className="stubCtaStateTitle">Inscripción rechazada</span>
                    <span className="stubCtaStateSub">Contactá al organizador para más info</span>
                  </div>
                ) : evento.status === 'cancelled' ? (
                  <button className="stubGhostBtn" disabled>Evento cancelado</button>
                ) : evento.status === 'closed' ? (
                  <button className="stubGhostBtn" disabled>Inscripciones cerradas</button>
                ) : isFull ? (
                  <button className="stubGhostBtn" disabled>Sin cupo disponible</button>
                ) : showInscriptionForm ? (
                  <div className="inscriptionForm">
                    <div>
                      <div className="inscriptionFormLabel">◆ Condiciones</div>
                      <p className="inscriptionFormText">{evento.conditions || 'Sin condiciones especiales.'}</p>
                    </div>
                    {!isFree && evento.transferDetails && (
                      <div>
                        <div className="inscriptionFormLabel">◆ Datos de transferencia · {formatFee(evento.fee)}</div>
                        <div className="transferBox">{evento.transferDetails}</div>
                      </div>
                    )}
                    {!isFree && (
                      <div>
                        <div className="inscriptionFormLabel">◆ Comprobante *</div>
                        <div className="comprobanteDrop" onClick={() => setHasComprobante(true)}>
                          {hasComprobante ? (
                            <>
                              <Icon.Doc size={22} />
                              <span className="comprobanteDropText">comprobante-pago.pdf</span>
                              <span className="comprobanteDropSub">Click para cambiar</span>
                            </>
                          ) : (
                            <>
                              <Icon.Image size={22} />
                              <span className="comprobanteDropText">Arrastrá o hacé click</span>
                              <span className="comprobanteDropSub">JPG · PNG · PDF · 10MB máx</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="inscriptionActions">
                      <button className="stubGhostBtn" onClick={() => { setShowInscriptionForm(false); setHasComprobante(false); }}>
                        Cancelar
                      </button>
                      <button className="stubCta" disabled={!isFree && !hasComprobante}>
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="stubCta" onClick={() => setShowInscriptionForm(true)}>
                    Inscribirme {isFree ? '· Gratis' : `· ${formatFee(evento.fee)}`}
                  </button>
                )}

                {/* When confirmed, show transfer details for reference */}
                {userReg === 'confirmed' && evento.transferDetails && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 0' }}>
                      Ver datos de transferencia
                    </summary>
                    <div className="transferBox" style={{ marginTop: 8 }}>{evento.transferDetails}</div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.DetailScreen = DetailScreen;
