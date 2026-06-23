import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import styles from "./ViewAsUserBanner.module.css";

export default function ViewAsUserBanner() {
  const { t } = useTranslation();
  const { isActuallyAdmin, viewAsUser, setViewAsUser } = useAuth();

  if (!isActuallyAdmin || !viewAsUser) return null;

  return (
    <button
      className={styles.banner}
      onClick={() => setViewAsUser(false)}
      type="button"
    >
      {t("admin:viewBanner.label")}
    </button>
  );
}
