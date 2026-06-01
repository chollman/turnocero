import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "./PasswordInput";
import OAuthButtons from "./OAuthButtons";
import GameTile from "../../components/shared/GameTile";
import Logo from "../../components/shared/Logo";
import styles from "./Auth.module.css";
import { ShowcaseCard } from "./Login";
import {
  isValidPassword,
  PASSWORD_REQUIREMENTS,
} from "../../utils/passwordValidation";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useShowcaseTables } from "../../hooks/useShowcaseTables";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { showcase, seed } = useShowcaseTables();

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (!isValidPassword(form.password)) {
      setError(PASSWORD_REQUIREMENTS);
      return;
    }

    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate("/verificar-email", { state: { email: form.email } });
    } catch (err) {
      setError(getErrorMessage(err, "Error al registrarse"));
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
        <div className={styles.eyebrow}>◆ NUEVA CUENTA</div>
        <h1 className={styles.heading}>Empezá a jugar.</h1>
        <p className={styles.sub}>
          Creá tu perfil y encontrá tu próxima partida.
        </p>

        {/* Form */}
        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-username">
              Usuario
            </label>
            <input
              id="register-username"
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className={styles.input}
              placeholder="tu_nombre_de_jugador"
              required
              autoFocus
              minLength={3}
              maxLength={30}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">
              Contraseña
            </label>
            <PasswordInput
              id="register-password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Mín. 8 caracteres, 1 mayúscula y 1 número"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-confirm">
              Confirmar contraseña
            </label>
            <PasswordInput
              id="register-confirm"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              className={styles.input}
              placeholder="Repetí tu contraseña"
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              "Creando cuenta…"
            ) : (
              <>
                <span>🎲</span> Crear cuenta
              </>
            )}
          </button>
        </form>

        <OAuthButtons onError={setError} />

        <p className={styles.switchLink}>
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión →</Link>
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
