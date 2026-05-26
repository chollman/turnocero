/* global React, MesaIcon, MesaTile, MesaCardPreview, mesasDateParts */
const { useState, useMemo } = React;

// Hash a string to a seed (mimics the GameTile seed picking)
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 20;
}

const POPULAR_GAMES = [
  'Catan', 'Terraforming Mars', 'Wingspan', 'Gloomhaven', 'Brass: Birmingham',
  'Spirit Island', 'Root', 'Ark Nova', 'Carcassonne', '7 Wonders Duel',
  'Azul', 'Twilight Imperium', 'Scythe', 'Concordia', 'Dune: Imperium',
];

// ─── Create / Edit screen ─────────────────────────────────────
function MesasCreateScreen({ editMode, mesaToEdit, onCancel, onPublish }) {
  // Pre-fill from edit data if any
  const initial = mesaToEdit || {};
  const [game, setGame] = useState(initial.game || '');
  const [date, setDate] = useState(initial.date ? initial.date.slice(0, 10) : '2026-05-25');
  const [time, setTime] = useState(initial.date ? initial.date.slice(11, 16) : '20:00');
  const [location, setLocation] = useState(initial.location || '');
  const [maxPlayers, setMaxPlayers] = useState(initial.maxPlayers || 4);
  const [privacy, setPrivacy] = useState(initial.privacy || 'public');
  const [description, setDescription] = useState(initial.description || '');
  const [rules, setRules] = useState(initial.rules || '');
  const [tags, setTags] = useState(initial.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showGameSuggestions, setShowGameSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!game.trim()) return [];
    const q = game.toLowerCase();
    return POPULAR_GAMES.filter(g => g.toLowerCase().includes(q) && g.toLowerCase() !== q).slice(0, 5);
  }, [game]);

  // Step completion
  const stepDone = {
    juego: !!game.trim(),
    cuando: !!date && !!time,
    donde: !!location.trim(),
    detalles: maxPlayers && privacy,
  };
  const activeStep = !stepDone.juego ? 0 : !stepDone.cuando ? 1 : !stepDone.donde ? 2 : 3;

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim()) && tags.length < 5) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  // Build preview mesa
  const previewMesa = useMemo(() => {
    const fullDate = `${date}T${time}:00`;
    return {
      _id: 'preview',
      game: game || 'Tu juego',
      gameSeed: hashStr(game || 'preview'),
      date: fullDate,
      location: location || 'Por confirmar',
      maxPlayers: Number(maxPlayers),
      privacy,
      description,
      rules,
      tags,
      host: { name: 'Vos', handle: 'voslohaces', initial: 'V', color: '#1888ef' },
      players: [],
      userState: 'hosting',
    };
  }, [game, date, time, location, maxPlayers, privacy, description, rules, tags]);

  return (
    <div className="page">
      <button className="detailBack" onClick={onCancel}>
        <MesaIcon.ArrowLeft size={11} /> {editMode ? 'Cancelar edición' : 'Cancelar y volver'}
      </button>

      <div className="editorialHero" style={{ marginBottom: 28, paddingBottom: 22 }}>
        <div className="heroLeft">
          <div className="heroEyebrow">◆ {editMode ? 'Editar mesa' : 'Nueva mesa'} · paso a paso</div>
          <h1 className="heroTitle">
            {editMode ? <>Ajustá tu <em>convocatoria.</em></> : <>Armá la <em>convocatoria.</em></>}
          </h1>
          <p className="heroSub">
            {editMode
              ? 'Los cambios se notifican a quienes ya están unidos. La carta de la derecha se actualiza en vivo.'
              : 'Cuatro pasos cortos. La carta de la derecha se va armando con cada campo que completás.'}
          </p>
        </div>
        <div className="heroRight" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paso {activeStep + 1} de 4</span>
          <span className="heroStatValue heroStatValueAccent" style={{ fontSize: '1.4rem' }}>
            {Object.values(stepDone).filter(Boolean).length}/4 completos
          </span>
        </div>
      </div>

      <div className="createLayout">
        <div className="createForm">

          {/* Step indicator */}
          <div className="createSteps">
            {[
              { key: 'juego',    label: 'Juego' },
              { key: 'cuando',   label: 'Cuándo' },
              { key: 'donde',    label: 'Dónde' },
              { key: 'detalles', label: 'Detalles' },
            ].map((s, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <div key={s.key} className={`createStep ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  <div className="createStepDot">{done ? <MesaIcon.Check size={13}/> : i + 1}</div>
                  <span className="createStepLabel">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* ─ Step 1 · Juego ─ */}
          <div className="createSection">
            <div className="createSectionHead">
              <span className="createSectionLabel">◆ Paso 1</span>
              <span className="createSectionTitle">El juego</span>
            </div>
            <div className="createField" style={{ position: 'relative' }}>
              <label>Nombre del juego <span className="req">*</span></label>
              <input
                className="createInput"
                value={game}
                onChange={e => setGame(e.target.value)}
                onFocus={() => setShowGameSuggestions(true)}
                onBlur={() => setTimeout(() => setShowGameSuggestions(false), 150)}
                placeholder="Catán, Wingspan, Gloomhaven…"
              />
              <span className="createFieldHelp">El mosaico de la carta se genera automáticamente.</span>
              {showGameSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% - 14px)', left: 0, right: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                  borderRadius: 10, padding: 6, zIndex: 10,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                }}>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => { setGame(s); setShowGameSuggestions(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        color: 'var(--text-primary)',
                        padding: '8px 10px', borderRadius: 6,
                        fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: 'var(--accent-light)', marginRight: 6 }}>◆</span>{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="createField">
              <label>Tags (opcional)</label>
              <div className="tagEditor">
                {tags.map((t, i) => (
                  <span key={i} className="tagChip">
                    {t}
                    <button onClick={() => setTags(tags.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? "Estrategia, Familiar, 90min, Coop…" : ''}
                />
              </div>
              <span className="createFieldHelp">Hasta 5 tags. Enter para agregar.</span>
            </div>
          </div>

          {/* ─ Step 2 · Cuándo ─ */}
          <div className="createSection">
            <div className="createSectionHead">
              <span className="createSectionLabel">◆ Paso 2</span>
              <span className="createSectionTitle">Cuándo</span>
            </div>
            <div className="createFieldRow">
              <div className="createField">
                <label>Fecha <span className="req">*</span></label>
                <input
                  className="createInput" type="date"
                  value={date} onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="createField">
                <label>Hora <span className="req">*</span></label>
                <input
                  className="createInput" type="time"
                  value={time} onChange={e => setTime(e.target.value)}
                />
              </div>
            </div>
            <span className="createFieldHelp" style={{ marginTop: -10 }}>
              Recomendado: avisar con 24h+ de anticipación para llenar la mesa.
            </span>
          </div>

          {/* ─ Step 3 · Dónde ─ */}
          <div className="createSection">
            <div className="createSectionHead">
              <span className="createSectionLabel">◆ Paso 3</span>
              <span className="createSectionTitle">Dónde</span>
            </div>
            <div className="createField">
              <label>Lugar <span className="req">*</span></label>
              <input
                className="createInput"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Café Rivas · Palermo / Casa de Fede / Bar Notable…"
              />
              <span className="createFieldHelp">Lugar + barrio. La dirección exacta se comparte en el chat al confirmar.</span>
            </div>
          </div>

          {/* ─ Step 4 · Detalles ─ */}
          <div className="createSection">
            <div className="createSectionHead">
              <span className="createSectionLabel">◆ Paso 4</span>
              <span className="createSectionTitle">Detalles</span>
            </div>

            <div className="createField">
              <label>Jugadores totales (incluyéndote) <span className="req">*</span></label>
              <div className="pillGroup">
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pillBtn ${maxPlayers === n ? 'active' : ''}`}
                    onClick={() => setMaxPlayers(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="createFieldHelp">{maxPlayers - 1} {maxPlayers - 1 === 1 ? 'lugar libre' : 'lugares libres'} para convocar.</span>
            </div>

            <div className="createField">
              <label>Privacidad <span className="req">*</span></label>
              <div className="privacyOptions">
                <button
                  type="button"
                  className={`privacyCard ${privacy === 'public' ? 'active' : ''}`}
                  onClick={() => setPrivacy('public')}
                >
                  <MesaIcon.Globe size={20}/>
                  <div className="privacyCardBody">
                    <span className="privacyCardTitle">Pública</span>
                    <span className="privacyCardSub">Cualquiera puede unirse mientras haya lugar.</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`privacyCard ${privacy === 'private' ? 'active' : ''}`}
                  onClick={() => setPrivacy('private')}
                >
                  <MesaIcon.Lock size={20}/>
                  <div className="privacyCardBody">
                    <span className="privacyCardTitle">Privada</span>
                    <span className="privacyCardSub">Aprobás vos cada solicitud antes de confirmar lugar.</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="createField">
              <label>Descripción (opcional)</label>
              <textarea
                className="createTextarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="¿Qué tipo de partida es? ¿Apto principiantes? ¿Tono competitivo o relajado? Lo que ayude a saber si la mesa es para mí."
              />
            </div>

            <div className="createField">
              <label>Reglas de la mesa (opcional)</label>
              <textarea
                className="createTextarea"
                value={rules}
                onChange={e => setRules(e.target.value)}
                placeholder="Llegar 10 min antes. Cada uno trae algo para picar. Sin alianzas. Apagamos celulares."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="createFooter">
            <button className="btnDraft" onClick={onCancel}>
              {editMode ? 'Descartar cambios' : 'Cancelar'}
            </button>
            <div className="createFooterRight">
              {!editMode && <button className="btnDraft">Guardar borrador</button>}
              <button
                className="btnPublish"
                onClick={onPublish}
                disabled={!stepDone.juego || !stepDone.cuando || !stepDone.donde}
              >
                {editMode ? 'Guardar cambios' : 'Publicar mesa'} →
              </button>
            </div>
          </div>

          {/* Danger zone (edit mode only) */}
          {editMode && (
            <div className="dangerZone">
              <div className="dangerZoneLabel">◆ Zona delicada</div>
              <div className="dangerZoneTitle">Cancelar la mesa</div>
              <p className="dangerZoneSub">
                Esta acción no se puede deshacer. Los {(mesaToEdit?.players?.length || 0)} jugadores
                que ya se sumaron van a recibir una notificación con tu motivo.
              </p>
              <button className="dangerBtn">
                <MesaIcon.Trash size={11}/>&nbsp;Cancelar mesa
              </button>
            </div>
          )}
        </div>

        {/* ─── Live preview column ─── */}
        <aside className="previewWrap">
          <div className="previewLabel">◆ Tu carta · vista previa en vivo</div>
          <MesaCardPreview mesa={previewMesa} i={0} onOpen={() => {}} />
          <div className="previewNote">
            Así se ve tu mesa en el listado de la comunidad
          </div>
        </aside>
      </div>
    </div>
  );
}

window.MesasCreateScreen = MesasCreateScreen;
