// Precios por millón de tokens (USD) para estimar el costo de cada llamada.
// Verificados el 2026-10-30 contra la tabla de Anthropic (citada por
// langcopilot.com y buildmvpfast.com; la página oficial no se pudo abrir
// desde la sesión remota). La escritura de caché es la de 5 minutos, que es
// la que usa `cache_control: { type: "ephemeral" }`. Son una estimación para
// monitoreo, no la factura real.
//
// Haiku 5.5 cobra más caro si el prompt supera 100K tokens; este agente está
// muy lejos de ese tope (conversaciones cortas y resultados de tools chicos),
// así que solo se modela el tramo bajo.

const PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
};

function costUsd(model, usage = {}) {
  const p = PRICES[model];
  if (!p) return 0;
  const m = 1_000_000;
  return (
    ((usage.input_tokens || 0) * p.input +
      (usage.output_tokens || 0) * p.output +
      (usage.cache_read_input_tokens || 0) * p.cacheRead +
      (usage.cache_creation_input_tokens || 0) * p.cacheWrite) /
    m
  );
}

module.exports = { PRICES, costUsd };
