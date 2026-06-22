import { useTranslation } from "react-i18next";
import { useCommunity } from "../../context/CommunityContext";
import styles from "./CommunitySelect.module.css";

// Selector "Publicar en": lista las comunidades a las que pertenece el usuario.
// Se OCULTA si tiene una sola membership (no hay nada que elegir — el server
// cae a la comunidad del skin / base). El parent guarda el valor (id) y lo manda
// en el payload de creación; si queda vacío, el server usa el default.
export default function CommunitySelect({
  value,
  onChange,
  label,
  className = "",
}) {
  const { t } = useTranslation();
  const { memberships, skin, isTenant } = useCommunity();
  // El label por defecto ("Publicar en") se resuelve acá, no en el param,
  // porque `t` no está disponible en la firma. Uno del caller gana.
  const resolvedLabel = label ?? t("shared:communitySelect.label");
  // En modo tenant (subdominio) el contenido se publica SIEMPRE en esa
  // comunidad (el server lo fuerza) — no hay nada que elegir.
  if (isTenant) return null;
  if (!memberships || memberships.length <= 1) return null;

  const current = value || skin || String(memberships[0].community._id);

  return (
    <div className={`${styles.wrap} ${className}`}>
      <label className={styles.label} htmlFor="community-select">
        {resolvedLabel}
      </label>
      <select
        id="community-select"
        className={styles.select}
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {memberships.map((m) => (
          <option key={m.community._id} value={String(m.community._id)}>
            {m.community.name}
          </option>
        ))}
      </select>
    </div>
  );
}
