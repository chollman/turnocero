import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>🎲</span>
          <span className={styles.logoText}>Turnocero</span>
        </Link>

        <div className={styles.right}>
          {user && (
            <>
              <span className={styles.greeting}>
                Hola, <strong>{user.username}</strong>
              </span>
              <Link
                to="/create"
                className={`${styles.btn} ${styles.btnPrimary} ${
                  location.pathname === '/create' ? styles.active : ''
                }`}
              >
                + Nueva Mesa
              </Link>
              <button className={styles.btnLogout} onClick={handleLogout}>
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
