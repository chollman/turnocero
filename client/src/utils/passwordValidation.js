// Reglas de contraseña usadas en registro y reset. Antes esta lógica vivía
// duplicada en Register.jsx y ResetPassword.jsx — un cambio (ej. exigir un
// símbolo) requería editar ambos en sync.

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS =
  "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número";

// Desglose por requisito para el feedback inline (registro / reset): permite
// mostrar EXACTAMENTE qué falta en vez de un mensaje genérico. `isValidPassword`
// se deriva de acá para que ambos no se desincronicen al cambiar las reglas.
export function passwordChecks(pwd) {
  const value = typeof pwd === "string" ? pwd : "";
  return [
    {
      key: "length",
      label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      met: value.length >= PASSWORD_MIN_LENGTH,
    },
    { key: "upper", label: "Una letra mayúscula", met: /[A-Z]/.test(value) },
    { key: "digit", label: "Un número", met: /\d/.test(value) },
  ];
}

export function isValidPassword(pwd) {
  if (typeof pwd !== "string") return false;
  return passwordChecks(pwd).every((c) => c.met);
}

// Medidor de fuerza para el feedback en vivo del registro (sólo visual; el
// mínimo real lo impone isValidPassword en el submit). Devuelve 0..4 sumando:
// longitud ≥ 8, mayúscula+minúscula, dígito, símbolo. Etiquetas alineadas por
// índice en STRENGTH_LABELS (0 = vacío).
export function passwordStrength(pwd) {
  if (typeof pwd !== "string" || pwd.length === 0) return 0;
  let score = 0;
  if (pwd.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

export const STRENGTH_LABELS = ["", "Débil", "Aceptable", "Buena", "Fuerte"];
