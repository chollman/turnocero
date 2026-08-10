// "Partidas del mes" — helpers de rango de fechas + layout de grilla (puros,
// testeables sin DOM) y el renderer de canvas que dibuja el mosaico
// descargable (carátulas + badge de partidas del período + cabecera de
// stats). Colores de marca se leen de las CSS custom properties en el
// momento de dibujar (no hardcodeados): así el reskin de una comunidad
// (ver CLAUDE.md "Comunidades" → Reskin) se refleja en la imagen exportada.

import { API } from "../../api/endpoints";

const pad2 = (n) => String(n).padStart(2, "0");

export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIsoDate(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Rango [1º día, último día] del mes que contiene `date` (default hoy).
export function monthRange(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { mindate: toIsoDate(first), maxdate: toIsoDate(last) };
}

export function previousMonthRange(date = new Date()) {
  return monthRange(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

// Etiqueta legible del rango para la cabecera del mosaico: "Agosto 2026" si
// es un mes calendario completo, o "5 ago – 20 ago 2026" para un rango
// personalizado.
export function formatRangeLabel(mindate, maxdate, locale = "es-AR") {
  const start = parseIsoDate(mindate);
  const end = parseIsoDate(maxdate);
  if (!start || !end) return "";

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const isFullMonth =
    sameMonth &&
    start.getDate() === 1 &&
    end.getDate() === daysInMonth(end.getFullYear(), end.getMonth());

  if (isFullMonth) {
    const s = start.toLocaleDateString(locale, { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const fmt = (d) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
}

// ── Layout de la grilla (puro, sin canvas) ──────────────────────────────
export const MOSAIC_LAYOUT_DEFAULTS = {
  canvasWidth: 1080,
  padding: 40,
  gap: 14,
  headerHeight: 260,
  footerHeight: 50,
  tileRadius: 14,
};

function colsForCount(n) {
  if (n <= 1) return 1;
  if (n <= 4) return n;
  if (n <= 9) return 3;
  if (n <= 16) return 4;
  if (n <= 25) return 5;
  return 6;
}

// Devuelve { cols, rows, tileSize, canvasWidth, canvasHeight, positions }.
// `positions[i]` = { x, y, size } en píxeles del canvas, en el mismo orden
// que la lista de juegos de entrada.
export function layoutMosaicGrid(count, opts = {}) {
  const { canvasWidth, padding, gap, headerHeight, footerHeight } = {
    ...MOSAIC_LAYOUT_DEFAULTS,
    ...opts,
  };
  const n = Math.max(0, count);

  if (n === 0) {
    return {
      cols: 0,
      rows: 0,
      tileSize: 0,
      canvasWidth,
      canvasHeight: headerHeight + footerHeight,
      positions: [],
    };
  }

  const cols = colsForCount(n);
  const rows = Math.ceil(n / cols);
  const usableWidth = canvasWidth - padding * 2;
  const tileSize = (usableWidth - gap * (cols - 1)) / cols;
  const gridHeight = rows * tileSize + (rows - 1) * gap;
  const canvasHeight = headerHeight + padding + gridHeight + padding + footerHeight;

  const positions = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: padding + col * (tileSize + gap),
      y: headerHeight + padding + row * (tileSize + gap),
      size: tileSize,
    });
  }

  return { cols, rows, tileSize, canvasWidth, canvasHeight, positions };
}

// Pills de la cabecera — puro, no depende de i18next directamente (recibe el
// `t` ya resuelto) para que sea testeable con un stub simple.
export function buildStatPills(stats, t) {
  const rated = stats?.totalRated || 0;
  const wins = stats?.totalWins || 0;
  return [
    { label: t("monthlyRecap.stats.plays"), value: String(stats?.totalPlays ?? 0) },
    {
      label: t("monthlyRecap.stats.wins"),
      value: rated > 0 ? `${wins}/${rated}` : "—",
    },
    { label: t("monthlyRecap.stats.games"), value: String(stats?.uniqueGames ?? 0) },
  ];
}

// ── Canvas rendering ─────────────────────────────────────────────────────

function readCssColor(name, fallback) {
  if (typeof document === "undefined" || !document.documentElement) return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readBrandColors() {
  return {
    bgDark: readCssColor("--bg-dark", "#0a0d15"),
    bgCard: readCssColor("--bg-card", "#151c28"),
    bgElevated: readCssColor("--bg-elevated", "#1c2536"),
    border: readCssColor("--border", "#1e2a3d"),
    textPrimary: readCssColor("--text-primary", "#ffffff"),
    textSecondary: readCssColor("--text-secondary", "#a8b4cc"),
    amber: readCssColor("--amber", "#1888ef"),
    amberLight: readCssColor("--amber-light", "#00aeff"),
    onAmber: readCssColor("--on-amber", "#ffffff"),
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Las carátulas siempre vienen del CDN de BGG (cross-origin, sin CORS) —
// se reenvuelven con nuestro proxy same-origin (image-proxy) para que el
// canvas pueda leerlas sin taintearse. Si ya es same-origin (el propio
// proxy, o un valor relativo en tests), se deja tal cual.
//
// El `src` de un <img>/Image() NO pasa por axios, así que su baseURL
// (VITE_API_URL) no se aplica solo — hay que prefijarlo a mano, igual que
// el resto del código que arma URLs absolutas hacia el server fuera de
// axios (ver useNotificationSocket.js, TableChat.jsx, etc.). En dev con el
// proxy de Vite (client y server mismo origin) esto es un no-op ("").
export function proxiedImageSrc(url) {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  const apiBase = import.meta.env.VITE_API_URL || "";
  return `${apiBase}${API.bgg.IMAGE_PROXY(url)}`;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Dibuja el mosaico completo en `canvas` (ya montado en el DOM). Async
// porque espera a que carguen las carátulas (y, si está disponible, a que
// terminen de cargar las webfonts) antes de pintar texto/imágenes.
//
// `games`: [{ id, name, image, thumbnail, numPlays }] — numPlays es el
// conteo DEL PERÍODO (lo que se dibuja en el badge).
// `stats`: overallStats del período (ver computeOverallStats).
// `t`: función de traducción ya resuelta al namespace bgwatch.
export async function renderMonthlyRecapMosaic(
  canvas,
  { games, stats, rangeLabel, bggUsername, brandName, t },
) {
  const list = Array.isArray(games) ? games : [];
  const layout = layoutMosaicGrid(list.length);

  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const colors = readBrandColors();
  const { padding, headerHeight } = MOSAIC_LAYOUT_DEFAULTS;

  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  // Fondo
  ctx.fillStyle = colors.bgDark;
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

  // Banda de cabecera
  const headerGrad = ctx.createLinearGradient(0, 0, layout.canvasWidth, headerHeight);
  headerGrad.addColorStop(0, colors.bgCard);
  headerGrad.addColorStop(1, colors.bgDark);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, layout.canvasWidth, headerHeight);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(layout.canvasWidth, headerHeight);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Eyebrow
  ctx.fillStyle = colors.amberLight;
  ctx.font = "700 15px 'JetBrains Mono', monospace";
  ctx.fillText(
    `${(brandName || "TurnoCero").toUpperCase()} · BG WATCH`,
    padding,
    46,
  );

  // Título (rango)
  ctx.fillStyle = colors.textPrimary;
  ctx.font = "800 44px 'Poppins', sans-serif";
  ctx.fillText(rangeLabel || "", padding, 100);

  // Subtítulo (usuario)
  ctx.fillStyle = colors.textSecondary;
  ctx.font = "500 18px 'Archivo', sans-serif";
  ctx.fillText(`@${bggUsername || ""}`, padding, 128);

  // Pills de stats
  const pills = buildStatPills(stats, t);
  const pillY = 158;
  const pillH = 68;
  let pillX = padding;
  for (const pill of pills) {
    ctx.font = "700 26px 'Poppins', sans-serif";
    const valueWidth = ctx.measureText(pill.value).width;
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    const labelWidth = ctx.measureText(pill.label.toUpperCase()).width;
    const pillW = Math.max(valueWidth, labelWidth) + 36;

    ctx.fillStyle = colors.bgElevated;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, 12);
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colors.textSecondary;
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillText(pill.label.toUpperCase(), pillX + 18, pillY + 24);

    ctx.fillStyle = colors.textPrimary;
    ctx.font = "700 26px 'Poppins', sans-serif";
    ctx.fillText(pill.value, pillX + 18, pillY + 52);

    pillX += pillW + 14;
  }

  if (list.length === 0) {
    ctx.fillStyle = colors.textSecondary;
    ctx.font = "500 18px 'Archivo', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("monthlyRecap.canvasEmpty"), layout.canvasWidth / 2, headerHeight + 70);
    ctx.textAlign = "left";
  }

  // Tiles — cargar carátulas en paralelo antes de dibujar.
  const images = await Promise.all(
    list.map((g) => loadImage(proxiedImageSrc(g.image || g.thumbnail))),
  );

  list.forEach((game, i) => {
    const pos = layout.positions[i];
    if (!pos) return;
    const img = images[i];

    ctx.save();
    roundRectPath(ctx, pos.x, pos.y, pos.size, pos.size, MOSAIC_LAYOUT_DEFAULTS.tileRadius);
    ctx.clip();
    ctx.fillStyle = colors.bgElevated;
    ctx.fillRect(pos.x, pos.y, pos.size, pos.size);

    if (img) {
      const scale = Math.max(pos.size / img.width, pos.size / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      ctx.drawImage(
        img,
        pos.x + (pos.size - drawW) / 2,
        pos.y + (pos.size - drawH) / 2,
        drawW,
        drawH,
      );
    } else {
      ctx.fillStyle = colors.textSecondary;
      ctx.font = `600 ${Math.round(pos.size * 0.12)}px 'Archivo', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = (game.name || "🎲").split(" ").slice(0, 3).join(" ");
      ctx.fillText(label, pos.x + pos.size / 2, pos.y + pos.size / 2, pos.size - 16);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, pos.x, pos.y, pos.size, pos.size, MOSAIC_LAYOUT_DEFAULTS.tileRadius);
    ctx.stroke();

    // Badge — partidas del período, esquina inferior derecha.
    const badgeR = Math.max(16, Math.min(22, pos.size * 0.14));
    const bx = pos.x + pos.size - badgeR - 6;
    const by = pos.y + pos.size - badgeR - 6;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = colors.amber;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.bgDark;
    ctx.stroke();
    ctx.fillStyle = colors.onAmber;
    ctx.font = `700 ${Math.round(badgeR * 1.05)}px 'Poppins', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(game.numPlays ?? 1), bx, by + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  });

  // Watermark
  ctx.fillStyle = colors.textSecondary;
  ctx.font = "500 13px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `${brandName || "TurnoCero"} · BG Watch`,
    layout.canvasWidth / 2,
    layout.canvasHeight - 18,
  );
  ctx.textAlign = "left";
}
