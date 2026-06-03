import styles from "./CommunityBadge.module.css";

// Chip chico con el nombre (y logo opcional) de una comunidad. Se usa en las
// cards del feed combinado cuando el usuario ve varias comunidades a la vez,
// para dejar claro de qué comunidad viene cada item.
//
// Se tinta con el color PRIMARIO de la comunidad: el acento `amber` de su skin
// (es el color de marca principal). Las comunidades sin skin propio (la base
// TurnoCero) caen al `--amber` por defecto de la app. El color se inyecta como
// `--badge-color` y el CSS lo usa para el texto, el borde y un tinte de fondo.
export default function CommunityBadge({ community, className = "" }) {
  const name = community?.name || community?.slug;
  if (!name) return null;
  const logo = community?.skin?.logoLight?.url || community?.skin?.logoDark?.url;
  const color = community?.skin?.accents?.amber || "var(--amber)";
  return (
    <span
      className={`${styles.badge} ${className}`}
      style={{ "--badge-color": color }}
      title={name}
    >
      {logo ? <img src={logo} alt="" className={styles.logo} /> : null}
      <span className={styles.name}>{name}</span>
    </span>
  );
}
