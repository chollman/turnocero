// Reglas de contraseña usadas en registro y reset. Antes esta lógica vivía
// duplicada en Register.jsx y ResetPassword.jsx — un cambio (ej. exigir un
// símbolo) requería editar ambos en sync.

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS =
  "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número";

export function isValidPassword(pwd) {
  if (typeof pwd !== "string") return false;
  return (
    pwd.length >= PASSWORD_MIN_LENGTH && /[A-Z]/.test(pwd) && /\d/.test(pwd)
  );
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
