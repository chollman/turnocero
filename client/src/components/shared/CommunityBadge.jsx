import styles from "./CommunityBadge.module.css";

// Chip chico con el nombre (y logo opcional) de una comunidad. Se usa en las
// cards del feed combinado cuando el usuario ve varias comunidades a la vez,
// para dejar claro de qué comunidad viene cada item.
export default function CommunityBadge({ community, className = "" }) {
  const name = community?.name || community?.slug;
  if (!name) return null;
  const logo = community?.skin?.logoLight?.url || community?.skin?.logoDark?.url;
  return (
    <span className={`${styles.badge} ${className}`} title={name}>
      {logo ? <img src={logo} alt="" className={styles.logo} /> : null}
      <span className={styles.name}>{name}</span>
    </span>
  );
}
