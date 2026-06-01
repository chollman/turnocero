import Meeple from "../../components/shared/Meeple";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./BgWatchHomeWidget.module.css";

const DISMISS_KEY = "turnocero_bgwatch_promo_dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Connected view — pixel-accurate to the handoff "BG Watch" inline widget:
 *   eyebrow (left/right) → title → 2-stat row → full-width CTA.
 *
 * Stats come from two parallel API calls, both relying on the server's
 * `data.total` (the count BGG returns after the `mindate` filter) so the
 * numbers stay exact no matter how many plays the user has:
 *   - `?mindate=YYYY-01-01` → year total + most-played game from page 1.
 *   - `?mindate=YYYY-MM-01` → month total.
 * "Más jugado" still reads from the page-1 plays of the year request, so
 * for very active users it reflects recent activity rather than the full
 * year (fetching every page just to rank games isn't worth the cost).
 */
function ConnectedView({ bggUsername }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const url = API.bgg.PARTIDAS(bggUsername);

    Promise.all([
      axios.get(url, { params: { page: 1, mindate: `${year}-01-01` } }),
      axios.get(url, { params: { page: 1, mindate: `${year}-${month}-01` } }),
    ])
      .then(([yearRes, monthRes]) => {
        if (cancelled) return;
        const yearPlays = yearRes.data?.plays || [];
        const totalYear =
          typeof yearRes.data?.total === "number"
            ? yearRes.data.total
            : yearPlays.length;
        const totalMonth =
          typeof monthRes.data?.total === "number"
            ? monthRes.data.total
            : (monthRes.data?.plays || []).reduce(
                (sum, p) => sum + (p.quantity || 1),
                0,
              );
        const tally = {};
        for (const p of yearPlays) {
          if (!p.gameId) continue;
          const qty = p.quantity || 1;
          if (!tally[p.gameId])
            tally[p.gameId] = {
              name: p.gameName || "Juego desconocido",
              count: 0,
            };
          tally[p.gameId].count += qty;
        }
        const mostPlayed = Object.values(tally).sort(
          (a, b) => b.count - a.count,
        )[0];
        setStats({ totalYear, thisMonth: totalMonth, mostPlayed });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bggUsername]);

  const totalYear = stats?.totalYear ?? 0;
  const headlineText = error
    ? "No se pudieron cargar tus partidas."
    : loading
      ? "Cargando tus partidas…"
      : totalYear === 0
        ? "¡Sumá tu primera partida del año! 🎲"
        : `${totalYear} ${totalYear === 1 ? "partida" : "partidas"} registrada${totalYear === 1 ? "" : "s"} este año 🎉`;

  return (
    <div className={styles.widgetConnected}>
      <div className={styles.widgetHead}>
        <span className={styles.connectedEyebrow}><Meeple />Tu BG Watch</span>
        <Link
          to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
          className={styles.widgetLink}
        >
          Ver historial →
        </Link>
      </div>

      <p className={styles.headline}>{headlineText}</p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Este mes</span>
          <span className={styles.statValue}>
            {loading || error ? "—" : stats.thisMonth}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Más jugado</span>
          <span
            className={`${styles.statValue} ${styles.statValueText}`}
            title={
              !loading && !error && stats.mostPlayed?.name
                ? stats.mostPlayed.name
                : undefined
            }
          >
            {loading || error ? "—" : stats.mostPlayed?.name || "—"}
          </span>
        </div>
      </div>

      <Link to="/bg-watch" className={styles.cta}>
        + Registrar partida
      </Link>
    </div>
  );
}

function PromoView({ onDismiss }) {
  return (
    <div className={`${styles.widget} ${styles.widgetPromo}`}>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="No volver a mostrar"
          title="No volver a mostrar"
        >
          ✕
        </button>
      )}
      <Link to="/bg-watch" className={styles.promoLink}>
        <div className={styles.header}>
          <span className={styles.eyebrow}><Meeple />BG WATCH</span>
        </div>
        <h3 className={styles.title}>¿Llevás tus partidas en BGG?</h3>
        <p className={styles.promoSub}>
          Conectá tu cuenta y registrá todo desde TurnoCero.
        </p>
        <span className={styles.promoCta}>Activá BG Watch →</span>
      </Link>
    </div>
  );
}

/**
 * BG Watch activity widget. Two variants:
 * - Connected (user has an active BG Watch connection): shows last 3 plays + link.
 * - Not connected: shows a promo card linking to /bg-watch.
 *
 * When `dismissible` is true, the promo variant gets a "✕" button that persists
 * the dismissal in localStorage. Subsequent renders skip the widget entirely
 * (until the user reconnects or clears storage). The connected variant is never
 * dismissible — once you have BG Watch, the activity feed is the point.
 */
export default function BgWatchHomeWidget({ user, dismissible = false }) {
  const [dismissed, setDismissed] = useState(
    () => dismissible && readDismissed(),
  );

  if (!user) return null;
  const hasBgWatch = user.bggUsername && user.bggConnected && !user.bggInvalid;
  if (hasBgWatch) {
    return <ConnectedView bggUsername={user.bggUsername} />;
  }
  if (dismissible && dismissed) return null;

  const onDismiss = dismissible
    ? () => {
        writeDismissed();
        setDismissed(true);
      }
    : undefined;

  return <PromoView onDismiss={onDismiss} />;
}
