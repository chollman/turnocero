import Meeple from "../../components/shared/Meeple";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import OAuthButtons from "./OAuthButtons";
import AvatarColorPicker from "../../components/shared/AvatarColorPicker";
import AuthShowcaseScene from "./AuthShowcaseScene";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";
import { getLocale } from "../../utils/locale";
import { getLocationDisplay } from "../../utils/location";
import { getUserDisplay } from "../../utils/userDisplay";
import { getInitials } from "../../utils/initials";
import {
  isValidPassword,
  passwordChecks,
  passwordStrength,
  getStrengthLabels,
  getPasswordRequirements,
} from "../../utils/passwordValidation";

// ─── Inline icons (no icon libs — patrón del repo) ───────────────
const Icon = {
  Mail: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  ),
  Lock: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Eye: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Dice: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" />
    </svg>
  ),
  Check: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

// ─── Showcase preview card (datos reales de una mesa abierta) ─────
function formatShowcaseDate(dateStr) {
  const d = new Date(dateStr);
  const locale = getLocale();
  const weekday = d.toLocaleDateString(locale, { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString(locale, { month: "short" });
  const time = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${weekday} ${day} ${month} · ${time}`.replace(/\./g, "");
}

function openSeats(table) {
  return Math.max(0, table.maxPlayers + 1 - (table.players.length + 1));
}

export function PreviewCard({ table }) {
  const { t } = useTranslation();
  const host = getUserDisplay(table.host);
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;
  const open = openSeats(table);
  const pct = Math.min(100, (filled / total) * 100);
  const loc = getLocationDisplay(table.location, "city");
  const hostColor = host.avatar?.color?.startsWith("--")
    ? host.avatar.color
    : "--amber";

  return (
    <div className={styles.previewCard} key={table._id || table.boardGame}>
      <div className={styles.previewLabel}>
        <Icon.Dice /> {t("auth:showcaseHome.previewLabel")}
      </div>
      <div className={styles.previewHead}>
        <div
          className={styles.previewAv}
          style={{ background: `var(${hostColor})` }}
        >
          {host.avatar?.url ? (
            <img src={host.avatar.url} alt="" />
          ) : (
            getInitials(host)
          )}
        </div>
        <div className={styles.previewInfo}>
          <div className={styles.previewGame}>{table.boardGame}</div>
          <div className={styles.previewMeta}>
            {host.name}
            {loc ? ` · ${loc}` : ""}
          </div>
        </div>
      </div>
      <div className={styles.previewSeatTrack}>
        <div className={styles.previewSeatFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.previewFoot}>
        <span className={styles.previewSeats}>
          {t("auth:showcaseHome.seats", { count: open })}
        </span>
        <span className={styles.previewWhen}>
          {formatShowcaseDate(table.date)}
        </span>
      </div>
    </div>
  );
}

// ─── Showcase pane (derecha) — escena SVG + datos reales ─────────
function Showcase({ showcase }) {
  const { t } = useTranslation();
  const total = showcase?.total || 0;
  const table = showcase?.table || null;

  return (
    <div className={styles.showcasePane}>
      <div className={styles.scImg}>
        <AuthShowcaseScene />
      </div>
      <div className={styles.scVignette} />

      <div className={styles.scTop}>
        <div className={styles.scEyebrow}>
          <span className={styles.liveDot} /> {t("auth:showcaseHome.live")}
        </div>
        <h2 className={styles.scHeadline}>
          {total > 0 ? (
            <Trans
              i18nKey="auth:showcaseHome.headlineActive"
              values={{ count: total }}
              components={[<span key="0" />, <em key="1" />]}
            />
          ) : (
            <Trans
              i18nKey="auth:showcaseHome.headlineEmpty"
              components={[<span key="0" />, <em key="1" />]}
            />
          )}
        </h2>
        {total > 0 && (
          <div className={styles.statStrip}>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statAccent}`}>
                {total}
              </span>
              <span className={styles.statLabel}>
                {t("auth:showcaseHome.statActive")}
              </span>
            </div>
            {table && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{openSeats(table)}</span>
                <span className={styles.statLabel}>
                  {t("auth:showcaseHome.statFree")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {table && <PreviewCard table={table} />}
    </div>
  );
}

// ─── Pantalla de auth (login + registro en un solo componente) ───
export default function Auth({ mode }) {
  const { t } = useTranslation();
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { loaded: siteConfigLoaded, isSectionEnabled } = useSiteConfig();
  // En modo tenant (subdominio / ?tenant) la marca del login es la de la
  // comunidad: logo + nombre propios en vez de los de TurnoCero.
  const { isTenant, brand } = useCommunity();

  // El showcase sólo se busca si la sección 'mesas' está habilitada site-wide.
  const showcaseEnabled = siteConfigLoaded && isSectionEnabled("mesas");
  const { showcase } = useShowcaseTables({
    enabled: showcaseEnabled,
    refreshMs: 5000,
  });

  // ── Estado de campos ──
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [color, setColor] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);

  // Mensajes de baneo / flash (sólo en login, vienen de un redirect previo).
  useEffect(() => {
    if (!isLogin) return;
    const bannedMsg = sessionStorage.getItem(STORAGE_KEYS.BANNED_MESSAGE);
    if (bannedMsg) {
      setError(bannedMsg);
      sessionStorage.removeItem(STORAGE_KEYS.BANNED_MESSAGE);
    }
    const flashMsg = sessionStorage.getItem(STORAGE_KEYS.FLASH_MESSAGE);
    if (flashMsg) {
      setFlash(flashMsg);
      sessionStorage.removeItem(STORAGE_KEYS.FLASH_MESSAGE);
    }
  }, [isLogin]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const pwChecks = useMemo(() => passwordChecks(password), [password]);
  const pwValid = useMemo(() => isValidPassword(password), [password]);
  const initial = (username.trim()[0] || "").toUpperCase();
  const canRegister =
    !loading &&
    username.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(email) &&
    pwValid &&
    terms;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setFlash("");
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "email_not_verified") {
        navigate("/verificar-email", {
          state: { email: data.email || identifier },
        });
        return;
      }
      setError(getErrorMessage(err, t("auth:login.errorFallback")));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidPassword(password)) {
      setError(getPasswordRequirements());
      return;
    }
    if (!terms) {
      setError(t("auth:register.termsRequired"));
      return;
    }
    setLoading(true);
    try {
      // El nombre para mostrar se setea después desde /perfil.
      await register(username, email, password, { avatarColor: color });
      navigate("/verificar-email", { state: { email } });
    } catch (err) {
      setError(getErrorMessage(err, t("auth:register.errorFallback")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stage}>
      {/* ── Left · form ── */}
      <div className={styles.formPane}>
        {/* Marca — arriba de todo */}
        <div className={styles.brand}>
          <Logo
            className={styles.brandMark}
            alt={brand.name}
            srcLight={isTenant ? brand.logoLight : undefined}
            srcDark={isTenant ? brand.logoDark : undefined}
          />
          <div className={styles.brandText}>
            <span className={styles.brandName}>
              {isTenant ? brand.name : "TurnoCero"}
            </span>
            <span className={styles.brandSub}>
              <Meeple />
              {isTenant && brand.tagline ? brand.tagline : "board game meetups"}
            </span>
          </div>
        </div>

        {/* Toggle login / registro — debajo de la marca, pinneado al tope */}
        <div
          className={styles.switch}
          role="tablist"
          aria-label={t("auth:tabs.aria")}
        >
          <Link
            to="/login"
            role="tab"
            aria-selected={isLogin}
            className={`${styles.switchBtn} ${isLogin ? styles.switchActive : ""}`}
          >
            {t("auth:tabs.login")}
          </Link>
          <Link
            to="/register"
            role="tab"
            aria-selected={!isLogin}
            className={`${styles.switchBtn} ${!isLogin ? styles.switchActive : ""}`}
          >
            {t("auth:tabs.register")}
          </Link>
        </div>

        {/* Resto del contenido — centrado vertical + horizontalmente */}
        <div className={styles.body}>
          {/* Mini-hero (sólo mobile, reemplaza al showcase) */}
          <div className={styles.mhero}>
            <div className={styles.scEyebrow}>
              <span className={styles.liveDot} /> {t("auth:showcaseHome.live")}
            </div>
            <h2 className={styles.mheroHeadline}>
              {showcase?.total > 0 ? (
                <Trans
                  i18nKey="auth:showcaseHome.mheroActive"
                  values={{ count: showcase.total }}
                  components={[<span key="0" />, <em key="1" />]}
                />
              ) : (
                <Trans
                  i18nKey="auth:showcaseHome.headlineEmpty"
                  components={[<span key="0" />, <em key="1" />]}
                />
              )}
            </h2>
          </div>

          <span className={styles.kicker}>
            <Meeple />
            {isLogin ? t("auth:login.kicker") : t("auth:register.kicker")}
          </span>
          <h1 className={styles.title}>
            {isLogin ? (
              <Trans
                i18nKey="auth:login.title"
                components={[<span key="0" />, <em key="1" />]}
              />
            ) : (
              <Trans
                i18nKey="auth:register.title"
                components={[<span key="0" />, <em key="1" />]}
              />
            )}
          </h1>
          <p className={styles.lede}>
            {isLogin ? t("auth:login.lede") : t("auth:register.lede")}
          </p>

          {error && <div className={styles.errorBox}>{error}</div>}
          {flash && <div className={styles.successBox}>{flash}</div>}

          {isLogin ? (
            <form onSubmit={handleLogin} className={styles.fields}>
              <div className={styles.fld}>
                <label htmlFor="auth-identifier">
                  {t("auth:login.identifierLabel")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.lead}>
                    <Icon.Mail />
                  </span>
                  <input
                    id="auth-identifier"
                    className={styles.inp}
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t("auth:login.identifierPlaceholder")}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <div className={styles.labelRow}>
                  <label htmlFor="auth-password">
                    {t("auth:login.passwordLabel")}
                  </label>
                  <Link to="/recuperar-contrasenia" className={styles.forgot}>
                    {t("auth:login.forgotLink")}
                  </Link>
                </div>
                <div className={styles.inputWrap}>
                  <span className={styles.lead}>
                    <Icon.Lock />
                  </span>
                  <input
                    id="auth-password"
                    className={styles.inp}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={
                      showPw
                        ? t("auth:pwToggleHide")
                        : t("auth:pwToggleShow")
                    }
                  >
                    {showPw ? <Icon.EyeOff /> : <Icon.Eye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={styles.submit}
                disabled={loading}
              >
                <Icon.Dice />
                {loading ? t("auth:login.submitting") : t("auth:login.submit")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className={styles.fields}>
              <div className={styles.fld}>
                <label htmlFor="auth-username">
                  {t("auth:register.usernameLabel")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.handlePrefix}>@</span>
                  <input
                    id="auth-username"
                    className={`${styles.inp} ${styles.inpHandle}`}
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/\s/g, ""))
                    }
                    placeholder={t("auth:register.usernamePlaceholder")}
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <label htmlFor="auth-email">{t("auth:emailLabel")}</label>
                <div className={styles.inputWrap}>
                  <span className={styles.lead}>
                    <Icon.Mail />
                  </span>
                  <input
                    id="auth-email"
                    className={styles.inp}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth:emailPlaceholder")}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <label htmlFor="auth-reg-password">
                  {t("auth:register.passwordLabel")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.lead}>
                    <Icon.Lock />
                  </span>
                  <input
                    id="auth-reg-password"
                    className={styles.inp}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth:reset.newPasswordPlaceholder")}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={
                      showPw
                        ? t("auth:pwToggleHide")
                        : t("auth:pwToggleShow")
                    }
                  >
                    {showPw ? <Icon.EyeOff /> : <Icon.Eye />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className={styles.strength}>
                    <div className={styles.strengthBars}>
                      {[1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className={`${styles.strengthBar} ${
                            strength >= n ? styles[`on${strength}`] : ""
                          }`}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel}>
                      {t("auth:register.strengthLabel", {
                        label:
                          getStrengthLabels()[strength] ||
                          t("auth:register.strengthVeryWeak"),
                      })}
                    </span>
                  </div>
                )}
                {password.length > 0 && !pwValid && (
                  <ul
                    className={styles.pwReqs}
                    aria-live="polite"
                    aria-label={t("auth:register.pwReqsAria")}
                  >
                    {pwChecks.map((c) => (
                      <li
                        key={c.key}
                        className={`${styles.pwReq} ${
                          c.met ? styles.pwReqMet : ""
                        }`}
                      >
                        <span className={styles.pwReqIcon} aria-hidden="true">
                          {c.met ? (
                            <Icon.Check />
                          ) : (
                            <span className={styles.pwReqDot} />
                          )}
                        </span>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.fld}>
                <label>{t("auth:register.avatarLabel")}</label>
                <AvatarColorPicker
                  value={color}
                  onChange={setColor}
                  initial={initial}
                />
              </div>

              <label className={styles.terms}>
                <input
                  type="checkbox"
                  className={styles.checkInput}
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span className={styles.checkBox} aria-hidden="true">
                  <Icon.Check />
                </span>
                <span>
                  <Trans
                    i18nKey="auth:register.terms"
                    components={[
                      <span key="0" />,
                      <Link
                        key="1"
                        to="/terminos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.termsAccent}
                        onClick={(e) => e.stopPropagation()}
                      />,
                      <span key="2" />,
                      <Link
                        key="3"
                        to="/privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.termsAccent}
                        onClick={(e) => e.stopPropagation()}
                      />,
                    ]}
                  />
                </span>
              </label>

              <button
                type="submit"
                className={styles.submit}
                disabled={!canRegister}
              >
                <Icon.Dice />
                {loading
                  ? t("auth:register.submitting")
                  : t("auth:register.submit")}
              </button>
            </form>
          )}

          <OAuthButtons onError={setError} />

          <p className={styles.footLine}>
            {isLogin ? (
              <Trans
                i18nKey="auth:login.footLine"
                components={[<span key="0" />, <Link key="1" to="/register" />]}
              />
            ) : (
              <Trans
                i18nKey="auth:register.footLine"
                components={[<span key="0" />, <Link key="1" to="/login" />]}
              />
            )}
          </p>
        </div>
      </div>

      {/* ── Right · showcase (desktop only) ── */}
      <Showcase showcase={showcase} />
    </div>
  );
}
