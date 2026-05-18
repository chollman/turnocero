import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from './PasswordInput';
import GameTile from '../../components/shared/GameTile';
import styles from './Auth.module.css';
import { ShowcaseCard } from './Login';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showcase, setShowcase] = useState(null);
  const [seed] = useState(() => Math.floor(Math.random() * 100));

  useEffect(() => {
    axios.get('/api/tables/showcase').then(({ data }) => setShowcase(data)).catch(() => {});
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (
      form.password.length < 8 ||
      !/[A-Z]/.test(form.password) ||
      !/\d/.test(form.password)
    ) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, token, form.password);
      sessionStorage.setItem('flashMessage', 'Contraseña actualizada. Iniciá sesión con la nueva.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = !token || !email;

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.logoBlock}>
          <div className={styles.logoIcon}>T</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </div>

        <div className={styles.mobileHero}>
          <GameTile game="TurnoCero" seed={seed} size="100%" />
          <div className={styles.mobileHeroFade} />
        </div>

        <div className={styles.eyebrow}>◆ NUEVA CONTRASEÑA</div>
        <h1 className={styles.heading}>Elegí una nueva contraseña.</h1>
        <p className={styles.sub}>
          Ingresá una contraseña segura para tu cuenta.
        </p>

        {invalidLink ? (
          <>
            <div className={styles.errorBox}>
              El link es inválido. Pedí uno nuevo para recuperar tu contraseña.
            </div>
            <p className={styles.switchLink}>
              <Link to="/recuperar-contrasenia">Pedir un link nuevo →</Link>
            </p>
          </>
        ) : (
          <>
            {error && <div className={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Nueva contraseña</label>
                <PasswordInput
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
                <label className={styles.label}>Confirmar contraseña</label>
                <PasswordInput
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
                {loading ? 'Guardando…' : <><span>🔒</span> Guardar contraseña</>}
              </button>
            </form>

            <p className={styles.switchLink}>
              <Link to="/login">← Volver al login</Link>
            </p>
          </>
        )}
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
