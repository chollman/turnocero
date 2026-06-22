import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Logo from "../shared/Logo";
import { useCommunity } from "../../context/CommunityContext";
import styles from "./GuestNavbar.module.css";

export default function GuestNavbar({ menuOpen = false, onToggleMenu }) {
  const { t } = useTranslation();
  // En modo tenant (subdominio / ?tenant) la marca es la de la comunidad.
  const { isTenant, brand } = useCommunity();
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <Logo
            className={styles.logoIcon}
            alt={isTenant ? brand.name : "TurnoCero"}
            srcLight={isTenant ? brand.logoLight : undefined}
            srcDark={isTenant ? brand.logoDark : undefined}
          />
          <div className={styles.logoText}>
            <span className={styles.logoName}>
              {isTenant ? brand.name : "TurnoCero"}
            </span>
            <span className={styles.logoSub}>
              {isTenant && brand.tagline ? brand.tagline : "BOARD GAME MEETUPS"}
            </span>
          </div>
        </Link>

        <div className={styles.right}>
          <Link to="/login" className={styles.btnLogin}>
            Login
          </Link>
          <Link to="/register" className={styles.btnRegister}>
            {t("layout:nav.register")}
          </Link>
          {onToggleMenu && (
            <button
              type="button"
              className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnOpen : ""}`}
              onClick={onToggleMenu}
              aria-label={menuOpen ? t("layout:menu.close") : t("layout:menu.open")}
              aria-expanded={menuOpen}
            >
              <span className={styles.menuLine} />
              <span className={styles.menuLine} />
              <span className={styles.menuLine} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
