import { Link } from 'react-router-dom';
import styles from './UtilCard.module.css';

export default function UtilCard({ icon, title, description, to, comingSoon }) {
  if (comingSoon) {
    return (
      <div className={`${styles.card} ${styles.cardDisabled}`}>
        <div className={styles.icon}>🔒</div>
        <div className={styles.name}>Próximamente</div>
      </div>
    );
  }
  return (
    <Link to={to} className={styles.card}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.name}>{title}</div>
      {description && <div className={styles.desc}>{description}</div>}
    </Link>
  );
}
