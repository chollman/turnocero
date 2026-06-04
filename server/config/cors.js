// Configuración CORS compartida entre el Express app (app.js) y Socket.IO
// (server.js). Antes vivía duplicada en ambos archivos — un cambio de origen
// requería editar dos lugares y era fácil dejar al socket fuera de sync.
//
// `CORS_ORIGIN` admite múltiples orígenes EXACTOS separados por coma; sin la env
// var se asume desarrollo local contra Vite (puerto 3000).
//
// `CORS_ORIGIN_SUFFIX` (subdominios por comunidad): lista de sufijos de dominio
// separados por coma (ej. `.turnocero.com`). Cualquier origin HTTPS cuyo host
// termine en uno de esos sufijos se permite — así `<slug>.turnocero.com` (el
// subdominio single-tenant de cada comunidad) pasa CORS sin enumerarlos uno por
// uno. El punto inicial del sufijo evita que `evilturnocero.com` matchee.

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

const allowedSuffixes = process.env.CORS_ORIGIN_SUFFIX
  ? process.env.CORS_ORIGIN_SUFFIX.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// ¿El origin matchea alguno de los sufijos permitidos? Solo HTTPS (los
// subdominios productivos siempre son https; localhost va por la allowlist
// exacta). Parsea el host con URL para no caer en matcheos de substring sucios.
function matchesSuffix(origin) {
  if (!allowedSuffixes.length) return false;
  let host;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    host = u.hostname;
  } catch {
    return false;
  }
  return allowedSuffixes.some((sfx) => {
    const bare = sfx.replace(/^\./, "");
    return host === bare || host.endsWith(sfx.startsWith(".") ? sfx : `.${sfx}`);
  });
}

// Política central de aceptación de origin (Express + Socket.IO la comparten).
// Sin header Origin (same-origin / curl) → permitir.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return matchesSuffix(origin);
}

// Para Express: callback dinámico que rechaza con un error CORS estándar.
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Community-Slug"],
};

// Para Socket.IO: misma lógica vía función (acepta el mismo contrato que el
// paquete `cors`). Antes era un array literal; ahora soporta el wildcard de
// sufijo igual que Express.
const socketCorsOptions = {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
};

module.exports = {
  allowedOrigins,
  allowedSuffixes,
  isAllowedOrigin,
  corsOptions,
  socketCorsOptions,
};
