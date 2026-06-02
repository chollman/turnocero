const mongoose = require("mongoose");

// ── Comunidad (multi-tenancy suave + reskin) ─────────────────────────────
//
// El contenido (Mesas, Compartidas, Eventos, Torneos, Noticias, MathTrade) se
// scopea a una comunidad vía el campo `community` (plugin `communityScoped`).
// Un usuario integra varias comunidades, elige un subconjunto a "ver juntas"
// y una sola cuyo skin se aplica. Existe SIEMPRE una comunidad base "TurnoCero"
// (`isBase: true`) que hereda todo el contenido histórico. Ver plan completo.

const JOIN_POLICIES = ["open", "approval", "code"];

// Subdoc reusable para assets de Cloudinary (logo / fondo).
const assetSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

// Validación de valores de color para los tokens del skin: solo literales
// hex (#rgb/#rgba/#rrggbb/#rrggbbaa) o rgb()/rgba(). Defensa en profundidad:
// estos valores se inyectan en un <style> en el cliente, así que NUNCA se
// guarda CSS crudo — sin `;`, `{`, `}`, `url()`, etc.
const COLOR_RE =
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|^rgba?\(\s*[\d.,%/\s]+\)$/i;

// Sanitiza un mapa de tokens { key: colorValue }. Descarta keys con formato
// inválido o valores que no sean colores. Cap de 40 keys para acotar el payload.
function sanitizeSkinTokens(tokens) {
  const out = {};
  if (!tokens || typeof tokens !== "object") return out;
  // Soporta tanto un Map de Mongoose como un objeto plano.
  const entries =
    typeof tokens.entries === "function" && !(tokens instanceof Array)
      ? Array.from(tokens.entries())
      : Object.entries(tokens);
  let count = 0;
  for (const [key, value] of entries) {
    if (count >= 40) break;
    if (typeof key !== "string" || !/^[a-zA-Z0-9]{1,40}$/.test(key)) continue;
    if (typeof value !== "string" || !COLOR_RE.test(value.trim())) continue;
    out[key] = value.trim();
    count += 1;
  }
  return out;
}

const skinSchema = new mongoose.Schema(
  {
    // Acentos de marca (--amber, --red, ...). Independientes del tema (aplican
    // en dark y light por igual). Map de String para sumar tokens nuevos sin
    // tocar el schema (ver plan §7.5).
    accents: { type: Map, of: String, default: () => ({}) },
    // Neutros (--bg-*, --text-*, --border). Theme-split: se overridean por
    // separado en dark y light con selectores scopeados por tema.
    neutralsDark: { type: Map, of: String, default: () => ({}) },
    neutralsLight: { type: Map, of: String, default: () => ({}) },
    logoLight: { type: assetSchema, default: () => ({}) },
    logoDark: { type: assetSchema, default: () => ({}) },
    background: { type: assetSchema, default: () => ({}) },
    // Override del wordmark "TurnoCero". Vacío = se usa el nombre de la marca base.
    brandName: { type: String, default: "", maxlength: 60, trim: true },
    tagline: { type: String, default: "", maxlength: 140, trim: true },
    font: { type: String, default: "", maxlength: 80, trim: true },
  },
  { _id: false },
);

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [60, "El nombre no puede superar 60 caracteres"],
    },
    // URL-safe, derivado del nombre en la creación. INMUTABLE: alimenta el
    // selector CSS `data-community`, el localStorage del skin y las URLs. El
    // `name` se edita libre; el slug queda fijo.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: "", maxlength: 2000, trim: true },
    // Exactamente una comunidad con isBase:true. No se puede borrar; todos los
    // usuarios pertenecen a ella; hereda el contenido histórico.
    isBase: { type: Boolean, default: false, index: true },
    joinPolicy: {
      type: String,
      enum: JOIN_POLICIES,
      default: "open",
    },
    // Solo relevante con joinPolicy:'code'. select:false → nunca sale en queries
    // genéricas; toJSON expone solo el derivado `hasCode`.
    inviteCode: { type: String, default: "", select: false },
    // Cola de aprobación (joinPolicy:'approval'). Espeja Table.pendingRequests.
    pendingMembers: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    skin: { type: skinSchema, default: () => ({}) },
    // Override por comunidad del set de secciones (misma forma que
    // SiteConfig.sections). Map de String→Bool: { mesas: true, torneos: false }.
    // Una sección se muestra si está habilitada globalmente Y en la comunidad-skin.
    // Ausente/true = no restringe. Enforcement client-side (ver plan §4.8b).
    sections: { type: Map, of: Boolean, default: () => ({}) },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// ── Caché del singleton base ─────────────────────────────────────────────
// `getBase()` es hot (resolveCommunities lo llama en cada request anónimo), así
// que se cachea el doc. El caché se invalida en tests entre cada test (las
// colecciones se limpian) vía `__resetBaseCache()` desde tests/setup.js.
let baseCache = null;

// Genera un slug único derivado del nombre (estilo retry como
// generateUniqueUsername en oauthService.js).
communitySchema.statics.generateSlug = async function generateSlug(name) {
  const base =
    String(name || "")
      .normalize("NFD")
      // Quitar marcas diacríticas combinantes (la ñ→n + tilde; é→e + acento)
      // ANTES de colapsar separadores, si no la marca se vuelve un "-".
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "comunidad";
  if (!(await this.exists({ slug: base }))) return base;
  for (let i = 1; i < 10000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, 50 - suffix.length)}${suffix}`;
    if (!(await this.exists({ slug: candidate }))) return candidate;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36)}`.slice(0, 50);
};

// Devuelve la comunidad base (cacheada). Lazy: si no existe, la crea (defensa
// para que `$in:[base]` nunca quede vacío y vacíe toda la app).
communitySchema.statics.getBase = async function getBase() {
  if (baseCache) return baseCache;
  let base = await this.findOne({ isBase: true });
  if (!base) base = await this.ensureBase();
  baseCache = base;
  return base;
};

// Upsert idempotente de la comunidad base. Llamado en el boot del server y por
// el seed. Cachea el resultado.
communitySchema.statics.ensureBase = async function ensureBase() {
  const base = await this.findOneAndUpdate(
    { isBase: true },
    {
      $setOnInsert: {
        name: "TurnoCero",
        slug: "turnocero",
        isBase: true,
        joinPolicy: "open",
        skin: {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  baseCache = base;
  return base;
};

// Reset del caché — solo para tests (las colecciones se limpian entre tests).
communitySchema.statics.__resetBaseCache = function __resetBaseCache() {
  baseCache = null;
};

communitySchema.statics.sanitizeSkinTokens = sanitizeSkinTokens;

// toJSON: nunca exponer el inviteCode crudo; exponer solo `hasCode`.
// `flattenMaps` convierte los Map (sections, skin.accents/neutrals*) a objetos
// planos — sin esto, JSON.stringify(Map) los serializa como `{}` y el cliente
// pierde los valores (toggles de sección, tokens del skin).
communitySchema.methods.toJSON = function () {
  const obj = this.toObject({ flattenMaps: true });
  obj.hasCode = !!(this.inviteCode && this.inviteCode.length);
  delete obj.inviteCode;
  return obj;
};

const Community = mongoose.model("Community", communitySchema);

Community.JOIN_POLICIES = JOIN_POLICIES;
Community.sanitizeSkinTokens = sanitizeSkinTokens;

module.exports = Community;
