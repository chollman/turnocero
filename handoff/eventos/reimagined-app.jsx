/* global React, ListScreen, DetailScreen, InscripcionesScreen, MOCK_EVENTS */
/* global TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakToggle, useTweaks */
const { useState } = React;

function ReimaginedApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "viewMode": "timeline"
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('list');     // 'list' | 'detail' | 'inscripciones'
  const [eventId, setEventId] = useState(null);

  const openDetail = (id) => { setEventId(id); setScreen('detail'); };
  const openInscripciones = (id) => { setEventId(id); setScreen('inscripciones'); };
  const goList = () => { setScreen('list'); };

  // Determine which event id to use for inscripciones (pick first hosted)
  const hostedId = MOCK_EVENTS.find(e => e.pendingRegs?.length)?._id || MOCK_EVENTS[0]._id;

  return (
    <div className="app-root">
      <div className="app-shell">
        {/* Prototype switcher */}
        <div className="switcher">
          <div className="switcherLogo">
            <span>◆</span>
            <span>turnocero</span>
          </div>
          <div className="switcherCrumb">Eventos · Reimagined</div>

          <div className="switcherTabs">
            <button
              className={`switcherTab ${screen === 'list' ? 'switcherTabActive' : ''}`}
              onClick={() => setScreen('list')}
            >
              Lista
            </button>
            <button
              className={`switcherTab ${screen === 'detail' ? 'switcherTabActive' : ''}`}
              onClick={() => { setEventId(eventId || MOCK_EVENTS[0]._id); setScreen('detail'); }}
            >
              Detalle
            </button>
            <button
              className={`switcherTab ${screen === 'inscripciones' ? 'switcherTabActive' : ''}`}
              onClick={() => { setEventId(hostedId); setScreen('inscripciones'); }}
            >
              Inscripciones (admin)
            </button>
          </div>

          <div className="switcherSpacer" />
          <span className="switcherPill">v2 · reimaginación</span>
        </div>

        {/* Active screen */}
        {screen === 'list' && (
          <ListScreen
            onOpenDetail={openDetail}
            viewMode={t.viewMode}
            setViewMode={(v) => setTweak('viewMode', v)}
          />
        )}
        {screen === 'detail' && (
          <DetailScreen
            eventId={eventId}
            onBack={goList}
            onOpenInscripciones={() => openInscripciones(eventId)}
          />
        )}
        {screen === 'inscripciones' && (
          <InscripcionesScreen eventId={eventId} onBack={() => openDetail(eventId)} />
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Lista" />
        <TweakRadio
          label="Vista"
          value={t.viewMode}
          onChange={(v) => setTweak('viewMode', v)}
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'poster',   label: 'Posters' },
          ]}
        />
        <TweakSection label="Demo · Navegación" />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            onClick={() => setScreen('list')}
            style={btnStyle(screen === 'list')}
          >Lista</button>
          <button
            onClick={() => { setEventId(MOCK_EVENTS[0]._id); setScreen('detail'); }}
            style={btnStyle(screen === 'detail')}
          >Detalle</button>
          <button
            onClick={() => { setEventId(hostedId); setScreen('inscripciones'); }}
            style={btnStyle(screen === 'inscripciones')}
          >Inscr.</button>
        </div>
      </TweaksPanel>
    </div>
  );
}

function btnStyle(active) {
  return {
    flex: 1,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
    padding: '6px 8px',
    borderRadius: 6,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<ReimaginedApp />);
