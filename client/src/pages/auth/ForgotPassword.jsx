import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import GameTile from '../../components/shared/GameTile';
import Logo from '../../components/shared/Logo';
import styles from './Auth.module.css';
import { ShowcaseCard } from './Login';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useShowcaseTables } from '../../hooks/useShowcaseTables';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { showcase, seed } = useShowcaseTables();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos procesar el pedido.'));
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
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </div>

        <div className={styles.mobileHero}>
          <GameTile game="TurnoCero" seed={seed} size="100%" />
          <div className={styles.mobileHeroFade} />
        </div>

        <div className={styles.eyebrow}>◆ RECUPERAR ACCESO</div>
        <h1 className={styles.heading}>¿Olvidaste tu contraseña?</h1>
        <p className={styles.sub}>
          Pasanos tu email y te mandamos un link para elegir una nueva.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {submitted ? (
          <div className={styles.infoBox}>
            Si existe una cuenta con ese email, te enviamos un link para recuperar la contraseña.
            <br />
            Revisá tu bandeja de entrada (y la carpeta de spam por las dudas).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="tu@email.com"
                required
                autoFocus
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
              {loading ? 'Enviando…' : <><span>📧</span> Enviar link</>}
            </button>
          </form>
        )}

        <p className={styles.switchLink}>
          <Link to="/login">← Volver al login</Link>
        </p>
      </div>

      <div className={styles.showcase}>
        <div className={styles.showcaseTile}>
          <GameTile game={showcase?.table?.boardGame || 'TurnoCero'} seed={seed} size="100%" />
        </div>
        <div className={styles.showcaseGradient} />
        <div className={styles.showcaseContent}>
          <div>
            <div className={styles.showcaseEyebrow}>◆ MESAS ACTIVAS</div>
            {showcase?.total > 0 ? (
              <h2 className={styles.showcaseTitle}>
                {showcase.total} mesas
                <br />
                <span className={styles.showcaseTitleAccent}>esperando jugadores.</span>
              </h2>
            ) : (
              <h2 className={styles.showcaseTitle}>
                Tu próxima
                <br />
                <span className={styles.showcaseTitleAccent}>partida te espera.</span>
              </h2>
            )}
          </div>
          {showcase?.table && <ShowcaseCard table={showcase.table} />}
        </div>
      </div>
    </div>
  );
}
