import Meeple from "../../components/shared/Meeple";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
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

const featuresFor = (t, brandName) => [
  {
    Icon: PlayIcon,
    title: t("landing.features.plays.title"),
    body: t("landing.features.plays.body", { brandName }),
  },
  {
    Icon: CollectionIcon,
    title: t("landing.features.collection.title"),
    body: t("landing.features.collection.body"),
  },
  {
    Icon: StatsIcon,
    title: t("landing.features.perGame.title"),
    body: t("landing.features.perGame.body"),
  },
];

export default function BgWatchLanding() {
  const { user, loading } = useAuth();
  const brandName = useBrandName();
  const navigate = useNavigate();
  const { t } = useTranslation("bgwatch");

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
        <div className={styles.eyebrow}>
          <Meeple />
          {t("landing.brand")}
        </div>
        <h1 className={styles.heroTitle}>{t("landing.heroTitle")}</h1>
        <p className={styles.heroSub}>{t("landing.heroSub", { brandName })}</p>
        <Link to="/bg-watch/comunidad" className={styles.communityLink}>
          {t("landing.communityLink")}
        </Link>
      </header>

      <section className={styles.features}>
        {featuresFor(t, brandName).map(({ Icon, title, body }) => (
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
            <h2 className={styles.ctaTitle}>{t("landing.ctaLoggedTitle")}</h2>
            <p className={styles.ctaSub}>{t("landing.ctaLoggedSub")}</p>
            <Link to="/perfil#conexion-bgg" className={styles.ctaButton}>
              {t("landing.ctaGoToProfile")}
            </Link>
            <p className={styles.ctaFinePrint}>
              {t("landing.ctaFinePrint")}
              <a
                href="https://boardgamegeek.com/register"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ctaLink}
              >
                {t("landing.ctaCreateBgg")}
              </a>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.ctaTitle}>{t("landing.ctaGuestTitle")}</h2>
            <p className={styles.ctaSub}>
              {t("landing.ctaGuestSub", { brandName })}
            </p>
            <div className={styles.ctaButtons}>
              <Link to="/register" className={styles.ctaButton}>
                {t("landing.ctaCreateAccount")}
              </Link>
              <Link to="/login" className={styles.ctaButtonGhost}>
                {t("landing.ctaHaveAccount")}
              </Link>
            </div>
          </>
        )}
      </section>

      <section className={styles.howItWorks}>
        <h3 className={styles.sectionTitle}>{t("landing.howItWorksTitle")}</h3>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong className={styles.stepTitle}>
                {t("landing.step1Title")}
              </strong>
              <p className={styles.stepBody}>{t("landing.step1Body")}</p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong className={styles.stepTitle}>
                {t("landing.step2Title")}
              </strong>
              <p className={styles.stepBody}>{t("landing.step2Body")}</p>
            </div>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong className={styles.stepTitle}>
                {t("landing.step3Title")}
              </strong>
              <p className={styles.stepBody}>
                {t("landing.step3Body", { brandName })}
              </p>
            </div>
          </li>
        </ol>
      </section>

      <p className={styles.footnote}>{t("landing.footnote", { brandName })}</p>
    </div>
  );
}
