/* global React, ReactDOM, MesasListScreen, MesasDetailScreen, MesasCreateScreen, MESAS */
/* global TweaksPanel, TweakSection, TweakRadio, useTweaks */
const { useState } = React;

function MesasApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "viewMode": "grid"
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('list');     // 'list' | 'detail' | 'create' | 'edit'
  const [mesaId, setMesaId] = useState(null);

  const openDetail = (id) => { setMesaId(id); setScreen('detail'); };
  const openCreate = () => { setScreen('create'); };
  const openEdit   = () => { setScreen('edit'); };
  const goList     = () => { setScreen('list'); };

  // For edit demo: edit the first hosted mesa
  const hostedMesa = MESAS.find(m => m.userState === 'hosting');
  const editTarget = screen === 'edit' ? hostedMesa : null;

  return (
    <div className="app-root mesas-root">
      <div className="app-shell">
        <div className="switcher">
          <div className="switcherLogo">
            <span>◆</span>
            <span>turnocero</span>
          </div>
          <div className="switcherCrumb">Mesas · Reimagined</div>

          <div className="switcherTabs">
            <button
              className={`switcherTab ${screen === 'list' ? 'switcherTabActive' : ''}`}
              onClick={() => setScreen('list')}
            >
              Lista
            </button>
            <button
              className={`switcherTab ${screen === 'detail' ? 'switcherTabActive' : ''}`}
              onClick={() => { setMesaId(mesaId || MESAS[0]._id); setScreen('detail'); }}
            >
              Detalle
            </button>
            <button
              className={`switcherTab ${screen === 'create' ? 'switcherTabActive' : ''}`}
              onClick={() => setScreen('create')}
            >
              Crear
            </button>
            <button
              className={`switcherTab ${screen === 'edit' ? 'switcherTabActive' : ''}`}
              onClick={() => setScreen('edit')}
            >
              Editar
            </button>
          </div>

          <div className="switcherSpacer" />
          <span className="switcherPill">v2 · reimaginación</span>
        </div>

        {screen === 'list' && (
          <MesasListScreen
            onOpenDetail={openDetail}
            onOpenCreate={openCreate}
            viewMode={t.viewMode}
            setViewMode={(v) => setTweak('viewMode', v)}
          />
        )}
        {screen === 'detail' && (
          <MesasDetailScreen
            mesaId={mesaId}
            onBack={goList}
            onOpenCreate={openEdit}
          />
        )}
        {screen === 'create' && (
          <MesasCreateScreen
            editMode={false}
            onCancel={goList}
            onPublish={goList}
          />
        )}
        {screen === 'edit' && (
          <MesasCreateScreen
            editMode={true}
            mesaToEdit={editTarget}
            onCancel={goList}
            onPublish={() => openDetail(editTarget?._id)}
          />
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Lista" />
        <TweakRadio
          label="Vista"
          value={t.viewMode}
          onChange={(v) => setTweak('viewMode', v)}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'Lista' },
          ]}
        />
        <TweakSection label="Demo · Navegación" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
          <button onClick={() => setScreen('list')}   style={btnStyle(screen === 'list')}>Lista</button>
          <button onClick={() => { setMesaId(MESAS[0]._id); setScreen('detail'); }} style={btnStyle(screen === 'detail')}>Detalle</button>
          <button onClick={() => setScreen('create')} style={btnStyle(screen === 'create')}>Crear</button>
          <button onClick={() => setScreen('edit')}   style={btnStyle(screen === 'edit')}>Editar</button>
        </div>
        <TweakSection label="Mesa de detalle" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
          {MESAS.map(m => (
            <button
              key={m._id}
              onClick={() => { setMesaId(m._id); setScreen('detail'); }}
              style={{
                ...btnStyle(mesaId === m._id && screen === 'detail'),
                textAlign: 'left', padding: '7px 9px', fontSize: 10,
                fontFamily: 'var(--font-display)', letterSpacing: '-0.01em',
                textTransform: 'none',
              }}
            >
              <span style={{ opacity: 0.5, marginRight: 6 }}>
                {m.userState === 'hosting' ? '♛' : m.userState === 'joined' ? '✓' : m.userState === 'pending' ? '◔' : '◇'}
              </span>
              {m.game}
            </button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

function btnStyle(active) {
  return {
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
root.render(<MesasApp />);
