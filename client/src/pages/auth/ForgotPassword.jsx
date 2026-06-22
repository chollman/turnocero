import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import GameTile from "../../components/shared/GameTile";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import ShowcaseCard from "./ShowcaseCard";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";
import { useBrandName } from "../../hooks/useBrandName";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const brandName = useBrandName();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { showcase, seed } = useShowcaseTables();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, t("auth:forgot.errorFallback")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.logoBlock}>
          <Logo className={styles.logoIcon} />
          <div className={styles.logoText}>
            <span className={styles.logoName}>{brandName}</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </div>

        <div className={styles.mobileHero}>
          <GameTile game="TurnoCero" seed={seed} size="100%" />
          <div className={styles.mobileHeroFade} />
        </div>

        <div className={styles.eyebrow}>
          <Meeple />
          {t("auth:forgot.eyebrow")}
        </div>
        <h1 className={styles.heading}>{t("auth:forgot.heading")}</h1>
        <p className={styles.sub}>{t("auth:forgot.sub")}</p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {submitted ? (
          <div className={styles.infoBox}>
            {t("auth:forgot.successLine1")}
            <br />
            {t("auth:forgot.successLine2")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-email">
                {t("auth:emailLabel")}
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder={t("auth:emailPlaceholder")}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !email}
            >
              {loading ? (
                t("auth:forgot.submitting")
              ) : (
                <>
                  <span>📧</span> {t("auth:forgot.submit")}
                </>
              )}
            </button>
          </form>
        )}

        <p className={styles.switchLink}>
          <Link to="/login">{t("auth:backToLogin")}</Link>
        </p>
      </div>

      <div className={styles.showcase}>
        <div className={styles.showcaseTile}>
          <GameTile
            game={showcase?.table?.boardGame || "TurnoCero"}
            seed={seed}
            size="100%"
          />
        </div>
        <div className={styles.showcaseGradient} />
        <div className={styles.showcaseContent}>
          <div>
            <div className={styles.showcaseEyebrow}>
              <Meeple />
              {t("auth:showcase.activeTables")}
            </div>
            {showcase?.total > 0 ? (
              <h2 className={styles.showcaseTitle}>
                {t("auth:showcase.tablesCount", { count: showcase.total })}
                <br />
                <span className={styles.showcaseTitleAccent}>
                  {t("auth:showcase.waitingPlayers")}
                </span>
              </h2>
            ) : (
              <h2 className={styles.showcaseTitle}>
                {t("auth:showcase.nextTitle")}
                <br />
                <span className={styles.showcaseTitleAccent}>
                  {t("auth:showcase.nextAccent")}
                </span>
              </h2>
            )}
          </div>
          {showcase?.table && <ShowcaseCard table={showcase.table} />}
        </div>
      </div>
    </div>
  );
}
