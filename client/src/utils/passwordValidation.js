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
