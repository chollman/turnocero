import { useAuth } from '../../context/AuthContext';
import styles from './ViewAsUserBanner.module.css';

export default function ViewAsUserBanner() {
  const { isActuallyAdmin, viewAsUser, setViewAsUser } = useAuth();

  if (!isActuallyAdmin || !viewAsUser) return null;

  return (
    <button
      className={styles.banner}
      onClick={() => setViewAsUser(false)}
      type="button"
    >
      Viendo como usuario · Click para volver
    </button>
  );
}
