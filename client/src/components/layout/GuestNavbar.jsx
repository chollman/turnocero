import { Link } from 'react-router-dom';
import styles from './GuestNavbar.module.css';

export default function GuestNavbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <img src="/logo.svg" alt="TurnoCero" className={styles.logoIcon} />
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </Link>

        <div className={styles.right}>
          <Link to="/login" className={styles.btnLogin}>Login</Link>
          <Link to="/register" className={styles.btnRegister}>Registrate</Link>
        </div>
      </div>
    </nav>
  );
}
