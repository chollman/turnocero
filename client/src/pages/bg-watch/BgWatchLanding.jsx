import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./BgWatchLanding.module.css";

const DieIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

const PlayIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const CollectionIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const StatsIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const FEATURES = [
  {
    Icon: PlayIcon,
    title: "Registrá tus partidas",
    body: "Cargá, editá y eliminá partidas directamente desde Turnocero. Se sincronizan con tu cuenta de BoardGameGeek.",
  },
  {
    Icon: CollectionIcon,
    title: "Tu colección, siempre a mano",
    body: "Mirá los juegos que tenés, con ratings, cantidad de partidas jugadas y miniaturas.",
  },
  {
    Icon: StatsIcon,
    title: "Una vista por juego",
    body: "Filtrá tu historial de partidas por título, con score, posición, jugadores y notas de cada sesión.",
  },
];

export default function BgWatchLanding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // If a logged-in user has BG Watch active, jump them straight to their profile.
  useEffect(() => {
    if (loading) return;
    if (user?.bggUsername) {
      navigate(`/bg-watch/${user.bggUsername}`, { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return null;
  if (user?.bggUsername) return null; // about to redirect

  const isLoggedIn = !!user;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}>
          <DieIcon />
        </div>
        <div className={styles.eyebrow}>◆ BG WATCH</div>
        <h1 className={styles.heroTitle}>Llevá tus partidas como nunca</h1>
        <p className={styles.heroSub}>
          BG Watch es el tracker de partidas de Turnocero. Conectá tu cuenta de
          BoardGameGeek y registrá, editá y explorá todo lo que jugaste — sin
          salir del app.
        </p>
      </header>

      <section className={styles.features}>
        {FEATURES.map(({ Icon, title, body }) => (
          <article key={title} className={styles.feature}>
            <div className={styles.featureIcon}>
              <Icon />
            </div>
            <h3 className={styles.featureTitle}>{title}</h3>
            <p className={styles.featureBody}>{body}</p>
          </article>
        ))}
      </section>

      <section className={styles.ctaCard}>
        {isLoggedIn ? (
          <>
            <h2 className={styles.ctaTitle}>Activá BG Watch ahora</h2>
            <p className={styles.ctaSub}>
              Andá a tu perfil, cargá tu usuario de BoardGameGeek y conectá tu
              cuenta para empezar a registrar partidas.
            </p>
            <Link to="/perfil#conexion-bgg" className={styles.ctaButton}>
              Ir a Mi perfil
            </Link>
            <p className={styles.ctaFinePrint}>
              ¿Todavía no tenés cuenta en BoardGameGeek?{" "}
              <a
                href="https://boardgamegeek.com/register"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ctaLink}
              >
                Crear una en BGG.com →
              </a>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.ctaTitle}>Creá tu cuenta y empezá</h2>
            <p className={styles.ctaSub}>
              Registrate gratis en Turnocero y conectá tu cuenta de
              BoardGameGeek desde tu perfil. Es rápido.
            </p>
            <div className={styles.ctaButtons}>
              <Link to="/register" className={styles.ctaButton}>
                Crear cuenta
              </Link>
              <Link to="/login" className={styles.ctaButtonGhost}>
                Ya tengo cuenta
              </Link>
            </div>
          </>
        )}
      </section>

      <section className={styles.howItWorks}>
        <h3 className={styles.sectionTitle}>Cómo funciona</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong className={styles.stepTitle}>Conectá tu cuenta</strong>
              <p className={styles.stepBody}>
                Ingresá tu usuario y password de BoardGameGeek. Guardamos el
                password cifrado (AES-256-GCM) y nunca lo enviamos al navegador.
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong className={styles.stepTitle}>
                Sincronizamos tu data
              </strong>
              <p className={styles.stepBody}>
                Traemos tu colección y tus partidas desde BGG. Vas a ver todo en
                una interfaz pensada para usar desde el celu, mientras jugás.
              </p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong className={styles.stepTitle}>
                Cargá partidas nuevas
              </strong>
              <p className={styles.stepBody}>
                Apenas termina la mesa, registrá la partida desde Turnocero. Se
                guarda en BGG automáticamente.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <p className={styles.footnote}>
        BoardGameGeek es un servicio externo. BG Watch es la integración de
        Turnocero con su API.
      </p>
    </div>
  );
}
