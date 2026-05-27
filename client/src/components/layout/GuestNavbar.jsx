import { Link } from "react-router-dom";
import Logo from "../shared/Logo";
import styles from "./GuestNavbar.module.css";

export default function GuestNavbar({ menuOpen = false, onToggleMenu }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <Logo className={styles.logoIcon} />
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </Link>

        <div className={styles.right}>
          <Link to="/login" className={styles.btnLogin}>
            Login
          </Link>
          <Link to="/register" className={styles.btnRegister}>
            Registrate
          </Link>
          {onToggleMenu && (
            <button
              type="button"
              className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnOpen : ""}`}
              onClick={onToggleMenu}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
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
