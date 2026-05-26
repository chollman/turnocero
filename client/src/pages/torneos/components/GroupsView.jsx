import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import { API } from "../../../api/endpoints";
import GroupStandings from "./GroupStandings";
import GameScoreModal from "./GameScoreModal";
import PhaseTransitionModal from "./PhaseTransitionModal";
import styles from "../TorneoDetail.module.css";

export default function GroupsView({ torneo, isAdmin, onTorneoChange }) {
  const [phaseData, setPhaseData] = useState(null);
  const [activePhase, setActivePhase] = useState(torneo.currentPhase || 1);
  const [loading, setLoading] = useState(true);
  const [recordingGame, setRecordingGame] = useState(null);
  const [recordingGroup, setRecordingGroup] = useState(null);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingAdvanced, setEditingAdvanced] = useState(null); // groupId currently in edit-mode

  const load = useCallback(
    async (phaseToLoad) => {
      setLoading(true);
      try {
        const { data } = await axios.get(API.torneos.GROUPS(torneo._id), {
          params: { phase: phaseToLoad },
        });
        setPhaseData(data);
      } catch {
        /* show empty state on failure */
      } finally {
        setLoading(false);
      }
    },
    [torneo._id],
  );

  useEffect(() => {
    load(activePhase);
  }, [load, activePhase]);

  // When torneo.currentPhase changes (e.g., after generating next phase), jump to it.
  useEffect(() => {
    setActivePhase(torneo.currentPhase || 1);
  }, [torneo.currentPhase]);

  const refresh = () => load(activePhase);

  if (loading || !phaseData) {
    return <p className={styles.emptyMsg}>Cargando grupos…</p>;
  }

  if (phaseData.groups.length === 0) {
    return (
      <p className={styles.emptyMsg}>
        Todavía no se generaron grupos para esta fase.
      </p>
    );
  }

  const allCompleted = phaseData.groups.every((g) => g.status === "completed");
  const allHaveAdvanced = phaseData.groups.every(
    (g) => (g.advancedPlayers || []).length > 0,
  );
  const canGenerateNextPhase =
    isAdmin &&
    activePhase === phaseData.currentPhase &&
    allCompleted &&
    allHaveAdvanced &&
    torneo.status === "in_progress";

  const handleRecord = async ({ results }) => {
    if (!recordingGame) return;
    await axios.post(API.torneos.GAME_RESULT(torneo._id, recordingGame._id), {
      results,
    });
    setRecordingGame(null);
    setRecordingGroup(null);
    await refresh();
  };

  const handleUndoResult = async (game) => {
    try {
      await axios.delete(API.torneos.GAME_RESULT(torneo._id, game._id));
      await refresh();
    } catch (err) {
      alert(err.response?.data?.message || "Error al deshacer");
    }
  };

  const toggleAdvanced = (group, userId) => {
    const current = new Set(
      (group.advancedPlayers || []).map((p) => String(p._id || p)),
    );
    if (current.has(String(userId))) current.delete(String(userId));
    else current.add(String(userId));
    return [...current];
  };

  const saveAdvanced = async (group, advancedIds) => {
    try {
      await axios.patch(API.torneos.GROUP_ADVANCED(torneo._id, group._id), {
        advancedPlayers: advancedIds,
      });
      setEditingAdvanced(null);
      await refresh();
    } catch (err) {
      alert(err.response?.data?.message || "Error al guardar");
    }
  };

  const phaseTabs = [];
  for (let i = 1; i <= phaseData.totalPhases; i++) phaseTabs.push(i);

  return (
    <div className={styles.groupsViewWrap}>
      {phaseData.totalPhases > 1 && (
        <div className={styles.phaseTabs}>
          {phaseTabs.map((p) => (
            <button
              key={p}
              className={`${styles.phaseTab} ${activePhase === p ? styles.phaseTabActive : ""}`}
              onClick={() => setActivePhase(p)}
            >
              Fase {p}
              {p === phaseData.currentPhase ? " · actual" : ""}
            </button>
          ))}
        </div>
      )}

      <div className={styles.groupGrid}>
        {phaseData.groups.map((group) => (
          <GroupCard
            key={group._id}
            group={group}
            isAdmin={isAdmin}
            isCurrentPhase={activePhase === phaseData.currentPhase}
            gamesPerGroup={phaseData.gamesPerGroup}
            qualifiersPerGroup={phaseData.qualifiersPerGroup}
            isFinalTable={phaseData.groups.length === 1}
            onRecordGame={(g) => {
              setRecordingGame(g);
              setRecordingGroup(group);
            }}
            onUndoGame={handleUndoResult}
            editingAdvanced={editingAdvanced === group._id}
            onToggleEditAdvanced={() =>
              setEditingAdvanced(
                editingAdvanced === group._id ? null : group._id,
              )
            }
            onToggleAdvanced={(userId) => {
              const next = toggleAdvanced(group, userId);
              return saveAdvanced(group, next);
            }}
          />
        ))}
      </div>

      {canGenerateNextPhase && (
        <div className={styles.phaseNextRow}>
          <button
            className={styles.btnPrimary}
            onClick={() => setShowPhaseModal(true)}
          >
            Generar siguiente fase →
          </button>
        </div>
      )}

      {!canGenerateNextPhase &&
        allCompleted &&
        activePhase === phaseData.currentPhase &&
        isAdmin &&
        phaseData.groups.length === 1 &&
        torneo.status === "in_progress" && (
          <p className={styles.phaseFinalHint}>
            Esta es la mesa final. Cuando la confirmes, usá{" "}
            <em>Finalizar torneo</em> en el panel admin.
          </p>
        )}

      {recordingGame && (
        <GameScoreModal
          game={recordingGame}
          players={recordingGroup?.players || []}
          onClose={() => {
            setRecordingGame(null);
            setRecordingGroup(null);
          }}
          onConfirm={handleRecord}
        />
      )}

      {showPhaseModal && (
        <PhaseTransitionModal
          torneoId={torneo._id}
          onClose={() => setShowPhaseModal(false)}
          onGenerated={async () => {
            setShowPhaseModal(false);
            await onTorneoChange();
          }}
        />
      )}
    </div>
  );
}

function GroupCard({
  group,
  isAdmin,
  isCurrentPhase,
  gamesPerGroup,
  qualifiersPerGroup,
  isFinalTable,
  onRecordGame,
  onUndoGame,
  editingAdvanced,
  onToggleEditAdvanced,
  onToggleAdvanced,
}) {
  const advancedIds = new Set(
    (group.advancedPlayers || []).map((p) => String(p._id || p)),
  );
  const champion =
    isFinalTable && group.status === "completed" ? group.standings?.[0] : null;
  // Find the populated user for the champion (standings entries only carry userId strings).
  const championUser = champion
    ? (group.players || []).find(
        (p) => String(p._id || p) === String(champion.user),
      )
    : null;

  return (
    <div
      className={`${styles.groupCard} ${isFinalTable ? styles.groupCardFinal : ""}`}
    >
      <div className={styles.groupHeader}>
        <h3 className={styles.groupTitle}>
          {isFinalTable ? "🏆 Mesa final" : `Mesa #${group.tableNumber}`}
        </h3>
        <span
          className={`${styles.groupStatus} ${styles[`status_${group.status}`]}`}
        >
          {group.status === "completed"
            ? "Terminado"
            : group.status === "in_progress"
              ? "En curso"
              : "Pendiente"}
        </span>
      </div>

      {champion && championUser && (
        <div className={styles.championBanner}>
          <span className={styles.championIcon}>🏆</span>
          <div className={styles.championText}>
            <span className={styles.championLabel}>Campeón provisional</span>
            <span className={styles.championName}>
              <UserRef user={championUser} noLink />
              <span className={styles.championScore}>
                {champion.totalPV} PV
              </span>
            </span>
          </div>
        </div>
      )}

      <GroupStandings
        standings={group.standings}
        players={group.players}
        gamesPerGroup={gamesPerGroup}
        qualifiersPerGroup={isFinalTable ? 1 : qualifiersPerGroup}
      />

      <div className={styles.groupGamesSection}>
        <h4 className={styles.groupSubheading}>Partidas</h4>
        <ul className={styles.groupGamesList}>
          {(group.games || []).map((g) => (
            <li key={g._id} className={styles.groupGameItem}>
              <div className={styles.groupGameInfo}>
                <span className={styles.groupGameNumber}>
                  Partida {g.gameNumber}
                </span>
                <span
                  className={`${styles.groupGameStatus} ${g.status === "completed" ? styles.groupGameStatusDone : ""}`}
                >
                  {g.status === "completed" ? "✓ Cargada" : "Pendiente"}
                </span>
              </div>
              {g.status === "completed" && (
                <ol className={styles.groupGameResults}>
                  {[...g.results]
                    .sort((a, b) => a.position - b.position)
                    .map((r) => (
                      <li key={String(r.player?._id || r.player)}>
                        <span className={styles.groupGameResultPos}>
                          {r.position}º
                        </span>
                        <UserRef user={r.player} noLink />
                        <span className={styles.groupGameResultScore}>
                          {r.score} pts
                        </span>
                      </li>
                    ))}
                </ol>
              )}
              {isAdmin && isCurrentPhase && (
                <div className={styles.groupGameActions}>
                  {g.status === "pending" ? (
                    <button
                      className={styles.matchBtnPrimary}
                      onClick={() => onRecordGame(g)}
                    >
                      Cargar resultado
                    </button>
                  ) : (
                    <button
                      className={styles.matchBtnGhost}
                      onClick={() => onUndoGame(g)}
                    >
                      Deshacer
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {group.status === "completed" && !isFinalTable && (
        <div className={styles.groupAdvancedSection}>
          <div className={styles.groupAdvancedHeader}>
            <h4 className={styles.groupSubheading}>
              Promovidos ({advancedIds.size})
            </h4>
            {isAdmin && isCurrentPhase && (
              <button
                className={styles.adminLink}
                onClick={onToggleEditAdvanced}
              >
                {editingAdvanced ? "Listo" : "Editar"}
              </button>
            )}
          </div>
          {editingAdvanced ? (
            <ul className={styles.advancedPickList}>
              {group.players.map((p) => {
                const id = String(p._id || p);
                const info = getUserDisplay(p);
                const isAdvanced = advancedIds.has(id);
                return (
                  <li key={id} className={styles.advancedPickItem}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isAdvanced}
                        onChange={() => onToggleAdvanced(id)}
                      />
                      <span>
                        {info.isDeleted ? (
                          <span className={styles.deletedTxt}>
                            Usuario eliminado
                          </span>
                        ) : (
                          <UserRef user={p} noLink />
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className={styles.advancedList}>
              {(group.advancedPlayers || []).map((p) => (
                <li key={String(p._id || p)}>
                  <span className={styles.advancedDot}>→</span>
                  <UserRef user={p} noLink />
                </li>
              ))}
              {(group.advancedPlayers || []).length === 0 && (
                <li className={styles.emptyMsg}>Sin promovidos asignados</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
