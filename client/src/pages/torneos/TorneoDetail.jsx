import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import {
  useTorneoQuery,
  useTorneoMatchesQuery,
  useTorneoStandingsQuery,
  torneoKeys,
  recordMatchResult,
  undoMatchResult,
} from "../../queries/torneos";
import UserRef from "../../components/shared/UserRef";
import AdminPanel from "./components/AdminPanel";
import RegistrationsList from "./components/RegistrationsList";
import ParticipantsList from "./components/ParticipantsList";
import RegisterButton from "./components/RegisterButton";
import LeagueStandings from "./components/LeagueStandings";
import LeagueRoundsList from "./components/LeagueRoundsList";
import Bracket from "./components/Bracket";
import RecordResultModal from "./components/RecordResultModal";
import SeedReorderModal from "./components/SeedReorderModal";
import AddParticipantModal from "./components/AddParticipantModal";
import GroupsView from "./components/GroupsView";
import BackButton from "../../components/shared/BackButton";
import styles from "./TorneoDetail.module.css";

const STATUS_META = {
  draft: { labelKey: "status.draft", className: "chipDraft" },
  registration: {
    labelKey: "status.registration",
    className: "chipRegistration",
  },
  in_progress: { labelKey: "status.in_progress", className: "chipInProgress" },
  finished: { labelKey: "status.finished", className: "chipFinished" },
};

const FORMAT_LABEL = {
  league: { labelKey: "format.leagueFull", icon: "🔁" },
  single_elim: { labelKey: "format.singleElimFull", icon: "🏆" },
  groups: { labelKey: "format.groupsFull", icon: "🧩" },
};

const TABS_BY_FORMAT = {
  league: ["standings", "matches", "participants"],
  single_elim: ["bracket", "participants"],
  groups: ["groups", "participants"],
};

const TAB_LABEL = {
  standings: "detail.tabStandings",
  matches: "detail.tabMatches",
  bracket: "detail.tabBracket",
  groups: "detail.tabGroups",
  participants: "detail.tabParticipants",
};

// Referencias estables — evitan un array nuevo en cada render mientras las
// queries no tienen datos.
const EMPTY_MATCHES = [];
const EMPTY_STANDINGS = [];

export default function TorneoDetail() {
  const { t } = useTranslation("torneos");
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isActuallyAdmin, viewAsUser } = useAuth();
  const { setActiveTorneo } = useNotifications();
  const brandName = useBrandName();
  const showAdminUI = isActuallyAdmin && !viewAsUser;
  const queryClient = useQueryClient();

  useEffect(() => {
    setActiveTorneo(id);
  }, [id, setActiveTorneo]);

  const [activeTab, setActiveTab] = useState(null);
  const [recordingMatch, setRecording] = useState(null);
  const [reorderingSeeds, setReordering] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);

  const {
    data: torneo,
    isPending: loadingTorneo,
    isError,
  } = useTorneoQuery(id);
  // Formato "groups" no usa /matches ni /standings — GroupsView carga
  // /groups por su cuenta con su propia query.
  const isGroups = torneo?.format === "groups";
  const matchesEnabled = !!torneo && !isGroups;
  const {
    data: matches = EMPTY_MATCHES,
    isPending: matchesPending,
  } = useTorneoMatchesQuery(id, { enabled: matchesEnabled });
  const {
    data: standings = EMPTY_STANDINGS,
    isPending: standingsPending,
  } = useTorneoStandingsQuery(id, { enabled: matchesEnabled });
  const loading =
    loadingTorneo || (matchesEnabled && (matchesPending || standingsPending));

  // Seedea el tab activo una sola vez, al formato del torneo recién cargado.
  useEffect(() => {
    if (torneo && activeTab === null) {
      setActiveTab(TABS_BY_FORMAT[torneo.format]?.[0] || null);
    }
  }, [torneo, activeTab]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: torneoKeys.detail(id) }),
    [queryClient, id],
  );

  const handleRecord = async (payload) => {
    if (!recordingMatch) return;
    await recordMatchResult(id, recordingMatch._id, payload);
    setRecording(null);
    await refresh();
  };

  const handleUndoResult = async (match) => {
    try {
      await undoMatchResult(id, match._id);
      await refresh();
    } catch (err) {
      alert(err.response?.data?.message || t("detail.undoError"));
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loadingMsg}>{t("detail.loading")}</p>
        </div>
      </div>
    );
  }

  if (isError || !torneo) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackButton to="/torneos" flush>
            {t("detail.back")}
          </BackButton>
          <p className={styles.loadingMsg}>{t("detail.notFound")}</p>
        </div>
      </div>
    );
  }

  const status = STATUS_META[torneo.status];
  const format = FORMAT_LABEL[torneo.format];
  const tabs = TABS_BY_FORMAT[torneo.format] || [];

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {t("detail.metaTitle", { title: torneo.title, brand: brandName })}
        </title>
        <meta name="description" content={`${torneo.title} — ${torneo.game}`} />
      </Helmet>

      <div className={styles.inner}>
        <BackButton to="/torneos" flush>
          {t("detail.back")}
        </BackButton>

        {torneo.image?.url ? (
          <div className={styles.banner}>
            <img
              src={torneo.image.url}
              alt=""
              className={styles.bannerBg}
              aria-hidden="true"
            />
            <img
              src={torneo.image.url}
              alt={torneo.title}
              className={styles.bannerImg}
            />
          </div>
        ) : null}

        <header className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={`${styles.chip} ${styles[status.className]}`}>
              {t(status.labelKey)}
            </span>
            <span className={styles.formatLabel}>
              {format.icon} {t(format.labelKey)}
            </span>
          </div>
          <h1 className={styles.titleHeading}>{torneo.title}</h1>
          <p className={styles.titleGame}>🎲 {torneo.game}</p>
          {torneo.description && (
            <p className={styles.titleDesc}>{torneo.description}</p>
          )}
          <p className={styles.titleMeta}>
            {t("detail.organizedBy")} <UserRef user={torneo.createdBy} /> · 👥{" "}
            {torneo.participants?.length || 0}
            {torneo.maxParticipants ? ` / ${torneo.maxParticipants}` : ""}{" "}
            {t("detail.participantsWord")}
          </p>
        </header>

        {torneo.status === "registration" && (
          <div className={styles.registerRow}>
            <RegisterButton torneo={torneo} user={user} onChange={refresh} />
          </div>
        )}

        {torneo.status === "finished" && torneo.winner && (
          <div className={styles.podium}>
            <h3 className={styles.podiumTitle}>{t("detail.podiumTitle")}</h3>
            <p className={styles.podiumRow}>
              <span className={styles.podiumGold}>
                {t("detail.podiumChampion")}
              </span>{" "}
              <UserRef user={torneo.winner} />
            </p>
            {torneo.runnerUp && (
              <p className={styles.podiumRow}>
                <span className={styles.podiumSilver}>
                  {t("detail.podiumRunnerUp")}
                </span>{" "}
                <UserRef user={torneo.runnerUp} />
              </p>
            )}
          </div>
        )}

        {showAdminUI && (
          <AdminPanel
            torneo={torneo}
            onChange={(updated) =>
              queryClient.setQueryData(torneoKeys.detail(id), updated)
            }
            onReorderSeeds={() => setReordering(true)}
            onAddParticipants={() => setAddingParticipants(true)}
            onDelete={() => navigate("/torneos")}
          />
        )}

        {showAdminUI && torneo.status === "registration" && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {t("detail.pendingRegistrations")}
            </h3>
            <RegistrationsList
              torneo={torneo}
              onChange={(updated) =>
              queryClient.setQueryData(torneoKeys.detail(id), updated)
            }
            />
          </section>
        )}

        <nav className={styles.tabs}>
          {tabs.map((tabId) => (
            <button
              key={tabId}
              className={`${styles.tab} ${activeTab === tabId ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tabId)}
            >
              {t(TAB_LABEL[tabId])}
            </button>
          ))}
        </nav>

        <section className={styles.tabBody}>
          {activeTab === "standings" && (
            <LeagueStandings
              standings={standings}
              participants={torneo.participants || []}
            />
          )}
          {activeTab === "matches" && (
            <LeagueRoundsList
              matches={matches}
              isAdmin={showAdminUI && torneo.status === "in_progress"}
              onRecord={setRecording}
              onUndo={handleUndoResult}
            />
          )}
          {activeTab === "bracket" && (
            <Bracket
              matches={matches}
              isAdmin={showAdminUI && torneo.status === "in_progress"}
              onRecord={setRecording}
              onUndo={handleUndoResult}
            />
          )}
          {activeTab === "groups" && (
            <GroupsView
              torneo={torneo}
              isAdmin={showAdminUI}
              onTorneoChange={refresh}
            />
          )}
          {activeTab === "participants" && (
            <ParticipantsList
              torneo={torneo}
              isAdmin={showAdminUI}
              onChange={(updated) =>
              queryClient.setQueryData(torneoKeys.detail(id), updated)
            }
            />
          )}
        </section>
      </div>

      {recordingMatch && (
        <RecordResultModal
          match={recordingMatch}
          format={torneo.format}
          onClose={() => setRecording(null)}
          onConfirm={handleRecord}
        />
      )}

      {reorderingSeeds && (
        <SeedReorderModal
          torneo={torneo}
          onClose={() => setReordering(false)}
          onSaved={(updated) => {
            queryClient.setQueryData(torneoKeys.detail(id), updated);
            setReordering(false);
          }}
        />
      )}

      {addingParticipants && (
        <AddParticipantModal
          torneo={torneo}
          onClose={() => setAddingParticipants(false)}
          onChange={(updated) =>
            queryClient.setQueryData(torneoKeys.detail(id), updated)
          }
        />
      )}
    </div>
  );
}
