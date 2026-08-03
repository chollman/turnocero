import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import {
  userKeys,
  useUsersListQuery,
  banUser,
  deleteUser,
} from "../../queries/users";
import { getLocale } from "../../utils/locale";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import { ArtComunidad, ArtSearch } from "../../components/shared/EmptyArt";
import { GhostMembers } from "../../components/shared/EmptyGhosts";
import styles from "./UsersList.module.css";
import UsersListSkeleton from "./UsersListSkeleton";

const buildSortOptions = (t) => [
  { value: "alpha", label: t("usuarios:list.sortAlpha") },
  { value: "activity", label: t("usuarios:list.sortActivity") },
  { value: "date_desc", label: t("usuarios:list.sortDateDesc") },
  { value: "date_asc", label: t("usuarios:list.sortDateAsc") },
];

function UserCard({ user, currentUser, isAdmin, onBan, onDelete, index = 0 }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayLabel =
    user.displayName ||
    [user.nombre, user.apellido].filter(Boolean).join(" ") ||
    user.username;
  const totalActivity = user.tablesHosted + user.tablesAsPlayer;
  const joined = new Date(user.createdAt).toLocaleDateString(getLocale(), {
    month: "short",
    year: "numeric",
  });

  const isSelf = currentUser?._id === user._id;
  const showAdminActions = isAdmin && !isSelf && !user.isAdmin;

  return (
    <div
      className={`${styles.card} ${user.isBanned ? styles.cardBanned : ""}`}
      style={{ "--i": index }}
      onClick={() => navigate(`/usuarios/${user._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/usuarios/${user._id}`);
        }
      }}
    >
      {user.isBanned && (
        <span
          className={styles.bannedBadge}
          title={
            user.bannedReason
              ? t("usuarios:list.bannedReason", { reason: user.bannedReason })
              : t("usuarios:list.banned")
          }
        >
          {t("usuarios:list.bannedBadge")}
        </span>
      )}
      {user.isAdmin && !isSelf && (
        <span className={styles.adminBadge}>{t("usuarios:list.admin")}</span>
      )}

      <div className={styles.cardAvatar}>
        <Avatar user={user} size="md" />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardUsername}>@{user.username}</p>
        {displayLabel !== user.username && (
          <p className={styles.cardName}>{displayLabel}</p>
        )}
        <div className={styles.cardMeta}>
          {user.direccion?.texto && (
            <span className={styles.metaChip}>
              <span className={styles.metaIcon}>📍</span>
              {user.direccion.texto.length > 30
                ? `${user.direccion.texto.slice(0, 30)}…`
                : user.direccion.texto}
            </span>
          )}
          <span className={styles.metaChip}>
            <span className={styles.metaIcon}>📅</span>
            {t("usuarios:list.since", { date: joined })}
          </span>
          {user.bggUsername && (
            <Link
              to={`/bg-watch/${encodeURIComponent(user.bggUsername)}`}
              className={styles.bgWatchChip}
              onClick={(e) => e.stopPropagation()}
              title={t("usuarios:list.bgWatchChipTitle", {
                username: user.username,
              })}
            >
              <svg
                className={styles.bgWatchChipIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2.5" />
                <circle
                  cx="8"
                  cy="8"
                  r="1.3"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16"
                  cy="8"
                  r="1.3"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="1.3"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="8"
                  cy="16"
                  r="1.3"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="1.3"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              {t("usuarios:list.bgWatch")}
            </Link>
          )}
          {user.bggConnected && !user.bggInvalid && (
            <span
              className={styles.bggConnectedChip}
              title={t("usuarios:list.bggConnectedTitle", {
                username: user.username,
              })}
            >
              <svg
                className={styles.bggConnectedChipIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t("usuarios:list.connected")}
            </span>
          )}
        </div>
      </div>
      <div className={styles.cardStats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesHosted}</span>
          <span className={styles.statLabel}>
            {t("usuarios:list.statTablesHosted")}
          </span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesAsPlayer}</span>
          <span className={styles.statLabel}>
            {t("usuarios:list.statTablesPlayed")}
          </span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.compartidas}</span>
          <span className={styles.statLabel}>
            {t("usuarios:list.statPublications")}
          </span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span
            className={`${styles.statValue} ${totalActivity > 0 ? styles.statValueActive : ""}`}
          >
            {totalActivity}
          </span>
          <span className={styles.statLabel}>
            {t("usuarios:list.statTotal")}
          </span>
        </div>
      </div>

      {showAdminActions && (
        <div
          className={styles.adminActions}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={user.isBanned ? styles.unbanButton : styles.banButton}
            onClick={(e) => {
              e.stopPropagation();
              onBan(user);
            }}
          >
            {user.isBanned
              ? t("usuarios:list.unban")
              : t("usuarios:list.ban")}
          </button>
          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(user);
            }}
          >
            {t("usuarios:list.delete")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function UsersList({ communityId = null } = {}) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const brandName = useBrandName();
  const sortOptions = buildSortOptions(t);
  const isAdmin = !!currentUser?.isAdmin;
  // Modo "embebido": cuando se renderiza dentro de la vista de una comunidad
  // (ComunidadDetail provee su propio encabezado). Oculta el hero global y el
  // banner de onboarding de BG Watch, y scopea el fetch a esa comunidad.
  const embedded = !!communityId;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("alpha");
  const [activeOnly, setActiveOnly] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [bgWatchOnly, setBgWatchOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 350);

  const [banTarget, setBanTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const params = { sortBy };
  if (debouncedSearch) params.search = debouncedSearch;
  if (activeOnly) params.activeOnly = "true";
  if (friendsOnly) params.friendsOnly = "true";
  if (bgWatchOnly) params.bgWatchOnly = "true";
  if (communityId) params.community = communityId;
  const { data: users = [], isPending: loading } = useUsersListQuery(params);

  const handleBanConfirm = async (reason) => {
    if (!banTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      const { data } = await banUser(banTarget._id, {
        banned: !banTarget.isBanned,
        reason: banTarget.isBanned ? "" : reason || "",
      });
      queryClient.setQueryData(userKeys.list(params), (prev) =>
        (prev || []).map((u) =>
          u._id === banTarget._id
            ? {
                ...u,
                isBanned: data.isBanned,
                bannedAt: data.bannedAt,
                bannedReason: data.bannedReason,
              }
            : u,
        ),
      );
      setBanTarget(null);
    } catch (err) {
      setActionError(
        err.response?.data?.message || t("usuarios:list.updateError"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      await deleteUser(deleteTarget._id);
      queryClient.setQueryData(userKeys.list(params), (prev) =>
        (prev || []).filter((u) => u._id !== deleteTarget._id),
      );
      setDeleteTarget(null);
    } catch (err) {
      setActionError(
        err.response?.data?.message || t("usuarios:list.deleteError"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const closeModals = () => {
    if (actionLoading) return;
    setBanTarget(null);
    setDeleteTarget(null);
    setActionError("");
  };

  const visibleUsers = isAdmin ? users : users.filter((u) => !u.isBanned);

  return (
    <div className={embedded ? styles.embedded : styles.page}>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.heroBlock}>
            <div className={styles.eyebrow}>
              <Meeple />
              {t("usuarios:list.eyebrow")}
            </div>
            <h1 className={styles.heroTitle}>{t("usuarios:list.heroTitle")}</h1>
            <p className={styles.heroSub}>
              {t("usuarios:list.heroSub", { brand: brandName })}
            </p>
          </div>
          <span className={styles.countBadge}>
            {t("usuarios:list.countBadge", { count: visibleUsers.length })}
          </span>
        </div>
      )}

      {!embedded && currentUser && !currentUser.bggUsername && (
        <Link to="/bg-watch" className={styles.bgWatchBanner}>
          <span className={styles.bgWatchBannerIcon} aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2.5" />
              <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
              <circle
                cx="16"
                cy="8"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="12"
                cy="12"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="8"
                cy="16"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="16"
                cy="16"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
          <div className={styles.bgWatchBannerBody}>
            <strong className={styles.bgWatchBannerTitle}>
              {t("usuarios:list.bgWatchBannerTitle")}
            </strong>
            <p className={styles.bgWatchBannerSub}>
              {t("usuarios:list.bgWatchBannerSub", { brand: brandName })}
            </p>
          </div>
          <span className={styles.bgWatchBannerCta}>
            {t("usuarios:list.bgWatchBannerCta")}
          </span>
        </Link>
      )}

      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={t("usuarios:list.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <select
            className={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            className={`${styles.toggleBtn} ${activeOnly ? styles.toggleActive : ""}`}
            onClick={() => setActiveOnly((v) => !v)}
          >
            {t("usuarios:list.onlyActive")}
          </button>

          {currentUser && (
            <button
              className={`${styles.toggleBtn} ${friendsOnly ? styles.toggleActive : ""}`}
              onClick={() => setFriendsOnly((v) => !v)}
            >
              {t("usuarios:list.onlyFriends")}
            </button>
          )}

          <button
            className={`${styles.toggleBtn} ${styles.toggleBgWatch} ${bgWatchOnly ? styles.toggleActive : ""}`}
            onClick={() => setBgWatchOnly((v) => !v)}
            title={t("usuarios:list.bgWatchOnlyTitle")}
          >
            <svg
              className={styles.toggleBgWatchIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2.5" />
              <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
              <circle
                cx="16"
                cy="8"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="12"
                cy="12"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="8"
                cy="16"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="16"
                cy="16"
                r="1.3"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            {t("usuarios:list.withBgWatch")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <UsersListSkeleton key={i} />
          ))}
        </div>
      ) : visibleUsers.length === 0 ? (
        search || activeOnly || friendsOnly || bgWatchOnly ? (
          <EmptyState
            variant="filtered"
            compact
            art={<ArtSearch />}
            eyebrow={t("usuarios:list.emptyFilteredEyebrow")}
            title={
              <Trans
                i18nKey="usuarios:list.emptyFilteredTitle"
                components={{ em: <em /> }}
              />
            }
            text={t("usuarios:list.emptyFilteredText")}
            secondary={{
              label: t("usuarios:list.clearFilters"),
              icon: "clear",
              onClick: () => {
                setSearch("");
                setActiveOnly(false);
                setFriendsOnly(false);
                setBgWatchOnly(false);
              },
            }}
          />
        ) : (
          <EmptyState
            art={<ArtComunidad />}
            ghost={<GhostMembers />}
            eyebrow={t("usuarios:list.emptyEyebrow")}
            title={
              <Trans
                i18nKey="usuarios:list.emptyTitle"
                components={{ em: <em /> }}
              />
            }
            text={t("usuarios:list.emptyText")}
          />
        )
      ) : (
        <div className={styles.grid}>
          {visibleUsers.map((u, i) => (
            <UserCard
              key={u._id}
              user={u}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onBan={setBanTarget}
              onDelete={setDeleteTarget}
              index={i}
            />
          ))}
        </div>
      )}

      <ConfirmActionModal
        isOpen={!!banTarget}
        title={
          banTarget?.isBanned
            ? t("usuarios:list.unbanUser")
            : t("usuarios:list.banUser")
        }
        message={
          banTarget?.isBanned
            ? t("usuarios:list.unbanConfirm", { username: banTarget?.username })
            : `${t("usuarios:list.banConfirm", { username: banTarget?.username })}${actionError ? `\n\n${actionError}` : ""}`
        }
        confirmLabel={
          banTarget?.isBanned ? t("usuarios:list.unban") : t("usuarios:list.ban")
        }
        variant={banTarget?.isBanned ? "warning" : "danger"}
        inputLabel={
          banTarget && !banTarget.isBanned
            ? t("usuarios:list.banReasonLabel")
            : undefined
        }
        inputPlaceholder={t("usuarios:list.banReasonPlaceholder")}
        loading={actionLoading}
        onConfirm={handleBanConfirm}
        onCancel={closeModals}
      />

      <ConfirmActionModal
        isOpen={!!deleteTarget}
        title={t("usuarios:list.deleteUser")}
        message={`${t("usuarios:list.deleteConfirm", { username: deleteTarget?.username })}${actionError ? `\n\n${actionError}` : ""}`}
        confirmLabel={t("usuarios:list.deletePermanently")}
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={closeModals}
      />
    </div>
  );
}
