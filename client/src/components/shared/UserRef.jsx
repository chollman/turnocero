import { Link } from 'react-router-dom';
import { getUserDisplay, DELETED_USER_LABEL } from '../../utils/userDisplay';
import styles from './UserRef.module.css';

function GhostIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  );
}

export default function UserRef({
  user,
  className = '',
  noLink = false,
  showAt = false,
  iconSize = 14,
}) {
  const info = getUserDisplay(user);

  if (info.isDeleted) {
    return (
      <span className={`${styles.deleted} ${className}`} title={DELETED_USER_LABEL}>
        <GhostIcon size={iconSize} />
        <span>{DELETED_USER_LABEL}</span>
      </span>
    );
  }

  const label = showAt ? `@${info.username || info.name}` : info.name;

  if (noLink) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link to={`/usuarios/${info._id}`} className={`${styles.link} ${className}`}>
      {label}
    </Link>
  );
}

export { GhostIcon };
