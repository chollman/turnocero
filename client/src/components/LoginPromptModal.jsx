import { useNavigate } from 'react-router-dom';
import styles from './LoginPromptModal.module.css';

export default function LoginPromptModal({ isOpen, onClose, message }) {
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🎲</div>
        <h2 className={styles.title}>¡Sumate a la partida!</h2>
        <p className={styles.message}>
          {message || 'Iniciá sesión para continuar.'}
        </p>
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={() => navigate('/login')}
          >
            Iniciá sesión
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => navigate('/register')}
          >
            Registrate gratis
          </button>
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
    </div>
  );
}
