import Meeple from "../../components/shared/Meeple";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import {
  useUserDetailQuery,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
} from "../../queries/users";
import { getLocale } from "../../utils/locale";
import GameTile from "../../components/shared/GameTile";
import BackButton from "../../components/shared/BackButton";
import Avatar from "../../components/shared/Avatar";
import ProfileSkeleton from "./ProfileSkeleton";
import BgWatchUserCard from "./BgWatchUserCard";
import styles from "./UserProfilePublic.module.css";

function seedFromId(id = "") {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeAgo(iso, t) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("usuarios:public.today");
  if (days === 1) return t("usuarios:public.yesterday");
  if (days < 7) return t("usuarios:public.daysAgo", { count: days });
  if (days < 30)
    return t("usuarios:public.weeksAgo", { count: Math.floor(days / 7) });
  if (days < 365)
    return t("usuarios:public.monthsAgo", { count: Math.floor(days / 30) });
  return t("usuarios:public.yearsAgo", { count: Math.floor(days / 365) });
}

function StatCard({ value, label, accent }) {
  return (
    <div
      className={`${styles.statCard} ${accent ? styles.statCardAccent : ""}`}
    >
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function FavoriteGames({ games }) {
  const { t } = useTranslation();
  if (!games || games.length === 0) return null;
  const max = games[0].count;
  return (
    <div className={styles.favSection}>
      <div className={styles.sectionLabel}>
        {t("usuarios:public.favoriteGames")}
      </div>
      <div className={styles.gamesList}>
        {games.map((g, i) => (
          <div key={g.game} className={styles.gameRow}>
            <span className={styles.gameRank}>#{i + 1}</span>
            <span className={styles.gameName}>{g.game}</span>
            <div className={styles.gameBarWrap}>
              <div
                className={styles.gameBar}
                style={{ width: `${Math.round((g.count / max) * 100)}%` }}
              />
            </div>
            <span className={styles.gameCount}>{g.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserProfilePublic() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  // React Router v6 mantiene `idx` en `window.history.state` para trackear su
  // stack. idx > 0 = hubo navegación in-app previa (sea por click o por reload
  // de una URL a la que el user llegó navegando), así que back saca al user al
  // sitio del que vino. idx === 0 (o sin state) = llegó directo (tab nuevo,
  // link compartido) y caemos al fallback /comunidades. `location.key !== 'default'`
  // no servía: sobrevive al reload y daba falsos positivos.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  const goBack = () => (canGoBack ? navigate(-1) : navigate("/comunidades"));
  const backLabel = canGoBack
    ? t("usuarios:public.back")
    : t("usuarios:public.communities");
  const { user: currentUser, refreshUser } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const { notifyFriendAdded } = useNotifications();
  const amigosEnabled = isSectionEnabled("amigos");
  const mesasEnabled = isSectionEnabled("mesas");
  const compartidasEnabled = isSectionEnabled("compartidas");
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const {
    data: profile,
    isPending: loading,
    isError,
  } = useUserDetailQuery(id);
  const [relationship, setRelationship] = useState("none");
  const [friendLoading, setFriendLoading] = useState(false);

  useEffect(() => {
    if (profile) setRelationship(profile.relationship ?? "none");
  }, [profile]);

  const handleFriendAction = async (action) => {
    setFriendLoading(true);
    try {
      if (action === "request") {
        await sendFriendRequest(id);
        setRelationship("request_sent");
      } else if (action === "cancel_request") {
        await cancelFriendRequest(id);
        setRelationship("none");
      } else if (action === "accept") {
        await acceptFriendRequest(id);
        setRelationship("friends");
        notifyFriendAdded();
        refreshUser().catch(() => {});
      } else if (action === "reject") {
        await rejectFriendRequest(id);
        setRelationship("none");
      } else if (action === "unfriend") {
        await unfriend(id);
        setRelationship("none");
        refreshUser().catch(() => {});
      }
    } catch {
      // silently ignore
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (isError || !profile) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCenter}>
          <p>
            {isError
              ? t("usuarios:public.loadError")
              : t("usuarios:public.userNotFound")}
          </p>
          <BackButton onClick={goBack} flush>
            {canGoBack
              ? t("usuarios:public.back")
              : t("usuarios:public.backToPlayers")}
          </BackButton>
        </div>
      </div>
    );
  }

  const { stats } = profile;
  const displayName =
    profile.displayName ||
    [profile.nombre, profile.apellido].filter(Boolean).join(" ") ||
    profile.username;
  const seed = seedFromId(profile._id || id);
  const joinYear = profile.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : null;

  const contactParts = [
    profile.direccion?.texto,
    profile.telegram ? `✈️ ${t("usuarios:public.telegram")}` : null,
    profile.celular ? `📱 ${t("usuarios:public.celular")}` : null,
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      {/* GameTile hero banner */}
      <div className={styles.banner}>
        <GameTile game={profile.username} seed={seed} size="100%" />
        <div className={styles.bannerOverlay} />
      </div>

      <div className={styles.inner}>
        {/* Back button */}
        <BackButton onClick={goBack} flush>
          {backLabel}
        </BackButton>

        {/* Hero row: avatar + name + actions */}
        <div className={styles.heroRow}>
          <Avatar user={profile} size="xl" />
          <div className={styles.heroInfo}>
            <div className={styles.eyebrow}>
              <Meeple />
              {joinYear
                ? t("usuarios:public.eyebrowSince", { year: joinYear })
                : t("usuarios:public.eyebrow")}
            </div>
            <h1 className={styles.heroTitle}>{displayName}</h1>
            <div className={styles.heroSub}>
              @{profile.username}
              {contactParts.length > 0 && ` · ${contactParts.join(" · ")}`}
            </div>

            {currentUser && currentUser._id !== id && amigosEnabled && (
              <div className={styles.friendActions}>
                {relationship === "none" && (
                  <button
                    className={styles.friendBtnPrimary}
                    onClick={() => handleFriendAction("request")}
                    disabled={friendLoading}
                  >
                    {t("usuarios:public.addFriend")}
                  </button>
                )}
                {relationship === "request_sent" && (
                  <button
                    className={styles.friendBtnMuted}
                    onClick={() => handleFriendAction("cancel_request")}
                    disabled={friendLoading}
                  >
                    {t("usuarios:public.requestSentCancel")}
                  </button>
                )}
                {relationship === "request_received" && (
                  <div className={styles.friendBtnGroup}>
                    <button
                      className={styles.friendBtnAccept}
                      onClick={() => handleFriendAction("accept")}
                      disabled={friendLoading}
                    >
                      {t("usuarios:public.accept")}
                    </button>
                    <button
                      className={styles.friendBtnMuted}
                      onClick={() => handleFriendAction("reject")}
                      disabled={friendLoading}
                    >
                      {t("usuarios:public.reject")}
                    </button>
                  </div>
                )}
                {relationship === "friends" && (
                  <div className={styles.friendBtnGroup}>
                    <span className={styles.friendsBadge}>
                      {t("usuarios:public.friendsBadge")}
                    </span>
                    <button
                      className={styles.friendBtnUnfriend}
                      onClick={() => handleFriendAction("unfriend")}
                      disabled={friendLoading}
                    >
                      {t("usuarios:public.unfriend")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          {mesasEnabled && (
            <StatCard
              value={stats.totalGamesPlayed}
              label={t("usuarios:public.statGamesPlayed")}
              accent
            />
          )}
          {mesasEnabled && (
            <StatCard
              value={stats.tablesHosted.total}
              label={t("usuarios:public.statTablesHosted")}
            />
          )}
          {mesasEnabled && (
            <StatCard
              value={stats.tablesAsPlayer.total}
              label={t("usuarios:public.statAsPlayer")}
            />
          )}
          {mesasEnabled && (
            <StatCard
              value={stats.tablesHosted.active}
              label={t("usuarios:public.statTablesActive")}
            />
          )}
          {amigosEnabled && (
            <StatCard
              value={profile.friendsCount}
              label={t("usuarios:public.statFriends")}
            />
          )}
          {compartidasEnabled && (
            <StatCard
              value={stats.compartidas}
              label={t("usuarios:public.statPublications")}
            />
          )}
          {compartidasEnabled && (
            <StatCard
              value={stats.likesReceived}
              label={t("usuarios:public.statLikes")}
            />
          )}
        </div>

        {/* BG Watch card — prominent surface for visiting someone's BG Watch */}
        {profile.bggUsername && bgwatchEnabled && (
          <BgWatchUserCard bggUsername={profile.bggUsername} />
        )}

        {/* Two-column layout */}
        <div className={styles.layout}>
          {/* Left: contact + favorites */}
          <div className={styles.leftCol}>
            {(profile.direccion?.texto ||
              profile.telegram ||
              profile.celular) && (
              <div className={styles.infoCard}>
                <div className={styles.sectionLabel}>
                  {t("usuarios:public.contact")}
                </div>
                <div className={styles.infoList}>
                  {profile.direccion?.texto && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>📍</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>
                          {t("usuarios:public.zone")}
                        </span>
                        <span className={styles.infoValue}>
                          {profile.direccion.texto}
                        </span>
                      </div>
                    </div>
                  )}
                  {profile.telegram && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>✈️</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>
                          {t("usuarios:public.telegram")}
                        </span>
                        <span className={styles.infoValue}>
                          @{profile.telegram}
                        </span>
                      </div>
                    </div>
                  )}
                  {profile.celular && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>📱</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>
                          {t("usuarios:public.celular")}
                        </span>
                        <span className={styles.infoValue}>
                          {profile.celular}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mesasEnabled && <FavoriteGames games={stats.favoriteGames} />}

            {stats.lastActivity && (
              <div className={styles.activityHint}>
                {t("usuarios:public.lastActivity", {
                  ago: timeAgo(stats.lastActivity, t),
                })}
              </div>
            )}
          </div>

          {/* Right: breakdown */}
          <div className={styles.rightCol}>
            {mesasEnabled && (
              <>
                <div className={styles.infoCard}>
                  <div className={styles.sectionLabel}>
                    {t("usuarios:public.tablesAsHost")}
                  </div>
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownItem}>
                      <span
                        className={`${styles.breakdownDot} ${styles.dotOpen}`}
                      />
                      <span className={styles.breakdownLabel}>
                        {t("usuarios:public.open")}
                      </span>
                      <span className={styles.breakdownValue}>
                        {stats.tablesHosted.open}
                      </span>
                    </div>
                    <div className={styles.breakdownItem}>
                      <span
                        className={`${styles.breakdownDot} ${styles.dotFull}`}
                      />
                      <span className={styles.breakdownLabel}>
                        {t("usuarios:public.full")}
                      </span>
                      <span className={styles.breakdownValue}>
                        {stats.tablesHosted.full}
                      </span>
                    </div>
                    <div className={styles.breakdownItem}>
                      <span
                        className={`${styles.breakdownDot} ${styles.dotCancelled}`}
                      />
                      <span className={styles.breakdownLabel}>
                        {t("usuarios:public.cancelled")}
                      </span>
                      <span className={styles.breakdownValue}>
                        {stats.tablesHosted.cancelled}
                      </span>
                    </div>
                    {stats.tablesHosted.total > 0 && (
                      <div
                        className={`${styles.breakdownItem} ${styles.breakdownSuccess}`}
                      >
                        <span
                          className={`${styles.breakdownDot} ${styles.dotSuccess}`}
                        />
                        <span className={styles.breakdownLabel}>
                          {t("usuarios:public.successRate")}
                        </span>
                        <span
                          className={`${styles.breakdownValue} ${styles.breakdownValueSuccess}`}
                        >
                          {Math.round(
                            ((stats.tablesHosted.total -
                              stats.tablesHosted.cancelled) /
                              stats.tablesHosted.total) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {stats.totalGamesPlayed > 0 && (
                  <div className={styles.infoCard}>
                    <div className={styles.sectionLabel}>
                      {t("usuarios:public.roleInGames")}
                    </div>
                    <div className={styles.ratioWrap}>
                      <div className={styles.ratioLabels}>
                        <span>{t("usuarios:public.host")}</span>
                        <span>{t("usuarios:public.player")}</span>
                      </div>
                      <div className={styles.ratioBar}>
                        <div
                          className={styles.ratioFill}
                          style={{
                            width: `${Math.round((stats.tablesHosted.active / stats.totalGamesPlayed) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className={styles.ratioValues}>
                        <span>
                          {Math.round(
                            (stats.tablesHosted.active /
                              stats.totalGamesPlayed) *
                              100,
                          )}
                          %
                        </span>
                        <span>
                          {Math.round(
                            (stats.tablesAsPlayer.active /
                              stats.totalGamesPlayed) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {profile.createdAt && (
              <div className={styles.miembroCard}>
                <div className={styles.sectionLabel}>
                  {t("usuarios:public.memberSince")}
                </div>
                <div className={styles.miembroDate}>
                  {formatDate(profile.createdAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
