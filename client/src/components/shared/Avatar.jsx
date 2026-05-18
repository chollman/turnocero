import { getUserDisplay } from '../../utils/userDisplay';
import { GhostIcon } from './UserRef';
import styles from './Avatar.module.css';

const PALETTE = ['--amber', '--red', '--green', '--orange', '--purple'];

const GHOST_SIZE = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 32,
  xl: 48,
};

function hashToColor(key = '') {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function getInitials(display) {
  const name = display.displayName || display.name || '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (Array.from(parts[0])[0] + Array.from(parts[1])[0]).toUpperCase();
  }
  const single = display.username || name || '?';
  return (Array.from(single)[0] || '?').toUpperCase();
}

export default function Avatar({ user, size = 'md', className = '' }) {
  const display = getUserDisplay(user);
  const sizeClass = styles[`size_${size}`] || styles.size_md;

  if (display.isDeleted) {
    return (
      <span className={`${styles.avatar} ${sizeClass} ${styles.deleted} ${className}`} aria-label="Usuario eliminado">
        <GhostIcon size={GHOST_SIZE[size] || GHOST_SIZE.md} />
      </span>
    );
  }

  if (display.avatar?.url) {
    return (
      <span className={`${styles.avatar} ${sizeClass} ${className}`}>
        <img src={display.avatar.url} alt={display.name} loading="lazy" />
      </span>
    );
  }

  const colorVar = hashToColor(String(display._id || display.username || ''));
  return (
    <span
      className={`${styles.avatar} ${sizeClass} ${styles.initials} ${className}`}
      style={{ background: `var(${colorVar})` }}
      aria-label={display.name}
    >
      {getInitials(display)}
    </span>
  );
}
