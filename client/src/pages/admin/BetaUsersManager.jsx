import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Avatar from "../../components/shared/Avatar";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useNotifications } from "../../context/NotificationContext";
import {
  addBetaUser,
  betaKeys,
  removeBetaUser,
  useBetaUsersQuery,
} from "../../queries/admin";
import { useUserSearchQuery } from "../../queries/users";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./BetaUsersManager.module.css";

// Usuarios habilitados para una feature en piloto (hoy, el agente de carga de
// BG Watch). Va dentro de la tarjeta del interruptor de esa feature en
// /panel-admin. El server valida todo (`/api/admin/beta/:feature/usuarios`).

const EMPTY = [];
const MIN_SEARCH = 2;

export default function BetaUsersManager({ feature }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 250);
  const canSearch = debounced.length >= MIN_SEARCH;
  const [busyId, setBusyId] = useState(null);

  const {
    data: users = EMPTY,
    isLoading,
    isError,
  } = useBetaUsersQuery(feature);
  const { data: results = EMPTY, isFetching: searching } = useUserSearchQuery(
    debounced,
    { enabled: canSearch },
  );

  const enabledIds = new Set(users.map((u) => String(u._id)));

  const run = async (user, action) => {
    const id = String(user._id);
    const name = getUserDisplay(user).name;
    setBusyId(id);
    try {
      if (action === "add") await addBetaUser(feature, id);
      else await removeBetaUser(feature, id);
      await queryClient.invalidateQueries({
        queryKey: betaKeys.users(feature),
      });
      addToast({
        type: "success",
        message: t(
          action === "add"
            ? "admin:betaUsers.toastAdded"
            : "admin:betaUsers.toastRemoved",
          { name },
        ),
      });
      if (action === "add") setSearch("");
    } catch (err) {
      addToast({
        type: "error",
        title: t("admin:errorToast"),
        message: getErrorMessage(
          err,
          t(
            action === "add"
              ? "admin:betaUsers.errorAdd"
              : "admin:betaUsers.errorRemove",
          ),
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  const searchId = `beta-search-${feature}`;

  return (
    <section className={styles.box} aria-labelledby={`beta-title-${feature}`}>
      <div className={styles.head}>
        <h3 id={`beta-title-${feature}`} className={styles.title}>
          {t("admin:betaUsers.title")}
        </h3>
        {!isLoading && !isError && (
          <span className={styles.count}>
            {t("admin:betaUsers.count", { count: users.length })}
          </span>
        )}
      </div>
      <p className={styles.help}>{t("admin:betaUsers.help")}</p>

      {isLoading ? (
        <p className={styles.muted}>{t("admin:betaUsers.loading")}</p>
      ) : isError ? (
        <p className={styles.error}>{t("admin:betaUsers.errorLoad")}</p>
      ) : users.length === 0 ? (
        <p className={styles.muted}>{t("admin:betaUsers.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {users.map((u) => {
            const info = getUserDisplay(u);
            const id = String(u._id);
            return (
              <li key={id} className={styles.item}>
                <Avatar user={u} size="sm" />
                <span className={styles.name}>
                  {info.name}
                  {u.username && (
                    <span className={styles.handle}>@{u.username}</span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={busyId === id}
                  aria-label={t("admin:betaUsers.removeAria", {
                    name: info.name,
                  })}
                  onClick={() => run(u, "remove")}
                >
                  {t("admin:betaUsers.remove")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className={styles.searchLabel} htmlFor={searchId}>
        {t("admin:betaUsers.searchLabel")}
      </label>
      <input
        id={searchId}
        type="search"
        className={styles.searchInput}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin:betaUsers.searchPlaceholder")}
        autoComplete="off"
      />
      {search.trim() && !canSearch ? (
        <p className={styles.muted}>{t("admin:betaUsers.searchHint")}</p>
      ) : canSearch && searching && results.length === 0 ? (
        <p className={styles.muted}>{t("admin:betaUsers.searching")}</p>
      ) : canSearch && results.length === 0 ? (
        <p className={styles.muted}>{t("admin:betaUsers.noResults")}</p>
      ) : canSearch ? (
        <ul className={styles.list}>
          {results.slice(0, 8).map((u) => {
            const info = getUserDisplay(u);
            const id = String(u._id);
            const already = enabledIds.has(id);
            return (
              <li key={id} className={styles.item}>
                <Avatar user={u} size="sm" />
                <span className={styles.name}>
                  {info.name}
                  {u.username && (
                    <span className={styles.handle}>@{u.username}</span>
                  )}
                </span>
                {already ? (
                  <span className={styles.already}>
                    {t("admin:betaUsers.alreadyIn")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.addBtn}
                    disabled={busyId === id}
                    onClick={() => run(u, "add")}
                  >
                    {busyId === id
                      ? t("admin:betaUsers.adding")
                      : t("admin:betaUsers.add")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
