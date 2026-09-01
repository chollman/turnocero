// Un JWT firmado ANTES de que el usuario cambie su password deja de ser
// válido, aunque su `exp` todavía no haya vencido. `decoded.iat` (segundos,
// TRUNCADO hacia abajo por jsonwebtoken) se compara contra
// `User.passwordChangedAt` (ms) truncado al mismo segundo — si comparáramos
// contra los ms crudos, un token emitido milisegundos DESPUÉS del cambio pero
// dentro del mismo segundo de reloj (p. ej. save() + login() en la misma
// request, o simplemente tests rápidos) quedaría marcado como viejo por
// error. Un token issued en el mismo segundo que el cambio se considera
// fresco (no hay forma de distinguir el orden sub-segundo con esta
// resolución; no es un límite criptográfico, es "matar sesiones viejas").
// `passwordChangedAt` null (nunca cambió) siempre da fresco.
function isTokenStale(decoded, user) {
  if (!user?.passwordChangedAt) return false;
  const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
  return decoded.iat < changedAtSec;
}

module.exports = { isTokenStale };
