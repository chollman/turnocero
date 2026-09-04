import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getLocale } from "../../utils/locale";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import CommunitiesAdmin from "./CommunitiesAdmin";
import BggUsagePanel from "./BggUsagePanel";
import PushTestPanel from "./PushTestPanel";
import styles from "./PanelAdmin.module.css";

// Layout de grupos → keys de secciones de SiteConfig. Las etiquetas/descripciones/
// "afecta a" se resuelven por i18n desde `admin:sections.<key>` y el título del
// grupo desde `admin:panel.groups.<group>`.
const SECTION_GROUPS = [
  {
    group: "main",
    keys: [
      "compartidas",
      "noticias",
      "eventos",
      "torneos",
      "mathtrade",
      "mesas",
      "miFeed",
      "calendario",
    ],
  },
  { group: "social", keys: ["comunidad", "comunidades", "amigos", "dms"] },
  {
    group: "integrations",
    keys: ["bgwatch", "instagramCrosspost", "utilidades", "colabora"],
  },
  { group: "notifications", keys: ["push"] },
];

const STATUS_KEYS = ["new", "reviewed", "archived"];

function ideaSender(idea, anonymousLabel) {
  if (idea.fromUser) {
    const d = getUserDisplay(idea.fromUser);
    return d.name;
  }
  if (idea.fromEmail) return idea.fromEmail;
  return anonymousLabel;
}

function IdeasSection() {
  const { t } = useTranslation();
  const { addToast } = useNotifications();
  const [status, setStatus] = useState("new");
  const [ideas, setIdeas] = useState([]);
  const [counts, setCounts] = useState({ new: 0, reviewed: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      try {
        const { data } = await axios.get(API.ideas.LIST, {
          params: { status, limit: 50 },
          signal,
        });
        setIdeas(data.ideas || []);
        setCounts(data.counts || { new: 0, reviewed: 0, archived: 0 });
      } catch (err) {
        if (axios.isCancel(err)) return;
        addToast({
          type: "error",
          title: t("admin:errorToast"),
          message: getErrorMessage(err, t("admin:ideas.errorLoad")),
        });
      } finally {
        setLoading(false);
      }
    },
    [status, addToast, t],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const patch = async (id, nextStatus) => {
    setBusyId(id);
    try {
      await axios.patch(API.ideas.DETAIL(id), { status: nextStatus });
      setIdeas((prev) => prev.filter((i) => i._id !== id));
      setCounts((prev) => ({
        ...prev,
        [status]: Math.max(0, prev[status] - 1),
        [nextStatus]: prev[nextStatus] + 1,
      }));
    } catch (err) {
      addToast({
        type: "error",
        title: t("admin:errorToast"),
        message: getErrorMessage(err, t("admin:ideas.errorUpdate")),
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t("admin:ideas.confirmDelete"))) return;
    setBusyId(id);
    try {
      await axios.delete(API.ideas.DETAIL(id));
      setIdeas((prev) => prev.filter((i) => i._id !== id));
      setCounts((prev) => ({
        ...prev,
        [status]: Math.max(0, prev[status] - 1),
      }));
    } catch (err) {
      addToast({
        type: "error",
        title: t("admin:errorToast"),
        message: getErrorMessage(err, t("admin:ideas.errorDelete")),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.group}>
      <h2 className={styles.groupTitle}>
        {t("admin:ideas.title")}
        {counts.new > 0 && (
          <span
            className={styles.ideasBadge}
            aria-label={t("admin:ideas.newBadgeAria", { count: counts.new })}
          >
            {counts.new}
          </span>
        )}
      </h2>

      <div className={styles.ideasTabs} role="tablist">
        {STATUS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={status === key}
            className={`${styles.ideasTab} ${status === key ? styles.ideasTabActive : ""}`}
            onClick={() => setStatus(key)}
          >
            {t(`admin:ideas.tabs.${key}`)}
            <span className={styles.ideasTabCount}>{counts[key] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.ideasEmpty}>{t("common:states.loading")}</p>
      ) : ideas.length === 0 ? (
        <p className={styles.ideasEmpty}>
          {status === "new"
            ? t("admin:ideas.emptyNew")
            : status === "reviewed"
              ? t("admin:ideas.emptyReviewed")
              : t("admin:ideas.emptyArchived")}
        </p>
      ) : (
        <ul className={styles.ideasList}>
          {ideas.map((idea) => (
            <li key={idea._id} className={styles.ideaCard}>
              <div className={styles.ideaMeta}>
                <div className={styles.ideaSender}>
                  {idea.fromUser ? (
                    <Avatar user={idea.fromUser} size="sm" />
                  ) : (
                    <span className={styles.ideaAnonAvatar} aria-hidden>
                      ?
                    </span>
                  )}
                  <span className={styles.ideaSenderName}>
                    {ideaSender(idea, t("admin:ideas.anonymous"))}
                  </span>
                </div>
                <time className={styles.ideaDate}>
                  {new Date(idea.createdAt).toLocaleString(getLocale(), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className={styles.ideaContent}>{idea.content}</p>
              <div className={styles.ideaActions}>
                {status !== "reviewed" && (
                  <button
                    type="button"
                    className={styles.ideaBtn}
                    disabled={busyId === idea._id}
                    onClick={() => patch(idea._id, "reviewed")}
                  >
                    {t("admin:ideas.markReviewed")}
                  </button>
                )}
                {status !== "archived" && (
                  <button
                    type="button"
                    className={styles.ideaBtn}
                    disabled={busyId === idea._id}
                    onClick={() => patch(idea._id, "archived")}
                  >
                    {t("admin:ideas.archive")}
                  </button>
                )}
                {status !== "new" && (
                  <button
                    type="button"
                    className={styles.ideaBtn}
                    disabled={busyId === idea._id}
                    onClick={() => patch(idea._id, "new")}
                  >
                    {t("admin:ideas.backToNew")}
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.ideaBtn} ${styles.ideaBtnDanger}`}
                  disabled={busyId === idea._id}
                  onClick={() => remove(idea._id)}
                >
                  {t("common:actions.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionToggle({ section, enabled, busy, onToggle }) {
  const { t } = useTranslation();
  const label = t(`admin:sections.${section.key}.label`);
  const affects = t(`admin:sections.${section.key}.affects`, {
    returnObjects: true,
  });
  return (
    <div
      className={`${styles.sectionCard} ${enabled ? styles.sectionCardOn : styles.sectionCardOff}`}
    >
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleBlock}>
          <span className={styles.sectionLabel}>{label}</span>
          <span className={styles.sectionKey}>{section.key}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("admin:panel.toggleAria", {
            action: enabled
              ? t("admin:panel.toggleOff")
              : t("admin:panel.toggleOn"),
            label,
          })}
          className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
          disabled={busy}
          onClick={() => onToggle(section.key, !enabled)}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      <p className={styles.sectionDesc}>
        {t(`admin:sections.${section.key}.desc`)}
      </p>
      <div className={styles.affects}>
        <span className={styles.affectsLabel}>
          {enabled
            ? t("admin:panel.affectsOn")
            : t("admin:panel.affectsOff")}
        </span>
        <ul className={styles.affectsList}>
          {(Array.isArray(affects) ? affects : []).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const ADMIN_TAB_KEYS = ["secciones", "comunidades", "bgg", "ideas"];

function SectionsTab() {
  const { t } = useTranslation();
  const { sections, loaded, updatedAt, updateConfig } = useSiteConfig();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");

  const handleToggle = async (key, nextEnabled) => {
    setBusyKey(key);
    setError("");
    try {
      await updateConfig({ [key]: { enabled: nextEnabled } });
    } catch (err) {
      setError(err?.response?.data?.message || t("admin:panel.updateError"));
    } finally {
      setBusyKey(null);
    }
  };

  if (!loaded) {
    return <p className={styles.sub}>{t("admin:panel.loadingConfig")}</p>;
  }

  return (
    <>
      <p className={styles.sub}>
        <Trans
          i18nKey="admin:panel.sectionsIntro"
          components={{ em: <em /> }}
        />
      </p>
      {updatedAt && (
        <span className={styles.updatedAt}>
          {t("admin:panel.updatedAt", {
            date: new Date(updatedAt).toLocaleString(getLocale(), {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </span>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {SECTION_GROUPS.map((group) => (
        <div key={group.group} className={styles.group}>
          <h2 className={styles.groupTitle}>
            {t(`admin:panel.groups.${group.group}`)}
          </h2>
          <div className={styles.grid}>
            {group.keys.map((key) => (
              <SectionToggle
                key={key}
                section={{ key }}
                enabled={sections?.[key]?.enabled !== false}
                busy={busyKey === key}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      ))}

      <PushTestPanel />
    </>
  );
}

function PanelAdminInner() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("secciones");

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            {t("admin:panel.eyebrow")}
          </div>
          <h1 className={styles.title}>{t("admin:panel.title")}</h1>
        </div>

        <div
          className={styles.tabBar}
          role="tablist"
          aria-label={t("admin:panel.tablistLabel")}
        >
          {ADMIN_TAB_KEYS.map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              role="tab"
              id={`admin-tab-${tabKey}`}
              aria-selected={tab === tabKey}
              aria-controls={`admin-panel-${tabKey}`}
              className={`${styles.tabBtn} ${tab === tabKey ? styles.tabBtnActive : ""}`}
              onClick={() => setTab(tabKey)}
            >
              {t(`admin:panel.tabs.${tabKey}`)}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`admin-panel-${tab}`}
          aria-labelledby={`admin-tab-${tab}`}
        >
          {tab === "secciones" && <SectionsTab />}
          {tab === "comunidades" && <CommunitiesAdmin />}
          {tab === "bgg" && <BggUsagePanel />}
          {tab === "ideas" && <IdeasSection />}
        </div>
      </div>
    </div>
  );
}

export default function PanelAdmin() {
  const { user, isActuallyAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isActuallyAdmin) return <Navigate to="/" replace />;
  return <PanelAdminInner />;
}
