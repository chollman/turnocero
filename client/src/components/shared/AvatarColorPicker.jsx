import Meeple from "./Meeple";
import { AVATAR_PALETTE, isValidAvatarColor } from "../../utils/hash";
import styles from "./AvatarColorPicker.module.css";

// Picker de color de avatar — sólo aplica cuando el usuario no subió foto.
// Muestra un preview de la inicial sobre el color elegido + una fila de
// swatches de la paleta de marca. Compartido entre el registro y /perfil.
//
// Props:
//  - value:      token actual ("" = automático / hasheado) — controlado.
//  - onChange:   (token) => void. Pasa "" cuando se elige "Automático".
//  - initial:    letra(s) a previsualizar (ej. "C" o "CH"). Si está vacío
//                (todavía no hay nombre), se muestra un meeple como placeholder.
//  - autoColor:  token usado para el preview cuando value === "" (ej. el color
//                hasheado del _id en /perfil). Si falta, el preview "auto" usa
//                un fondo neutro.
//  - allowAuto:  muestra la opción "Automático" (mapea a ""). Útil en /perfil
//                para volver al color hasheado; en el registro no se usa.
//  - disabled:   deshabilita toda la interacción.
export default function AvatarColorPicker({
  value = "",
  onChange,
  initial = "",
  autoColor = "",
  allowAuto = false,
  disabled = false,
}) {
  const isAuto = !isValidAvatarColor(value);
  const previewToken = !isAuto
    ? value
    : isValidAvatarColor(autoColor)
      ? autoColor
      : "";

  const previewStyle = previewToken
    ? { background: `var(${previewToken})` }
    : undefined;

  return (
    <div className={styles.row}>
      <div
        className={`${styles.preview} ${previewToken ? "" : styles.previewAuto}`}
        style={previewStyle}
        aria-hidden="true"
      >
        {initial ? initial : <Meeple className={styles.previewMeeple} />}
      </div>

      <div className={styles.swatches} role="group" aria-label="Color de avatar">
        {allowAuto && (
          <button
            type="button"
            className={`${styles.swatch} ${styles.swatchAuto} ${
              isAuto ? styles.active : ""
            }`}
            onClick={() => onChange?.("")}
            disabled={disabled}
            aria-label="Color automático"
            aria-pressed={isAuto}
            title="Automático"
          />
        )}
        {AVATAR_PALETTE.map((token) => (
          <button
            key={token}
            type="button"
            className={`${styles.swatch} ${value === token ? styles.active : ""}`}
            style={{ background: `var(${token})`, color: `var(${token})` }}
            onClick={() => onChange?.(token)}
            disabled={disabled}
            aria-label={`Color ${token.replace("--", "")}`}
            aria-pressed={value === token}
          />
        ))}
      </div>
    </div>
  );
}
