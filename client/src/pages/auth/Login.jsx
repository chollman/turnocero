import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import PasswordInput from "./PasswordInput";
import GameTile from "../../components/shared/GameTile";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";

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

export function ShowcaseCard({ table }) {
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;
  const available = total - filled;
  const pct = Math.min(100, (filled / total) * 100);
  return (
    <div className={styles.showcaseCard}>
      <div className={styles.showcaseCardGame}>{table.boardGame}</div>
      <div className={styles.showcaseCardMeta}>
        {table.host.username}
        {table.location ? ` · ${table.location}` : ""}
      </div>
      <div className={styles.showcaseCardBar}>
        <div className={styles.showcaseCardFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.showcaseCardFooter}>
        <span className={styles.showcaseCardSeats}>
          ● {available} lugar{available !== 1 ? "es" : ""}
        </span>
        <span className={styles.showcaseCardDate}>
          {formatShowcaseDate(table.date)}
        </span>
      </div>
    </div>
  );
}

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { loaded: siteConfigLoaded, isSectionEnabled } = useSiteConfig();
  const navigate = useNavigate();
  // Login es la única auth page que suprime el fetch cuando la sección
  // 'mesas' está deshabilitada (site-wide setting de admin). Pasamos
  // `enabled` al hook para no disparar el request hasta que el guard
  // esté satisfecho.
  const showcaseEnabled = siteConfigLoaded && isSectionEnabled("mesas");
  const { showcase, seed } = useShowcaseTables({ enabled: showcaseEnabled });

  useEffect(() => {
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
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFlash("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "email_not_verified") {
        navigate("/verificar-email", {
          state: { email: data.email || form.email },
        });
        return;
      }
      setError(getErrorMessage(err, "Error al iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Left / main panel ── */}
      <div className={styles.panel}>
        {/* Logo */}
        <div className={styles.logoBlock}>
          <Logo className={styles.logoIcon} />
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </div>

        {/* Mobile hero tile */}
        <div className={styles.mobileHero}>
          <GameTile game="TurnoCero" seed={seed} size="100%" />
          <div className={styles.mobileHeroFade} />
        </div>

        {/* Heading */}
        <div className={styles.eyebrow}>◆ BIENVENIDO DE VUELTA</div>
        <h1 className={styles.heading}>Tirá los dados.</h1>
        <p className={styles.sub}>
          Sumate a tu próxima partida o convocá la tuya.
        </p>

        {/* Form */}
        {error && <div className={styles.errorBox}>{error}</div>}
        {flash && <div className={styles.successBox}>{flash}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Usuario o email
            </label>
            <input
              id="login-email"
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="tu@email.com"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Contraseña
            </label>
            <PasswordInput
              id="login-password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className={styles.forgotRow}>
            <Link to="/recuperar-contrasenia">¿Olvidaste tu contraseña?</Link>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              "Entrando…"
            ) : (
              <>
                <span>🎲</span> Entrar
              </>
            )}
          </button>
        </form>

        <p className={styles.switchLink}>
          ¿No tenés cuenta? <Link to="/register">Crear cuenta →</Link>
        </p>
      </div>

      {/* ── Right: showcase (desktop only) ── */}
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
            <div className={styles.showcaseEyebrow}>◆ MESAS ACTIVAS</div>
            {showcase?.total > 0 ? (
              <h2 className={styles.showcaseTitle}>
                {showcase.total} mesas
                <br />
                <span className={styles.showcaseTitleAccent}>
                  esperando jugadores.
                </span>
              </h2>
            ) : (
              <h2 className={styles.showcaseTitle}>
                ¿Y vos qué
                <br />
                <span className={styles.showcaseTitleAccent}>
                  esperás para sumarte?
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
