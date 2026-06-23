import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getUserDisplay } from "../../utils/userDisplay";
import { getLocale } from "../../utils/locale";
import { toCsv, downloadCsv } from "../../utils/downloadCsv";
import Avatar from "../../components/shared/Avatar";
import UsageTrendChart from "./UsageTrendChart";
import panelStyles from "./PanelAdmin.module.css";
import styles from "./BggUsagePanel.module.css";

// 'YYYY-MM-DD' del día local (el admin es argentino → coincide con la hora AR
// que usa el server). Evita hacer aritmética de timezone en el cliente.
function localDay(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

const ACTION_CLASS = {
  create: styles.actCreate,
  edit: styles.actEdit,
  delete: styles.actDelete,
};

function fmtDateTime(value) {
  return new Date(value).toLocaleString(getLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`${styles.statCard} ${accent || ""}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default function BggUsagePanel() {
  const { t } = useTranslation();
  const { addToast } = useNotifications();
  const userName = (user) =>
    user ? getUserDisplay(user).name : t("admin:bggUsage.anonymous");
  const actionLabel = (action) =>
    ({
      create: t("admin:bggUsage.actions.create"),
      edit: t("admin:bggUsage.actions.edit"),
      delete: t("admin:bggUsage.actions.delete"),
    })[action] || action;
  const [tab, setTab] = useState("resumen");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDay(d);
  });
  const [to, setTo] = useState(() => localDay(new Date()));

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [events, setEvents] = useState([]);
  const [eventsMeta, setEventsMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventUserId, setEventUserId] = useState("");

  const loadSummary = useCallback(
    async (signal) => {
      setLoadingSummary(true);
      try {
        const { data } = await axios.get(API.admin.BGG_USAGE, {
          params: { from, to },
          signal,
        });
        setSummary(data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        addToast({
          type: "error",
          title: t("admin:errorToast"),
          message: getErrorMessage(err, t("admin:bggUsage.errorSummary")),
        });
      } finally {
        setLoadingSummary(false);
      }
    },
    [from, to, addToast, t],
  );

  const loadEvents = useCallback(
    async (page, signal) => {
      setLoadingEvents(true);
      try {
        const params = { from, to, page, limit: 30 };
        if (eventUserId) params.userId = eventUserId;
        const { data } = await axios.get(API.admin.BGG_USAGE_EVENTS, {
          params,
          signal,
        });
        setEvents((prev) =>
          page > 1 ? [...prev, ...data.events] : data.events,
        );
        setEventsMeta({ page: data.page, pages: data.pages, total: data.total });
      } catch (err) {
        if (axios.isCancel(err)) return;
        addToast({
          type: "error",
          title: t("admin:errorToast"),
          message: getErrorMessage(err, t("admin:bggUsage.errorActivity")),
        });
      } finally {
        setLoadingEvents(false);
      }
    },
    [from, to, eventUserId, addToast, t],
  );

  // Usuarios con actividad (para el filtro de la pestaña Actividad). Los
  // anónimos no tienen mutaciones, así que solo listamos usuarios reales.
  const filterableUsers = (summary?.perUser || []).filter((r) => r.user);

  const handleExportCsv = () => {
    if (!summary) return;
    const headers = [
      t("admin:bggUsage.csv.user"),
      t("admin:bggUsage.csv.bgg"),
      t("admin:bggUsage.csv.requests"),
      t("admin:bggUsage.csv.searches"),
      t("admin:bggUsage.csv.games"),
      t("admin:bggUsage.csv.playsApi"),
      t("admin:bggUsage.csv.collection"),
      t("admin:bggUsage.csv.others"),
      t("admin:bggUsage.csv.syncs"),
      t("admin:bggUsage.csv.created"),
      t("admin:bggUsage.csv.edited"),
      t("admin:bggUsage.csv.deleted"),
    ];
    const rows = summary.perUser.map((r) => [
      userName(r.user),
      r.bggUsername || "",
      r.reads,
      r.byEndpoint.search,
      r.byEndpoint.thing,
      r.byEndpoint.plays,
      r.byEndpoint.collection,
      r.byEndpoint.other,
      r.syncs,
      r.mutations.created,
      r.mutations.edited,
      r.mutations.deleted,
    ]);
    downloadCsv(`bgg-usage_${from}_${to}.csv`, toCsv(headers, rows));
  };

  useEffect(() => {
    const ac = new AbortController();
    loadSummary(ac.signal);
    return () => ac.abort();
  }, [loadSummary]);

  useEffect(() => {
    if (tab !== "actividad") return undefined;
    const ac = new AbortController();
    loadEvents(1, ac.signal);
    return () => ac.abort();
  }, [tab, loadEvents]);

  const totals = summary?.totals;

  return (
    <div className={panelStyles.group}>
      <h2 className={panelStyles.groupTitle}>{t("admin:bggUsage.title")}</h2>

      <div className={styles.controls}>
        <div className={styles.range}>
          <label className={styles.rangeField}>
            <span>{t("admin:bggUsage.from")}</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={styles.rangeField}>
            <span>{t("admin:bggUsage.to")}</span>
            <input
              type="date"
              value={to}
              min={from}
              max={localDay(new Date())}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "resumen"}
            className={`${styles.tab} ${tab === "resumen" ? styles.tabActive : ""}`}
            onClick={() => setTab("resumen")}
          >
            {t("admin:bggUsage.tabSummary")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "actividad"}
            className={`${styles.tab} ${tab === "actividad" ? styles.tabActive : ""}`}
            onClick={() => setTab("actividad")}
          >
            {t("admin:bggUsage.tabActivity")}
          </button>
        </div>
      </div>

      {tab === "resumen" ? (
        <>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.exportBtn}
              disabled={!summary || summary.perUser.length === 0}
              onClick={handleExportCsv}
            >
              {t("admin:bggUsage.exportCsv")}
            </button>
          </div>

          <div className={styles.stats}>
            <StatCard
              label={t("admin:bggUsage.statRequests")}
              value={totals ? totals.reads : "—"}
              accent={styles.statReads}
            />
            <StatCard
              label={t("admin:bggUsage.statSyncs")}
              value={totals ? totals.syncs : "—"}
            />
            <StatCard
              label={t("admin:bggUsage.statCreated")}
              value={totals ? totals.created : "—"}
              accent={styles.statCreated}
            />
            <StatCard
              label={t("admin:bggUsage.statEdited")}
              value={totals ? totals.edited : "—"}
            />
            <StatCard
              label={t("admin:bggUsage.statDeleted")}
              value={totals ? totals.deleted : "—"}
            />
          </div>

          {summary && summary.byDay.length > 1 && (
            <UsageTrendChart data={summary.byDay} />
          )}

          {loadingSummary ? (
            <p className={styles.empty}>{t("admin:bggUsage.loading")}</p>
          ) : !summary || summary.perUser.length === 0 ? (
            <p className={styles.empty}>{t("admin:bggUsage.emptySummary")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("admin:bggUsage.colUser")}</th>
                    <th className={styles.num}>
                      {t("admin:bggUsage.colRequests")}
                    </th>
                    <th className={styles.num}>
                      {t("admin:bggUsage.colSyncs")}
                    </th>
                    <th className={styles.num}>
                      {t("admin:bggUsage.colCreated")}
                    </th>
                    <th className={styles.num}>
                      {t("admin:bggUsage.colEdited")}
                    </th>
                    <th className={styles.num}>
                      {t("admin:bggUsage.colDeleted")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perUser.map((row) => {
                    const be = row.byEndpoint;
                    const breakdown = t("admin:bggUsage.breakdown", {
                      search: be.search,
                      thing: be.thing,
                      plays: be.plays,
                      collection: be.collection,
                      other: be.other,
                    });
                    return (
                      <tr key={row.userId || "anon"}>
                        <td>
                          <div className={styles.userCell}>
                            {row.user ? (
                              <Avatar user={row.user} size="sm" />
                            ) : (
                              <span className={styles.anonAvatar} aria-hidden>
                                ?
                              </span>
                            )}
                            <div className={styles.userText}>
                              <span className={styles.userName}>
                                {userName(row.user)}
                              </span>
                              {row.bggUsername && (
                                <span className={styles.bggTag}>
                                  @{row.bggUsername}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={styles.num} title={breakdown}>
                          {row.reads}
                        </td>
                        <td className={styles.num}>{row.syncs}</td>
                        <td className={styles.num}>{row.mutations.created}</td>
                        <td className={styles.num}>{row.mutations.edited}</td>
                        <td className={styles.num}>{row.mutations.deleted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <label className={styles.filterField}>
              <span>{t("admin:bggUsage.filterUser")}</span>
              <select
                value={eventUserId}
                onChange={(e) => setEventUserId(e.target.value)}
              >
                <option value="">{t("admin:bggUsage.filterAll")}</option>
                {filterableUsers.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {userName(r.user)}
                    {r.bggUsername ? ` (@${r.bggUsername})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingEvents && events.length === 0 ? (
            <p className={styles.empty}>{t("admin:bggUsage.loading")}</p>
          ) : events.length === 0 ? (
            <p className={styles.empty}>{t("admin:bggUsage.emptyActivity")}</p>
          ) : (
            <>
              <ul className={styles.eventsList}>
                {events.map((ev) => (
                  <li key={ev._id} className={styles.eventRow}>
                    {ev.user ? (
                      <Avatar user={ev.user} size="sm" />
                    ) : (
                      <span className={styles.anonAvatar} aria-hidden>
                        ?
                      </span>
                    )}
                    <div className={styles.eventBody}>
                      <span className={styles.eventLine}>
                        <strong>{userName(ev.user)}</strong>{" "}
                        <span
                          className={`${styles.actBadge} ${ACTION_CLASS[ev.action] || ""}`}
                        >
                          {actionLabel(ev.action)}
                        </span>{" "}
                        {ev.gameName ||
                          t("admin:bggUsage.game", { id: ev.gameId || "?" })}
                      </span>
                      <span className={styles.eventMeta}>
                        {fmtDateTime(ev.createdAt)}
                        {ev.bggUsername ? ` · @${ev.bggUsername}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {eventsMeta.page < eventsMeta.pages && (
                <button
                  type="button"
                  className={styles.moreBtn}
                  disabled={loadingEvents}
                  onClick={() => loadEvents(eventsMeta.page + 1)}
                >
                  {loadingEvents
                    ? t("admin:bggUsage.loading")
                    : t("admin:bggUsage.loadMore")}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
