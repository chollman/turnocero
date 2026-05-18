import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import GameTile from '../../components/shared/GameTile';
import styles from './Auth.module.css';
import { ShowcaseCard } from './Login';

const PENDING_EMAIL_KEY = 'turnocero_pending_verify_email';
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { verifyEmail, requestEmailVerification } = useAuth();

  const stateEmail = location.state?.email;
  const queryEmail = searchParams.get('email');
  const storedEmail = typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_EMAIL_KEY) : '';
  const initialEmail = stateEmail || queryEmail || storedEmail || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showcase, setShowcase] = useState(null);
  const [seed] = useState(() => Math.floor(Math.random() * 100));

  const cooldownTimer = useRef(null);

  useEffect(() => {
    if (initialEmail) {
      sessionStorage.setItem(PENDING_EMAIL_KEY, initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    axios.get('/api/tables/showcase').then(({ data }) => setShowcase(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownTimer.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(cooldownTimer.current);
  }, [cooldown]);

  const handleCodeChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Necesitamos tu email. Volvé a crear la cuenta o iniciá sesión.');
      return;
    }
    if (code.length !== 6) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(email, code);
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos verificar tu email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    if (!email) {
      setError('Necesitamos tu email para reenviar el código.');
      return;
    }
    setResending(true);
    try {
      await requestEmailVerification(email);
      setSuccess('Si la cuenta existe y no está verificada, te enviamos un código nuevo.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.max(b.length, 1)) + c)
    : '';

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

        <div className={styles.eyebrow}>◆ VERIFICÁ TU EMAIL</div>
        <h1 className={styles.heading}>Un último paso.</h1>
        <p className={styles.sub}>
          Te enviamos un código de 6 dígitos
          {maskedEmail ? <> a <strong>{maskedEmail}</strong></> : ''}.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}
        {success && <div className={styles.successBox}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {!stateEmail && !queryEmail && (
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="tu@email.com"
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Código</label>
            <input
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

          <button type="submit" className={styles.submitBtn} disabled={loading || code.length !== 6}>
            {loading ? 'Verificando…' : <><span>✓</span> Verificar</>}
          </button>
        </form>

        <div className={styles.helpRow}>
          <span>
            ¿No te llegó?{' '}
            <button
              type="button"
              onClick={handleResend}
              className={styles.linkBtn}
              disabled={resending || cooldown > 0}
            >
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : resending ? 'Enviando…' : 'Reenviar código'}
            </button>
          </span>
          <span>
            <Link to="/login" style={{ color: 'var(--text-secondary)' }}>← Volver al login</Link>
          </span>
        </div>
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
