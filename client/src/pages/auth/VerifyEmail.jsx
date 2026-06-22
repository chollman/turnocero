import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import GameTile from "../../components/shared/GameTile";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import ShowcaseCard from "./ShowcaseCard";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";
import { useBrandName } from "../../hooks/useBrandName";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { verifyEmail, requestEmailVerification } = useAuth();
  const brandName = useBrandName();

  const stateEmail = location.state?.email;
  const queryEmail = searchParams.get("email");
  const storedEmail =
    typeof window !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEYS.PENDING_VERIFY_EMAIL)
      : "";
  const initialEmail = stateEmail || queryEmail || storedEmail || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { showcase, seed } = useShowcaseTables();

  const cooldownTimer = useRef(null);

  useEffect(() => {
    if (initialEmail) {
      sessionStorage.setItem(STORAGE_KEYS.PENDING_VERIFY_EMAIL, initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownTimer.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(cooldownTimer.current);
  }, [cooldown]);

  const handleCodeChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(cleaned);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError(t("auth:verify.errEmailMissing"));
      return;
    }
    if (code.length !== 6) {
      setError(t("auth:verify.errCodeLength"));
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(email, code);
      sessionStorage.removeItem(STORAGE_KEYS.PENDING_VERIFY_EMAIL);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, t("auth:verify.errVerifyFallback")));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");
    if (!email) {
      setError(t("auth:verify.errResendMissing"));
      return;
    }
    setResending(true);
    try {
      await requestEmailVerification(email);
      setSuccess(t("auth:verify.resendSuccess"));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err, t("auth:verify.errResendFallback")));
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(
        /^(.)(.*)(@.*)$/,
        (_, a, b, c) => a + "•".repeat(Math.max(b.length, 1)) + c,
      )
    : "";

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
          {t("auth:verify.eyebrow")}
        </div>
        <h1 className={styles.heading}>{t("auth:verify.heading")}</h1>
        <p className={styles.sub}>
          {maskedEmail ? (
            <Trans
              i18nKey="auth:verify.sub"
              values={{ email: maskedEmail }}
              components={[<span key="0" />, <strong key="1" />]}
            />
          ) : (
            t("auth:verify.subNoEmail")
          )}
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}
        {success && <div className={styles.successBox}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {!stateEmail && !queryEmail && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="verify-email">
                {t("auth:emailLabel")}
              </label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder={t("auth:emailPlaceholder")}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="verify-code">
              {t("auth:verify.codeLabel")}
            </label>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={handleCodeChange}
              className={styles.codeInput}
              placeholder="••••••"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              t("auth:verify.submitting")
            ) : (
              <>
                <span>✓</span> {t("auth:verify.submit")}
              </>
            )}
          </button>
        </form>

        <div className={styles.helpRow}>
          <span>
            {t("auth:verify.resendQuestion")}{" "}
            <button
              type="button"
              onClick={handleResend}
              className={styles.linkBtn}
              disabled={resending || cooldown > 0}
            >
              {cooldown > 0
                ? t("auth:verify.resendCooldown", { seconds: cooldown })
                : resending
                  ? t("auth:verify.resending")
                  : t("auth:verify.resendCta")}
            </button>
          </span>
          <span>
            <Link to="/login" style={{ color: "var(--text-secondary)" }}>
              {t("auth:backToLogin")}
            </Link>
          </span>
        </div>
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
