import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
              <Link to="/perfil" className={styles.greeting}>
                Hola, <strong>{user.username}</strong>
              </Link>

              <Link
                to="/create"
                className={`${styles.btn} ${styles.btnPrimary} ${
                  location.pathname === '/create' ? styles.active : ''
                }`}
              >
                <span className={styles.btnLong}>+ Nueva Mesa</span>
                <span className={styles.btnShort}>+ Mesa</span>
              </Link>

              {/* Desktop: logout button */}
              <button className={`${styles.btnLogout} ${styles.desktopOnly}`} onClick={handleLogout}>
                Salir
              </button>

              {/* Mobile: hamburger menu */}
              <div className={`${styles.hamburgerWrap} ${styles.mobileOnly}`} ref={menuRef}>
                <button
                  className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Menú"
                  aria-expanded={menuOpen}
                >
                  <span />
                  <span />
                  <span />
                </button>

                {menuOpen && (
                  <div className={styles.dropdown}>
                    <Link
                      to="/perfil"
                      className={styles.dropdownItem}
                      onClick={() => setMenuOpen(false)}
                    >
                      Mi Perfil
                    </Link>
                    <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`} onClick={handleLogout}>
                      Salir
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
