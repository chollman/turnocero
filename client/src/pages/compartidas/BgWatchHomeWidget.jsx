import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBgWatchHomeStatsQuery } from "../../queries/bgg";
import { useBrandName } from "../../hooks/useBrandName";
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
  const { t } = useTranslation("compartidas");
  const {
    data: stats,
    isPending: loading,
    isError: error,
  } = useBgWatchHomeStatsQuery(bggUsername);

  const totalYear = stats?.totalYear ?? 0;
  const headlineText = error
    ? t("homeWidget.errorLoad")
    : loading
      ? t("homeWidget.loading")
      : totalYear === 0
        ? t("homeWidget.firstPlay")
        : t("homeWidget.playsThisYear", { count: totalYear });

  return (
    <div className={styles.widgetConnected} aria-busy={loading}>
      <div className={styles.widgetHead}>
        <span className={styles.connectedEyebrow}>
          <Meeple />
          {t("homeWidget.tuBgWatch")}
        </span>
        <Link
          to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
          className={styles.widgetLink}
        >
          {t("homeWidget.verHistorial")}
        </Link>
      </div>

      {loading ? (
        <div
          className={styles.skeletonHeadline}
          role="status"
          aria-label={t("homeWidget.loadingAria")}
        >
          <span className={styles.skeletonLine} />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        </div>
      ) : (
        <p className={styles.headline}>{headlineText}</p>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t("homeWidget.esteMes")}</span>
          <span className={styles.statValue}>
            {loading ? (
              <span className={styles.skeletonStat} aria-hidden="true" />
            ) : error ? (
              "—"
            ) : (
              stats.thisMonth
            )}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t("homeWidget.masJugado")}</span>
          <span
            className={`${styles.statValue} ${styles.statValueText}`}
            title={
              !loading && !error && stats.mostPlayed
                ? stats.mostPlayed.name || t("homeWidget.unknownGame")
                : undefined
            }
          >
            {loading ? (
              <span
                className={`${styles.skeletonStat} ${styles.skeletonStatWide}`}
                aria-hidden="true"
              />
            ) : error ? (
              "—"
            ) : stats.mostPlayed ? (
              stats.mostPlayed.name || t("homeWidget.unknownGame")
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      <Link
        to={`/bg-watch/${encodeURIComponent(bggUsername)}/partidas/nueva`}
        className={styles.cta}
      >
        {t("homeWidget.registrarPartida")}
      </Link>
    </div>
  );
}

function PromoView({ onDismiss }) {
  const { t } = useTranslation("compartidas");
  const brandName = useBrandName();
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
          aria-label={t("homeWidget.dismiss")}
          title={t("homeWidget.dismiss")}
        >
          ✕
        </button>
      )}
      <Link to="/bg-watch" className={styles.promoLink}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>
            <Meeple />
            BG WATCH
          </span>
        </div>
        <h3 className={styles.title}>{t("homeWidget.promoTitle")}</h3>
        <p className={styles.promoSub}>
          {t("homeWidget.promoSub", { brand: brandName })}
        </p>
        <span className={styles.promoCta}>{t("homeWidget.promoCta")}</span>
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
  // Tener BG Watch = tener `bggUsername`. La vista conectada (ConnectedView) es
  // read-only (lee partidas de BGG), así que NO requiere la conexión por password
  // (`bggConnected`, que solo habilita ESCRIBIR). Consistente con el Sidebar, que
  // usa `bggUsername` como señal de "tiene BG Watch". Antes exigía bggConnected,
  // por lo que un usuario read-only veía el promo "¿Llevás tus partidas en BGG?".
  // `!bggInvalid` se mantiene: si las credenciales guardadas quedaron inválidas,
  // el promo sirve de nudge para reconectar.
  const hasBgWatch = !!user.bggUsername && !user.bggInvalid;
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
