// Precios por millón de tokens (USD) para estimar el costo de cada llamada.
// Fuente: precios publicados de la API de Claude a octubre de 2026. Verificar
// contra https://docs.claude.com antes de usar estos números para facturar:
// son una estimación para monitoreo, no la factura real.
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
