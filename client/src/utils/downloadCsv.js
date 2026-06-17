// Genera y descarga un CSV en el cliente. `toCsv` es pura (testeable);
// `downloadCsv` es el glue que dispara la descarga vía Blob + <a download>.

// Escapa una celda: si contiene coma, comillas o saltos de línea, la envuelve
// en comillas dobles y duplica las comillas internas (regla RFC 4180).
function escapeCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// `headers`: array de strings. `rows`: array de arrays de celdas.
export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

export function downloadCsv(filename, csv) {
  // BOM para que Excel reconozca UTF-8 (acentos en nombres de juego/usuario).
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (URL.revokeObjectURL) URL.revokeObjectURL(url);
}
