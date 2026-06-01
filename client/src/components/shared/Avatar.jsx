import { getUserDisplay } from "../../utils/userDisplay";
import {
  hashToBrandColor,
  isValidAvatarColor,
  AVATAR_PALETTE,
} from "../../utils/hash";
import { getInitials } from "../../utils/initials";
import { GhostIcon } from "./UserRef";
import styles from "./Avatar.module.css";

const GHOST_SIZE = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 32,
  xl: 48,
};

// Re-export legacy local names so existing imports continue to work.
export {
  hashToBrandColor as hashToColor,
  getInitials,
  AVATAR_PALETTE as PALETTE,
};

export default function Avatar({ user, size = "md", className = "" }) {
  const display = getUserDisplay(user);
  const sizeClass = styles[`size_${size}`] || styles.size_md;

  if (display.isDeleted) {
    return (
      <span
        className={`${styles.avatar} ${sizeClass} ${styles.deleted} ${className}`}
        aria-label="Usuario eliminado"
      >
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

  // El color elegido por el usuario gana al hash determinístico del _id; sólo
  // aceptamos tokens de la paleta para no inyectar valores arbitrarios en var().
  const colorVar = isValidAvatarColor(display.avatar?.color)
    ? display.avatar.color
    : hashToBrandColor(String(display._id || display.username || ""));
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
