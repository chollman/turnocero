import Meeple from "../../components/shared/Meeple";
import { Link } from "react-router-dom";
import { useBrandName } from "../../hooks/useBrandName";
import styles from "./BgWatchGuestCTAs.module.css";

const REGISTER_HREF = "/register?source=bg-watch";

const DieIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/**
 * Top banner — visible while a guest navigates the public BG Watch surface.
 * Strong, non-dismissible. Anchors the framing: "this user keeps their plays here. You could too."
 */
export function GuestBanner({ bggUsername }) {
  return (
    <div className={styles.banner}>
      <div className={styles.bannerInner}>
        <span className={styles.bannerIcon} aria-hidden="true">
          <DieIcon />
        </span>
        <span className={styles.bannerText}>
          Llevá tus partidas como <strong>@{bggUsername}</strong> con BG Watch.
        </span>
        <Link to={REGISTER_HREF} className={styles.bannerCta}>
          Registrate gratis
          <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}

/**
 * Inline call-out — sits after the stats hero. The "soft sell" right when
 * the visitor has just seen what BG Watch actually does.
 */
export function GuestInlineCTA() {
  const brandName = useBrandName();
  return (
    <div className={styles.inline}>
      <div className={styles.inlineCopy}>
        <span className={styles.inlineEyebrow}>
          <Meeple />
          ACTIVÁ TU PROPIO BG WATCH
        </span>
        <h2 className={styles.inlineTitle}>¿Tenés cuenta en BoardGameGeek?</h2>
        <p className={styles.inlineBody}>
          Conectala con {brandName} y llevá tus partidas como esta persona —
          gratis y sin instalar nada.
        </p>
      </div>
      <Link to={REGISTER_HREF} className={styles.inlineCta}>
        Empezar
        <ArrowIcon />
      </Link>
    </div>
  );
}

/**
 * Footer — last thing the visitor sees on the page.
 * Reinforces the social proof framing.
 */
export function GuestFooter({ bggUsername }) {
  const brandName = useBrandName();
  return (
    <div className={styles.footer}>
      <p className={styles.footerCopy}>
        Este es el BG Watch de <strong>@{bggUsername}</strong>, una persona que
        juega en {brandName}. Vos también podés tener el tuyo.
      </p>
      <Link to={REGISTER_HREF} className={styles.footerCta}>
        Registrate gratis
        <ArrowIcon />
      </Link>
    </div>
  );
}
