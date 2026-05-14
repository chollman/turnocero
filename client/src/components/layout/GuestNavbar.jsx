import { Link } from 'react-router-dom';
import styles from './GuestNavbar.module.css';

export default function GuestNavbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>T</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </Link>

        <div className={styles.links}>
          <Link to="/noticias" className={styles.navLink}>Noticias</Link>
          <Link to="/compartidas" className={styles.navLink}>Compartidas</Link>
          <Link to="/utilidades" className={styles.navLink}>Utilidades</Link>
        </div>

        <div className={styles.right}>
          <Link to="/login" className={styles.btnLogin}>
            Iniciá sesión
          </Link>
          <Link to="/register" className={styles.btnRegister}>
            Registrate
          </Link>
        </div>
      </div>
    </nav>
  );
}
