/* global React, ReactDOM, Icon, Avatar, Switcher, fmtDate, timeAgo */
/* global TweaksPanel, TweakSection, useTweaks */
const { useState, useMemo } = React;

// ─── Mock news ────────────────────────────────────────────────
const STORIES = [
  {
    _id: 'n1',
    category: 'EN VIVO',
    categoryKey: 'live',
    kicker: 'Comunidad',
    title: 'Wingspan Cup llegó a semifinales con récord de inscripciones',
    dek: 'Después de seis semanas de juego, ocho jugadores siguen en pie. Cami Rossi y Tomás Kibel se disputan el primer pase a la final el sábado.',
    body: 'Lo que empezó como un experimento de fin de semana terminó siendo el torneo más concurrido del año. 32 inscriptos para 16 cupos, lista de espera de 11, y un nivel de juego que sorprendió hasta a los organizadores.\n\nA partir del jueves arrancan las semifinales en formato de eliminación directa, transmitidas por el canal de la comunidad. La final del sábado promete: además del premio en efectivo, el ganador se lleva una caja premium de Stonemaier Games donada por un sponsor anónimo.\n\nLos cuatro semifinalistas se definen entre veteranos del juego y caras nuevas que pegaron el salto en esta edición.',
    byline: 'por Cami Rossi · 19 may',
    publishedAt: '2026-05-19T10:00:00',
    image: { caption: 'Cuartos de final · sala principal de Bar La Torre' },
    isLead: true,
    isFeatured: true,
    quote: {
      text: 'Nunca pensé que iba a llegar a semis. Honestamente sigo pensando que es un error administrativo.',
      author: 'Vale Pereyra',
      context: 'cuartofinalista',
    },
  },
  {
    _id: 'n2',
    category: 'EVENTO',
    categoryKey: 'event',
    kicker: 'Evento',
    title: 'Magic Local Games anuncia Commander Open en julio',
    dek: 'Cuatro rondas, formato relajado y pizza incluida. Inscripciones abren la semana que viene.',
    publishedAt: '2026-05-18T14:30:00',
    byline: 'por Equipo TC',
    image: { caption: 'Stand de Magic LG en la Expo Lúdica' },
  },
  {
    _id: 'n3',
    category: 'RESEÑA',
    categoryKey: 'review',
    kicker: 'Reseña',
    title: 'Sky Team: la mejor cooperativa de dos jugadores del año',
    dek: 'Dos personas, dos horas, cero excusas. La nueva apuesta de Le Scorpion Masqué redefine el género para parejas.',
    publishedAt: '2026-05-17T20:00:00',
    byline: 'por Tomás Kibel',
    image: { caption: 'Sky Team en Pelegrini' },
  },
  {
    _id: 'n4',
    category: 'COMUNIDAD',
    categoryKey: 'community',
    kicker: 'Hito',
    title: 'Lucía Duarte llega a 100 partidas registradas en BG Watch',
    dek: 'Casi un año desde que empezó a usar la integración, ya juega un promedio de 2 partidas por semana.',
    publishedAt: '2026-05-16T18:00:00',
    byline: 'por Comunidad TC',
    image: null,
  },
  {
    _id: 'n5',
    category: 'PRODUCTO',
    categoryKey: 'product',
    kicker: 'Producto',
    title: 'Llega la sección Compartidas v2 con polaroids y diario',
    dek: 'Las compartidas se ven distintas: fotos como polaroids, mesa enlazada como ticket-stub y diario editorial.',
    publishedAt: '2026-05-15T12:00:00',
    byline: 'por Equipo TC',
    image: { caption: 'Captura del nuevo feed' },
  },
];

const BRIEFS = [
  { id: 'b1', kicker: 'Mesas',   title: 'Nueva mesa de Ark Nova abierta para el viernes 23', meta: '4 lugares · La Plata',     date: '2026-05-19' },
  { id: 'b2', kicker: 'Liga',    title: 'Brass: Birmingham — fecha 8 reprogramada al domingo', meta: 'Reprogramación',       date: '2026-05-18' },
  { id: 'b3', kicker: 'Comunidad', title: 'Iri Maldonado se suma como host activo en La Plata', meta: 'Bienvenida',         date: '2026-05-18' },
  { id: 'b4', kicker: 'Producto',  title: 'BG Watch ahora muestra heatmap mensual de partidas', meta: 'Update menor',       date: '2026-05-17' },
  { id: 'b5', kicker: 'Comunidad', title: '12 nuevas inscripciones esta semana en la comunidad', meta: 'Crecimiento',       date: '2026-05-17' },
  { id: 'b6', kicker: 'Evento',   title: 'Demo de Heat el sábado en la Expo Lúdica',            meta: 'Stand Turnocero',    date: '2026-05-16' },
];

const SECTIONS = [
  { id: 'all',       label: 'Portada' },
  { id: 'community', label: 'Comunidad' },
  { id: 'review',    label: 'Reseñas' },
  { id: 'event',     label: 'Eventos' },
  { id: 'product',   label: 'Producto' },
];

// ─── List screen ─────────────────────────────────────────────
function ListScreen({ onOpen }) {
  const [tab, setTab] = useState('all');
  const lead = STORIES.find(s => s.isLead);
  const secondaries = STORIES.filter(s => !s.isLead);
  const today = new Date('2026-05-19');
  const dateStr = today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      {/* Masthead */}
      <div className="masthead">
        <div className="mastheadLeft">
          {dateStr}<br />
          <strong>Edición #142</strong>
        </div>
        <h1 className="mastheadTitle">El <em>Noticiero</em> de Turnocero</h1>
        <div className="mastheadRight">
          La comunidad<br />
          <strong>2026 ·</strong> juegos de mesa
        </div>
      </div>

      {/* Section tabs */}
      <div className="sectionTabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`sectionTab ${tab === s.id ? 'sectionTabActive' : ''}`}
            onClick={() => setTab(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="sectionTabSpacer" />
        <input className="searchInput sectionTabSearch" placeholder="Buscar nota…" style={{ width: 200 }} />
      </div>

      {/* Lead */}
      {lead && (
        <div className="lead">
          <div onClick={() => onOpen(lead._id)} style={{ cursor: 'pointer' }}>
            <div className="leadCategory">● {lead.category}</div>
            <h2 className="leadHeadline">{lead.title}</h2>
            <p className="leadDek">{lead.dek}</p>
            <div className="leadMeta">
              <Avatar user={{ initial: 'C', color: '#f5a623' }} size="xs" />
              <span><strong>Cami Rossi</strong> · {timeAgo(lead.publishedAt)}</span>
              <span>· lectura 4 min</span>
            </div>
          </div>
          <div className="leadImage">
            <div className="leadImageFallback">imagen del torneo</div>
            <div className="leadImageCaption">{lead.image.caption}</div>
          </div>
        </div>
      )}

      {/* Two-column grid: stories + briefs */}
      <div className="gridArea">
        <div className="storiesCol">
          <div className="colLabel">◆ Notas destacadas</div>
          <div className="storyGrid">
            {secondaries.slice(0, 4).map(s => (
              <article key={s._id} className="story" onClick={() => onOpen(s._id)}>
                <div className="storyImage">
                  <div className="storyImageFallback">{s.image?.caption || 'imagen'}</div>
                </div>
                <span className={`storyKicker ${s.categoryKey}`}>◆ {s.kicker}</span>
                <h3 className="storyHeadline">{s.title}</h3>
                <p className="storyDek">{s.dek}</p>
                <span className="storyByline">
                  <strong>{s.byline.replace('por ', '').split('·')[0].trim()}</strong>
                  <span>·</span>
                  <span>{timeAgo(s.publishedAt)}</span>
                </span>
              </article>
            ))}
          </div>

          {/* Breakout quote */}
          {lead?.quote && (
            <div className="breakout" style={{ marginTop: 28 }}>
              <p className="breakoutText">{lead.quote.text}</p>
              <div className="breakoutAttrib">
                — <strong>{lead.quote.author}</strong> · {lead.quote.context}
              </div>
            </div>
          )}
        </div>

        <aside className="briefsCol">
          <div className="colLabel">◆ Breves</div>
          {BRIEFS.map(b => (
            <div key={b.id} className="brief" onClick={() => onOpen('n2')}>
              <span className="briefKicker">{b.kicker}</span>
              <h4 className="briefHeadline">{b.title}</h4>
              <div className="briefMeta">
                <span>{b.meta}</span>
                <span>·</span>
                <span>{fmtDate(b.date, { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ─── Article detail ──────────────────────────────────────────
function ArticleScreen({ articleId, onBack, onOpen }) {
  const article = useMemo(() => STORIES.find(s => s._id === articleId) || STORIES[0], [articleId]);
  const related = STORIES.filter(s => s._id !== article._id).slice(0, 2);

  // Mock long body
  const body = article.body || `${article.dek}\n\nEsta es una nota completa con varios párrafos. La idea es que el cuerpo del artículo se lea como una pieza editorial larga, con tipografía Lora serif a 18px / 1.7 line-height, párrafos espaciados generosamente, y una drop cap al inicio para enmarcar la lectura como contenido pensado.\n\nA medida que el lector recorre el artículo, puede encontrar subtítulos, citas destacadas, e imágenes con epígrafe. La idea es respetar el modelo del periodismo impreso: jerarquía clara, tipografía cuidada, ritmo de lectura sostenido.\n\nCuando termina el cuerpo, ofrecemos lecturas relacionadas y la opción de compartir el artículo o volver al feed principal.`;

  return (
    <div className="page">
      <button className="backBtn" onClick={onBack}>
        <Icon.ArrowLeft size={11} /> Volver al noticiero
      </button>

      <article className="article">
        <div className="articleKicker">◆ {article.category} · {article.kicker}</div>
        <h1 className="articleHeadline">{article.title}</h1>
        <p className="articleDek">{article.dek}</p>

        <div className="articleByline">
          <Avatar user={{ initial: 'C', color: '#f5a623' }} size="md" />
          <div className="info">
            <span className="author">Por {article.byline?.replace('por ', '').split('·')[0].trim() || 'Equipo TC'}</span>
            <span className="meta">{fmtDate(article.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })} · lectura 4 min</span>
          </div>
          <div className="shareGroup">
            <button className="shareBtn" title="Compartir"><Icon.Share size={14}/></button>
            <button className="shareBtn" title="Copiar link"><Icon.Link size={14}/></button>
          </div>
        </div>

        {article.image && (
          <div className="articleHero">
            <div className="fallback">{article.image.caption}</div>
            <div className="articleHeroCaption">{article.image.caption}</div>
          </div>
        )}

        <div className="articleBody">
          {body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {article.quote && (
            <div className="breakout">
              <p className="breakoutText">{article.quote.text}</p>
              <div className="breakoutAttrib">
                — <strong>{article.quote.author}</strong> · {article.quote.context}
              </div>
            </div>
          )}

          <h2>¿Y ahora qué?</h2>
          <p>
            Las semifinales arrancan el jueves. La final del sábado se transmite por el canal de la comunidad, y los inscriptos
            del torneo tienen reservados los mejores lugares del bar. Para sumarse a la próxima edición, ya están abiertas las
            <a href="#"> inscripciones de la Liga de Otoño</a>.
          </p>

          <div className="articleSeparator">— ◆ —</div>

          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Si tenés información, fotos o resultados que sumar a la cobertura, escribinos por el chat de la comunidad o
            mandanos una nueva Compartida etiquetando el torneo.
          </p>
        </div>

        <div className="articleFooter">
          <div className="relatedHeading">◆ Seguí leyendo</div>
          <div className="relatedGrid">
            {related.map(r => (
              <div key={r._id} className="relatedCard" onClick={() => onOpen(r._id)}>
                <span className="relatedKicker">{r.kicker}</span>
                <h4 className="relatedTitle">{r.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

// ─── App shell ───────────────────────────────────────────────
function NoticiasApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "dropCapColor": "accent"
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('list');
  const [articleId, setArticleId] = useState(null);

  const open = (id) => { setArticleId(id); setScreen('article'); };
  const back = () => setScreen('list');

  const dropCapColor =
    t.dropCapColor === 'red'   ? 'var(--red)' :
    t.dropCapColor === 'gold'  ? 'var(--gold)' :
    t.dropCapColor === 'green' ? 'var(--green)' :
    'var(--accent-light)';

  return (
    <div className="app-root">
      <style>{`.articleBody > p:first-child::first-letter { color: ${dropCapColor}; }`}</style>

      <Switcher
        crumb="Noticias · Reimagined"
        tabs={[
          { id: 'list',    label: 'Portada' },
          { id: 'article', label: 'Artículo' },
        ]}
        active={screen}
        onTab={(id) => {
          if (id === 'article' && !articleId) setArticleId(STORIES[0]._id);
          setScreen(id);
        }}
        pill="v2 · editorial"
      />

      {screen === 'list'    && <ListScreen onOpen={open} />}
      {screen === 'article' && <ArticleScreen articleId={articleId} onBack={back} onOpen={open} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Tipografía" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Color de drop cap</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['accent','gold','red','green'].map(c => (
              <button key={c}
                onClick={() => setTweak('dropCapColor', c)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8,
                  background: t.dropCapColor === c ? 'var(--accent)' : 'transparent',
                  color: t.dropCapColor === c ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid ' + (t.dropCapColor === c ? 'var(--accent)' : 'var(--border)'),
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >{c}</button>
            ))}
          </div>
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<NoticiasApp />);
