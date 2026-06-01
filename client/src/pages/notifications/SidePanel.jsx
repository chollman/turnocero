import Meeple from "../../components/shared/Meeple";
import { useMemo } from "react";
import NotifIcon from "./NotifIcons";
import {
  DOMAIN_META,
  getDomain,
  isActionable,
  notifBucket,
} from "../../utils/notifDomains";
import styles from "./SidePanel.module.css";

// Panel lateral de resumen (digest). Los valores se derivan del array
// `notifications` con useMemo (feedback_derived_counts) — sin estado ni
// backend. La sección "Preferencias" del handoff queda fuera de alcance.
export default function SidePanel({ notifications }) {
  const stats = useMemo(() => {
    let unread = 0;
    let actionable = 0;
    let today = 0;
    for (const n of notifications) {
      if (!n.read) unread += 1;
      if (isActionable(n)) actionable += 1;
      if (notifBucket(n.updatedAt || n.timestamp) === "today") today += 1;
    }
    return { unread, actionable, today, total: notifications.length };
  }, [notifications]);

  const breakdown = useMemo(() => {
    const counts = {};
    for (const n of notifications) {
      const d = getDomain(n.type);
      counts[d] = (counts[d] || 0) + 1;
    }
    const rows = Object.entries(counts)
      .map(([domain, count]) => ({ domain, count, ...DOMAIN_META[domain] }))
      .sort((a, b) => b.count - a.count);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
    return { rows, max };
  }, [notifications]);

  return (
    <aside className={styles.side}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.eyebrow}><Meeple />Resumen</span>
          <h2 className={styles.headTitle}>Tu actividad en TurnoCero</h2>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.red}`}>
              {stats.unread}
            </span>
            <span className={styles.statLabel}>Sin leer</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.orange}`}>
              {stats.actionable}
            </span>
            <span className={styles.statLabel}>Requieren acción</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.amber}`}>
              {stats.today}
            </span>
            <span className={styles.statLabel}>Hoy</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.green}`}>
              {stats.total}
            </span>
            <span className={styles.statLabel}>Total activas</span>
          </div>
        </div>

        {breakdown.rows.length > 0 && (
          <div className={styles.breakdown}>
            {breakdown.rows.map((r) => (
              <div key={r.domain} className={styles.bdRow}>
                <span
                  className={styles.bdIcon}
                  style={{ color: `var(${r.colorVar})` }}
                >
                  <NotifIcon name={r.icon} size={13} />
                </span>
                <span className={styles.bdTrack}>
                  <span
                    className={styles.bdFill}
                    style={{
                      width: `${(r.count / breakdown.max) * 100}%`,
                      background: `var(${r.colorVar})`,
                    }}
                  />
                </span>
                <span className={styles.bdCount}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
