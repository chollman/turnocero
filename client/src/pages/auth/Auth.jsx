import Meeple from "../../components/shared/Meeple";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import OAuthButtons from "./OAuthButtons";
import AvatarColorPicker from "../../components/shared/AvatarColorPicker";
import AuthShowcaseScene from "./AuthShowcaseScene";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";
import { getLocationDisplay } from "../../utils/location";
import { getUserDisplay } from "../../utils/userDisplay";
import { getInitials } from "../../utils/initials";
import {
  isValidPassword,
  passwordStrength,
  STRENGTH_LABELS,
  PASSWORD_REQUIREMENTS,
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
  const weekday = d.toLocaleDateString("es-AR", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("es-AR", { month: "short" });
  const time = d.toLocaleTimeString("es-AR", {
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
        <Icon.Dice /> Mesa abierta cerca tuyo
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
          {open} {open === 1 ? "lugar" : "lugares"}
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
          <span className={styles.liveDot} /> En vivo · esta semana
        </div>
        <h2 className={styles.scHeadline}>
          {total > 0 ? (
            <>
              {total} mesas activas <em>esperando</em> jugadores.
            </>
          ) : (
            <>
              Tu próxima mesa <em>te espera.</em>
            </>
          )}
        </h2>
        {total > 0 && (
          <div className={styles.statStrip}>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statAccent}`}>
                {total}
              </span>
              <span className={styles.statLabel}>Mesas activas</span>
            </div>
            {table && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{openSeats(table)}</span>
                <span className={styles.statLabel}>Lugares libres</span>
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
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { loaded: siteConfigLoaded, isSectionEnabled } = useSiteConfig();

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
  const initial = (username.trim()[0] || "").toUpperCase();
  const canRegister =
    !loading &&
    username.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(email) &&
    isValidPassword(password) &&
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
      setError(getErrorMessage(err, "Error al iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidPassword(password)) {
      setError(PASSWORD_REQUIREMENTS);
      return;
    }
    if (!terms) {
      setError("Tenés que aceptar los términos para crear tu cuenta.");
      return;
    }
    setLoading(true);
    try {
      // El nombre para mostrar se setea después desde /perfil.
      await register(username, email, password, { avatarColor: color });
      navigate("/verificar-email", { state: { email } });
    } catch (err) {
      setError(getErrorMessage(err, "Error al registrarse"));
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
          <Logo className={styles.brandMark} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>TurnoCero</span>
            <span className={styles.brandSub}>
              <Meeple />
              board game meetups
            </span>
          </div>
        </div>

        {/* Toggle login / registro — debajo de la marca, pinneado al tope */}
        <div className={styles.switch} role="tablist" aria-label="Modo">
          <Link
            to="/login"
            role="tab"
            aria-selected={isLogin}
            className={`${styles.switchBtn} ${isLogin ? styles.switchActive : ""}`}
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            role="tab"
            aria-selected={!isLogin}
            className={`${styles.switchBtn} ${!isLogin ? styles.switchActive : ""}`}
          >
            Crear cuenta
          </Link>
        </div>

        {/* Resto del contenido — centrado vertical + horizontalmente */}
        <div className={styles.body}>
          {/* Mini-hero (sólo mobile, reemplaza al showcase) */}
          <div className={styles.mhero}>
            <div className={styles.scEyebrow}>
              <span className={styles.liveDot} /> En vivo · esta semana
            </div>
            <h2 className={styles.mheroHeadline}>
              {showcase?.total > 0 ? (
                <>
                  {showcase.total} mesas activas <em>en tu zona.</em>
                </>
              ) : (
                <>
                  Tu próxima mesa <em>te espera.</em>
                </>
              )}
            </h2>
          </div>

          <span className={styles.kicker}>
            <Meeple />
            {isLogin ? "Bienvenido de vuelta" : "Sumate a la comunidad"}
          </span>
          <h1 className={styles.title}>
            {isLogin ? (
              <>
                Volvé a la <em>mesa</em>.
              </>
            ) : (
              <>
                Armá tu <em>lugar</em>.
              </>
            )}
          </h1>
          <p className={styles.lede}>
            {isLogin
              ? "Sumate a tu próxima partida o convocá la tuya."
              : "Creá tu cuenta en un minuto y empezá a jugar con gente de tu zona."}
          </p>

          {error && <div className={styles.errorBox}>{error}</div>}
          {flash && <div className={styles.successBox}>{flash}</div>}

          {isLogin ? (
            <form onSubmit={handleLogin} className={styles.fields}>
              <div className={styles.fld}>
                <label htmlFor="auth-identifier">Usuario o email</label>
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
                    placeholder="tu@email.com"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <div className={styles.labelRow}>
                  <label htmlFor="auth-password">Contraseña</label>
                  <Link to="/recuperar-contrasenia" className={styles.forgot}>
                    ¿Olvidaste tu contraseña?
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
                      showPw ? "Ocultar contraseña" : "Mostrar contraseña"
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
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className={styles.fields}>
              <div className={styles.fld}>
                <label htmlFor="auth-username">Nombre de usuario</label>
                <div className={styles.inputWrap}>
                  <span className={styles.handlePrefix}>@</span>
                  <input
                    id="auth-username"
                    className={`${styles.inp} ${styles.inpHandle}`}
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.replace(/\s/g, "").toLowerCase(),
                      )
                    }
                    placeholder="BlackwatchGames"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <label htmlFor="auth-email">Email</label>
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
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className={styles.fld}>
                <label htmlFor="auth-reg-password">Contraseña</label>
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
                    placeholder="Mín. 8 caracteres, 1 mayúscula y 1 número"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={
                      showPw ? "Ocultar contraseña" : "Mostrar contraseña"
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
                      Seguridad: {STRENGTH_LABELS[strength] || "muy débil"}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.fld}>
                <label>Tu avatar</label>
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
                  Acepto los{" "}
                  <span className={styles.termsAccent}>términos</span> y la{" "}
                  <span className={styles.termsAccent}>
                    política de privacidad
                  </span>{" "}
                  de TurnoCero.
                </span>
              </label>

              <button
                type="submit"
                className={styles.submit}
                disabled={!canRegister}
              >
                <Icon.Dice />
                {loading ? "Creando cuenta…" : "Crear mi cuenta"}
              </button>
            </form>
          )}

          <OAuthButtons onError={setError} />

          <p className={styles.footLine}>
            {isLogin ? (
              <>
                ¿Todavía no tenés cuenta?{" "}
                <Link to="/register">Crear cuenta →</Link>
              </>
            ) : (
              <>
                ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión →</Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Right · showcase (desktop only) ── */}
      <Showcase showcase={showcase} />
    </div>
  );
}
