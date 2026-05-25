/* global React, Icon, Avatar, MOCK_EVENTS, NOW, dateParts, countdown, formatFee, MESES_LARGO */
const { useState, useMemo } = React;

// ─── Filter chip definitions ──────────────────────────────────
const FILTERS = [
  { value: "all", label: "Todos", countFor: (e) => true },
  { value: "open", label: "Abiertos", countFor: (e) => e.status === "open" },
  {
    value: "mine",
    label: "Mis inscr.",
    countFor: (e) => !!e.userRegistration || e.isHost,
  },
  {
    value: "closed",
    label: "Cerrados",
    countFor: (e) => e.status === "closed",
  },
  {
    value: "draft",
    label: "Borradores",
    countFor: (e) => e.status === "draft",
  },
  {
    value: "cancelled",
    label: "Cancelados",
    countFor: (e) => e.status === "cancelled",
  },
];

// ─── Timeline row ──────────────────────────────────────────────
function TimelineRow({ evento, i, onOpen }) {
  const d = dateParts(evento.eventDate);
  const cd = countdown(evento.eventDate, NOW.getTime());
  const isFree = !evento.fee;
  const hasMax = evento.maxParticipants && evento.maxParticipants > 0;
  const isFull = hasMax && evento.participants >= evento.maxParticipants;
  const fillPct = hasMax
    ? Math.min(100, (evento.participants / evento.maxParticipants) * 100)
    : 0;
  const isPast =
    cd.tone === "past" ||
    evento.status === "cancelled" ||
    evento.status === "closed";
  const userReg = evento.userRegistration;

  const dotClass =
    evento.status === "cancelled"
      ? "tDotRed"
      : userReg === "confirmed"
        ? "tDotConfirmed"
        : isPast
          ? "tDotMuted"
          : "";

  // Status badge
  let statusBadge = null;
  if (evento.status === "cancelled")
    statusBadge = <span className="tStatus tStatusCancelled">Cancelado</span>;
  else if (evento.status === "draft")
    statusBadge = <span className="tStatus tStatusDraft">Borrador</span>;
  else if (evento.status === "closed")
    statusBadge = <span className="tStatus tStatusClosed">Cerrado</span>;
  else if (evento.status === "open")
    statusBadge = <span className="tStatus tStatusOpen">Abierto</span>;

  // CTA
  let cta;
  if (evento.isHost) {
    cta = (
      <button className="tCta tCtaGhost" onClick={onOpen}>
        Administrar →
      </button>
    );
  } else if (userReg === "confirmed") {
    cta = (
      <button className="tCta tCtaInscripto" onClick={onOpen}>
        <Icon.Check size={12} />
        &nbsp;Inscripto
      </button>
    );
  } else if (userReg === "pending") {
    cta = (
      <button className="tCta tCtaPending" onClick={onOpen}>
        Pago pendiente
      </button>
    );
  } else if (evento.status === "cancelled" || evento.status === "closed") {
    cta = (
      <button className="tCta tCtaGhost" onClick={onOpen}>
        Ver detalle
      </button>
    );
  } else if (isFull) {
    cta = (
      <button className="tCta tCtaDisabled" disabled>
        Sin cupo
      </button>
    );
  } else {
    cta = (
      <button className="tCta" onClick={onOpen}>
        Inscribirme
      </button>
    );
  }

  return (
    <div className="tRow" style={{ "--i": i }}>
      <div className="tDate">
        <span className="tDateWeekday">{d.weekday}</span>
        <span className="tDateDay">{d.day}</span>
        <span className="tDateTime">{d.time}</span>
      </div>
      <div className={`tDot ${dotClass}`} />

      <div className="tContent">
        <div className="tBadges">
          {statusBadge}
          {evento.isHost && (
            <span className="tStatus tStatusHost">Sos host</span>
          )}
          {userReg === "confirmed" && (
            <span className="tStatus tStatusInscripto">Inscripto</span>
          )}
          {userReg === "pending" && (
            <span className="tStatus tStatusDraft">Pendiente</span>
          )}
          {!isPast && evento.status === "open" && (
            <span
              className={`tCountdown ${cd.tone === "urgent" ? "tCountdownUrgent" : cd.tone === "soon" ? "tCountdownSoon" : ""}`}
            >
              {cd.text}
            </span>
          )}
        </div>

        <h3
          className={`tRowTitle ${evento.status === "cancelled" ? "tRowTitleCancelled" : ""}`}
        >
          {evento.title}
        </h3>

        <div className="tMeta">
          {evento.location && (
            <span className="tMetaItem">
              <Icon.Pin size={12} /> {evento.location}
            </span>
          )}
          <span className="tMetaItem">
            <Icon.Users size={12} />
            {hasMax
              ? `${evento.participants}/${evento.maxParticipants} inscriptos`
              : `${evento.participants} inscriptos`}
          </span>
        </div>

        {evento.description && (
          <p className="tDescription">{evento.description}</p>
        )}

        <div className="tHostLine">
          <Avatar
            user={{ initial: evento.hostInitial, color: evento.hostColor }}
          />
          <span>
            Organiza <span className="tHostName">{evento.hostName}</span>
          </span>
        </div>
      </div>

      <div className="tRight">
        <div className="tFee">
          <span className="tFeeLabel">Inscripción</span>
          <span className={`tFeeValue ${isFree ? "tFeeValueFree" : ""}`}>
            {formatFee(evento.fee)}
          </span>
        </div>
        {hasMax && (
          <div className="tCupos">
            <div className="tCuposBar">
              <div
                className={`tCuposFill ${isFull ? "tCuposFillFull" : ""}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className="tCuposText">
              {evento.participants}/{evento.maxParticipants} cupos
            </span>
          </div>
        )}
        {cta}
      </div>
    </div>
  );
}

// ─── Poster card ──────────────────────────────────────────────
function PosterCard({ evento, i, onOpen }) {
  const d = dateParts(evento.eventDate);
  const isFree = !evento.fee;
  const cd = countdown(evento.eventDate, NOW.getTime());

  let statusBadge = null;
  if (evento.status === "open")
    statusBadge = <span className="tStatus tStatusOpen">Abierto</span>;
  else if (evento.status === "closed")
    statusBadge = <span className="tStatus tStatusClosed">Cerrado</span>;
  else if (evento.status === "cancelled")
    statusBadge = <span className="tStatus tStatusCancelled">Cancelado</span>;

  return (
    <a
      className="poster"
      style={{ "--i": i }}
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
      href="#"
    >
      {evento.image ? (
        <img className="posterImage" src={evento.image} alt={evento.title} />
      ) : (
        <div className="posterFallback">
          <div className="posterFallbackInner">
            <Icon.Image size={32} />
            <span>imagen del evento</span>
          </div>
        </div>
      )}
      <div className="posterOverlay" />

      <div className="posterDate">
        <span className="posterDateDay">{d.day}</span>
        <span className="posterDateMonth">
          {d.month} · {d.time}
        </span>
      </div>

      <div className="posterStatus">{statusBadge}</div>

      {evento.status === "draft" && (
        <div className="posterDraftWatermark">
          <span>Borrador</span>
        </div>
      )}

      <div className="posterBody">
        <h3 className="posterTitle">{evento.title}</h3>
        <div className="posterMeta">
          {evento.location && (
            <span>
              <Icon.Pin size={11} /> {evento.location}
            </span>
          )}
          <span>
            <Icon.Users size={11} /> {evento.participants}
            {evento.maxParticipants ? `/${evento.maxParticipants}` : ""}
          </span>
        </div>
        <div className="posterBottom">
          <span className={`posterFee ${isFree ? "posterFeeFree" : ""}`}>
            {formatFee(evento.fee)}
          </span>
          <span className="posterCta">
            {evento.userRegistration === "confirmed"
              ? "Inscripto"
              : evento.userRegistration === "pending"
                ? "Pendiente"
                : evento.isHost
                  ? "Administrar"
                  : "Inscribirme"}{" "}
            <Icon.Arrow size={11} />
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── Group by month ───────────────────────────────────────────
function groupByMonth(events) {
  const groups = new Map();
  for (const ev of events) {
    const d = dateParts(ev.eventDate);
    if (!d) continue;
    const key = d.monthKey;
    if (!groups.has(key))
      groups.set(key, { key, name: d.monthLong, year: d.year, events: [] });
    groups.get(key).events.push(ev);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({
      ...g,
      events: g.events.sort(
        (a, b) => new Date(a.eventDate) - new Date(b.eventDate),
      ),
    }));
}

// ─── ListScreen (main) ────────────────────────────────────────
function ListScreen({ onOpenDetail, viewMode, setViewMode }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = MOCK_EVENTS;
    const f = FILTERS.find((x) => x.value === filter);
    if (f && filter !== "all") list = list.filter(f.countFor);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location || "").toLowerCase().includes(q) ||
          e.hostName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const upcoming = MOCK_EVENTS.filter(
    (e) => e.status === "open" && new Date(e.eventDate) > NOW,
  ).length;
  const monthNow = MESES_LARGO[NOW.getMonth()];

  return (
    <div className="page">
      {/* Editorial hero */}
      <div className="editorialHero">
        <div className="heroLeft">
          <div className="heroEyebrow">
            Agenda · {monthNow} {NOW.getFullYear()}
          </div>
          <h1 className="heroTitle">
            Eventos de la <em>comunidad.</em>
          </h1>
          <p className="heroSub">
            Torneos, encuentros y demos producidos por la comunidad de
            Turnocero. Reservá tu lugar, sumá tu evento, o simplemente revisá
            qué se viene esta semana.
          </p>
        </div>
        <div className="heroRight">
          <div className="heroStat">
            <span className="heroStatLabel">Próximos</span>
            <span className="heroStatValue heroStatValueAccent">
              {upcoming}
            </span>
          </div>
          <div className="heroDivider" />
          <div className="heroStat">
            <span className="heroStatLabel">Total</span>
            <span className="heroStatValue">{MOCK_EVENTS.length}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <div className="filterChips">
          {FILTERS.map((f) => {
            const n = MOCK_EVENTS.filter(f.countFor).length;
            return (
              <button
                key={f.value}
                className={`chip ${filter === f.value ? "chipActive" : ""}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}{" "}
                <span style={{ opacity: 0.6, marginLeft: 2 }}>· {n}</span>
              </button>
            );
          })}
        </div>

        <div className="controlsRight">
          <input
            type="text"
            className="search"
            placeholder="Buscar evento, lugar o host…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="viewToggle">
            <button
              className={`viewBtn ${viewMode === "timeline" ? "viewBtnActive" : ""}`}
              onClick={() => setViewMode("timeline")}
              title="Timeline"
            >
              <Icon.List />
            </button>
            <button
              className={`viewBtn ${viewMode === "poster" ? "viewBtnActive" : ""}`}
              onClick={() => setViewMode("poster")}
              title="Posters"
            >
              <Icon.Grid />
            </button>
          </div>
          <button className="newBtn">
            <Icon.Plus size={13} /> Nuevo evento
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "var(--text-muted)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Sin eventos para esos filtros
          </p>
        </div>
      ) : viewMode === "poster" ? (
        <div className="posterGrid">
          {filtered.map((ev, i) => (
            <PosterCard
              key={ev._id}
              evento={ev}
              i={i}
              onOpen={() => onOpenDetail(ev._id)}
            />
          ))}
        </div>
      ) : (
        <div className="timeline">
          {groups.map((g) => (
            <React.Fragment key={g.key}>
              <div className="monthHeader">
                <span className="monthHeaderLabel">Mes</span>
                <span className="monthHeaderName">{g.name}</span>
                <span className="monthHeaderYear">{g.year}</span>
                <span className="monthHeaderRule" />
                <span className="monthHeaderCount">
                  {g.events.length} eventos
                </span>
              </div>
              {g.events.map((ev, i) => (
                <TimelineRow
                  key={ev._id}
                  evento={ev}
                  i={i}
                  onOpen={() => onOpenDetail(ev._id)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

window.ListScreen = ListScreen;
