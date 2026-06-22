import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/shared/PasswordInput";
import GameTile from "../../components/shared/GameTile";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import ShowcaseCard from "./ShowcaseCard";
import {
  isValidPassword,
  getPasswordRequirements,
} from "../../utils/passwordValidation";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";
import { useBrandName } from "../../hooks/useBrandName";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();
  const brandName = useBrandName();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { showcase, seed } = useShowcaseTables();

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError(t("auth:reset.mismatch"));
      return;
    }
    if (!isValidPassword(form.password)) {
      setError(getPasswordRequirements());
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, token, form.password);
      sessionStorage.setItem(
        STORAGE_KEYS.FLASH_MESSAGE,
        t("auth:reset.flashSuccess"),
      );
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, t("auth:reset.errorFallback")));
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = !token || !email;

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
          {t("auth:reset.eyebrow")}
        </div>
        <h1 className={styles.heading}>{t("auth:reset.heading")}</h1>
        <p className={styles.sub}>{t("auth:reset.sub")}</p>

        {invalidLink ? (
          <>
            <div className={styles.errorBox}>{t("auth:reset.invalidLink")}</div>
            <p className={styles.switchLink}>
              <Link to="/recuperar-contrasenia">
                {t("auth:reset.requestNewLink")}
              </Link>
            </p>
          </>
        ) : (
          <>
            {error && <div className={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reset-password">
                  {t("auth:reset.newPasswordLabel")}
                </label>
                <PasswordInput
                  id="reset-password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder={t("auth:reset.newPasswordPlaceholder")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="reset-confirm">
                  {t("auth:reset.confirmLabel")}
                </label>
                <PasswordInput
                  id="reset-confirm"
                  name="confirm"
                  value={form.confirm}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder={t("auth:reset.confirmPlaceholder")}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  t("auth:reset.submitting")
                ) : (
                  <>
                    <span>🔒</span> {t("auth:reset.submit")}
                  </>
                )}
              </button>
            </form>

            <p className={styles.switchLink}>
              <Link to="/login">{t("auth:backToLogin")}</Link>
            </p>
          </>
        )}
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
