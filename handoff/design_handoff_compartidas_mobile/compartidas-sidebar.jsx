/* global React, Icon, Avatar, Polaroid, USERS, UPCOMING_TABLES, TOP_GAMES, BGWATCH_USER, PULL_QUOTE, formatTableDate */

// ─── BG Watch widget ─────────────────────────────────────────
function BgWatchWidget() {
  return (
    <div className="widget bgwatchWidget">
      <div className="widgetHead">
        <span className="widgetEyebrow">◆ Tu BG Watch</span>
        <a href="#" className="widgetLink" onClick={(e) => e.preventDefault()}>
          Ver historial →
        </a>
      </div>
      <p className="bgwatchHeadline">100 partidas registradas este año 🎉</p>

      <div className="bgwatchStats">
        <div className="bgwatchStat">
          <span className="bgwatchStatLabel">Este mes</span>
          <span className="bgwatchStatValue">{BGWATCH_USER.thisMonth}</span>
        </div>
        <div className="bgwatchStat">
          <span className="bgwatchStatLabel">Más jugado</span>
          <span
            className="bgwatchStatValue"
            style={{ fontSize: "0.95rem", lineHeight: 1.3 }}
          >
            {BGWATCH_USER.topGame}
          </span>
        </div>
      </div>

      <a href="#" className="bgwatchCta" onClick={(e) => e.preventDefault()}>
        + Registrar partida
      </a>
    </div>
  );
}

// ─── Próximas mesas widget ───────────────────────────────────
function UpcomingTablesWidget() {
  return (
    <div className="widget">
      <div className="widgetHead">
        <span className="widgetEyebrow">◆ Tus próximas</span>
        <a href="#" className="widgetLink" onClick={(e) => e.preventDefault()}>
          Ver todas →
        </a>
      </div>
      <h3 className="widgetTitle">Próximas partidas</h3>

      <div className="mesaRowList">
        {UPCOMING_TABLES.map((t) => (
          <a
            key={t._id}
            href="#"
            className="mesaRow"
            onClick={(e) => e.preventDefault()}
          >
            <div className="mesaRowTile">{t.gameInitial}</div>
            <div className="mesaRowInfo">
              <div className="mesaRowGame">{t.game}</div>
              <div className="mesaRowMeta">{formatTableDate(t.date)}</div>
            </div>
            <span
              className={`mesaRowSeats ${t.status === "full" ? "full" : ""}`}
            >
              {t.status === "full" ? "Llena" : `${t.seats}L`}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Top juegos widget ───────────────────────────────────────
function TopGamesWidget() {
  const max = TOP_GAMES[0]?.count || 1;
  return (
    <div className="widget">
      <div className="widgetHead">
        <span className="widgetEyebrow">◆ Comunidad</span>
      </div>
      <h3 className="widgetTitle">Top juegos esta semana</h3>

      <div className="gameList">
        {TOP_GAMES.map((g, i) => (
          <div key={g.game} className="gameRow">
            <span className={`gameRank ${i === 0 ? "top" : ""}`}>{i + 1}</span>
            <div className="gameBarWrap">
              <div className="gameNameRow">
                <span className="gameName">{g.game}</span>
                <span className="gameCount">{g.count}p</span>
              </div>
              <div className="gameBar">
                <div
                  className="gameBarFill"
                  style={{ width: `${Math.round((g.count / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quote widget ────────────────────────────────────────────
function QuoteWidget() {
  return (
    <div className="widget quoteWidget">
      <span className="quoteMark">"</span>
      <div className="widgetHead">
        <span className="widgetEyebrow">◆ Frase de la semana</span>
      </div>
      <p className="quoteText">{PULL_QUOTE.text}</p>
      <div className="quoteAttribution">
        <Avatar user={PULL_QUOTE.author} size="xs" />
        <span>
          — <strong>{PULL_QUOTE.author.name}</strong> · {PULL_QUOTE.context}
        </span>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar() {
  return (
    <aside className="aside">
      <BgWatchWidget />
      <UpcomingTablesWidget />
      <TopGamesWidget />
      <QuoteWidget />
    </aside>
  );
}

window.Sidebar = Sidebar;
window.BgWatchWidget = BgWatchWidget;
window.UpcomingTablesWidget = UpcomingTablesWidget;
window.TopGamesWidget = TopGamesWidget;
window.QuoteWidget = QuoteWidget;
