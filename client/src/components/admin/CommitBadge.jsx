import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import styles from "./CommitBadge.module.css";

export default function CommitBadge() {
  const { t } = useTranslation();
  const { isActuallyAdmin } = useAuth();

  if (!isActuallyAdmin) return null;

  return (
    <div
      className={styles.badge}
      title={t("admin:commitBadge.title", { count: __COMMIT_COUNT__ })}
    >
      #{__COMMIT_COUNT__}
    </div>
  );
}
