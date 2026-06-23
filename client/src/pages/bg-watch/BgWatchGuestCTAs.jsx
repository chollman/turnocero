import Meeple from "../../components/shared/Meeple";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation("bgwatch");
  return (
    <div className={styles.banner}>
      <div className={styles.bannerInner}>
        <span className={styles.bannerIcon} aria-hidden="true">
          <DieIcon />
        </span>
        <span className={styles.bannerText}>
          <Trans
            t={t}
            i18nKey="guestCtas.banner"
            values={{ bggUsername }}
            components={{ strong: <strong /> }}
          />
        </span>
        <Link to={REGISTER_HREF} className={styles.bannerCta}>
          {t("guestCtas.registerFree")}
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
  const { t } = useTranslation("bgwatch");
  return (
    <div className={styles.inline}>
      <div className={styles.inlineCopy}>
        <span className={styles.inlineEyebrow}>
          <Meeple />
          {t("guestCtas.inlineEyebrow")}
        </span>
        <h2 className={styles.inlineTitle}>{t("guestCtas.inlineTitle")}</h2>
        <p className={styles.inlineBody}>
          {t("guestCtas.inlineBody", { brandName })}
        </p>
      </div>
      <Link to={REGISTER_HREF} className={styles.inlineCta}>
        {t("guestCtas.start")}
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
  const { t } = useTranslation("bgwatch");
  return (
    <div className={styles.footer}>
      <p className={styles.footerCopy}>
        <Trans
          t={t}
          i18nKey="guestCtas.footer"
          values={{ bggUsername, brandName }}
          components={{ strong: <strong /> }}
        />
      </p>
      <Link to={REGISTER_HREF} className={styles.footerCta}>
        {t("guestCtas.registerFree")}
        <ArrowIcon />
      </Link>
    </div>
  );
}
