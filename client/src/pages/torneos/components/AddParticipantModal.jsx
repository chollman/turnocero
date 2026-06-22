import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import useDebouncedValue from "../../../hooks/useDebouncedValue";
import { API } from "../../../api/endpoints";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import ModalPortal from "../../../components/shared/ModalPortal";
import styles from "../TorneoDetail.module.css";

export default function AddParticipantModal({ torneo, onClose, onChange }) {
  const { t } = useTranslation("torneos");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState("");

  const participantIds = new Set(
    (torneo.participants || []).map((p) => String(p._id || p)),
  );
  const pendingIds = new Set(
    (torneo.pendingRegistrations || []).map((r) =>
      String(r.user?._id || r.user),
    ),
  );
  const cupoLleno =
    torneo.maxParticipants &&
    (torneo.participants?.length || 0) >= torneo.maxParticipants;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(API.users.LIST, {
          params: debouncedSearch ? { search: debouncedSearch } : {},
        });
        if (!cancelled) setResults(data || []);
      } catch (err) {
        if (!cancelled)
          setError(err.response?.data?.message || t("addParticipant.errorSearch"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, t]);

  const addUser = async (userId) => {
    setAdding(userId);
    setError("");
    try {
      const { data } = await axios.post(
        API.torneos.PARTICIPANT(torneo._id, userId),
      );
      onChange(data);
    } catch (err) {
      setError(err.response?.data?.message || t("addParticipant.errorAdd"));
    } finally {
      setAdding(null);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div
          className={`${styles.modalCard} ${styles.modalCardWide}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{t("addParticipant.title")}</h3>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label={t("addParticipant.close")}
            >
              ✕
            </button>
          </div>

          <p className={styles.modalSub}>
            {t("addParticipant.sub")}{" "}
            {cupoLleno && t("addParticipant.subFull")}
          </p>

          <input
            autoFocus
            className={styles.fieldInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("addParticipant.searchPlaceholder")}
          />

          {error && <p className={styles.errorMsg}>{error}</p>}

          {loading && results.length === 0 ? (
            <p className={styles.emptyMsg}>{t("addParticipant.searching")}</p>
          ) : results.length === 0 ? (
            <p className={styles.emptyMsg}>{t("addParticipant.noResults")}</p>
          ) : (
            <ul className={styles.userPickList}>
              {results.map((u) => {
                const id = String(u._id);
                const info = getUserDisplay(u);
                const already = participantIds.has(id);
                const pending = pendingIds.has(id);
                return (
                  <li key={id} className={styles.userPickItem}>
                    <span className={styles.userPickName}>
                      {info.isDeleted ? (
                        <span className={styles.deletedTxt}>
                          {t("addParticipant.deletedUser")}
                        </span>
                      ) : (
                        <UserRef user={u} noLink />
                      )}
                      {u.username && (
                        <span className={styles.userPickHandle}>
                          @{u.username}
                        </span>
                      )}
                    </span>
                    {already ? (
                      <span className={styles.userPickAdded}>
                        {t("addParticipant.alreadyIn")}
                      </span>
                    ) : pending ? (
                      <button
                        className={styles.userPickAddBtn}
                        onClick={() => addUser(id)}
                        disabled={!!adding || cupoLleno}
                      >
                        {adding === id
                          ? t("addParticipant.adding")
                          : t("addParticipant.approveAndAdd")}
                      </button>
                    ) : (
                      <button
                        className={styles.userPickAddBtn}
                        onClick={() => addUser(id)}
                        disabled={!!adding || cupoLleno}
                      >
                        {adding === id
                          ? t("addParticipant.adding")
                          : t("addParticipant.add")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.modalActions}>
            <button className={styles.btnGhost} onClick={onClose}>
              {t("addParticipant.close")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
