// Extrae el mensaje del shape estándar `{ message }` que devuelve el server
// (ver CLAUDE.md → "Server error format"). Si la response no respeta el
// contrato (network error, 502, etc.) cae al mensaje por defecto.
//
// Antes el patrón `err.response?.data?.message || 'algo'` vivía duplicado
// en ~10 catches.

export function getErrorMessage(err, defaultMsg = "Algo salió mal") {
  const fromResponse = err?.response?.data?.message;
  if (typeof fromResponse === "string" && fromResponse.trim()) {
    return fromResponse;
  }
  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }
  return defaultMsg;
}
