import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getUserDisplay } from "../../utils/userDisplay";
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

const ACTION_LABEL = { create: "Cargó", edit: "Editó", delete: "Borró" };
const ACTION_CLASS = {
  create: styles.actCreate,
  edit: styles.actEdit,
  delete: styles.actDelete,
};

function fmtDateTime(value) {
  return new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userName(user) {
  if (!user) return "Anónimos";
  return getUserDisplay(user).name;
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
  const { addToast } = useNotifications();
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
          title: "Error",
          message: getErrorMessage(err, "No pudimos cargar el uso de BGG."),
        });
      } finally {
        setLoadingSummary(false);
      }
    },
    [from, to, addToast],
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
          title: "Error",
          message: getErrorMessage(err, "No pudimos cargar la actividad."),
        });
      } finally {
        setLoadingEvents(false);
      }
    },
    [from, to, eventUserId, addToast],
  );

  // Usuarios con actividad (para el filtro de la pestaña Actividad). Los
  // anónimos no tienen mutaciones, así que solo listamos usuarios reales.
  const filterableUsers = (summary?.perUser || []).filter((r) => r.user);

  const handleExportCsv = () => {
    if (!summary) return;
    const headers = [
      "Usuario",
      "BGG",
      "Requests",
      "Búsquedas",
      "Juegos",
      "Partidas(API)",
      "Colección",
      "Otros",
      "Syncs",
      "Altas",
      "Ediciones",
      "Borrados",
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
      <h2 className={panelStyles.groupTitle}>Uso de BoardGameGeek</h2>

      <div className={styles.controls}>
        <div className={styles.range}>
          <label className={styles.rangeField}>
            <span>Desde</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={styles.rangeField}>
            <span>Hasta</span>
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
            Resumen
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "actividad"}
            className={`${styles.tab} ${tab === "actividad" ? styles.tabActive : ""}`}
            onClick={() => setTab("actividad")}
          >
            Actividad
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
              Exportar CSV
            </button>
          </div>

          <div className={styles.stats}>
            <StatCard
              label="Requests a BGG"
              value={totals ? totals.reads : "—"}
              accent={styles.statReads}
            />
            <StatCard label="Syncs" value={totals ? totals.syncs : "—"} />
            <StatCard
              label="Partidas cargadas"
              value={totals ? totals.created : "—"}
              accent={styles.statCreated}
            />
            <StatCard label="Ediciones" value={totals ? totals.edited : "—"} />
            <StatCard label="Borrados" value={totals ? totals.deleted : "—"} />
          </div>

          {summary && summary.byDay.length > 1 && (
            <UsageTrendChart data={summary.byDay} />
          )}

          {loadingSummary ? (
            <p className={styles.empty}>Cargando…</p>
          ) : !summary || summary.perUser.length === 0 ? (
            <p className={styles.empty}>
              No hubo actividad de BGG en este rango.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th className={styles.num}>Requests</th>
                    <th className={styles.num}>Syncs</th>
                    <th className={styles.num}>Altas</th>
                    <th className={styles.num}>Ed.</th>
                    <th className={styles.num}>Bor.</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perUser.map((row) => {
                    const be = row.byEndpoint;
                    const breakdown = `búsquedas ${be.search} · juegos ${be.thing} · partidas ${be.plays} · colección ${be.collection} · otros ${be.other}`;
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
              <span>Usuario</span>
              <select
                value={eventUserId}
                onChange={(e) => setEventUserId(e.target.value)}
              >
                <option value="">Todos</option>
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
            <p className={styles.empty}>Cargando…</p>
          ) : events.length === 0 ? (
            <p className={styles.empty}>
              No se cargaron, editaron ni borraron partidas en este rango.
            </p>
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
                          {ACTION_LABEL[ev.action] || ev.action}
                        </span>{" "}
                        {ev.gameName || `Juego #${ev.gameId || "?"}`}
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
                  {loadingEvents ? "Cargando…" : "Ver más"}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
