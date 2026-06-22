const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      // Las cuentas creadas vía OAuth (Google/Facebook) no tienen contraseña.
      // El proveedor verifica la identidad; el usuario puede setear una luego
      // vía "olvidé mi contraseña" (reset-password autoverifica el email).
      required: [
        function () {
          return !this.googleId && !this.facebookId;
        },
        "Password is required",
      ],
      minlength: [8, "Password must be at least 8 characters"],
      validate: {
        // Tolerar undefined/empty en cuentas OAuth-only; la complejidad sólo
        // aplica cuando hay una contraseña presente.
        validator: (v) => !v || /^(?=.*[A-Z])(?=.*\d).+$/.test(v),
        message:
          "Password must contain at least one uppercase letter and one number",
      },
    },
    // Identidades OAuth. Índice unique + partial filtrado por $type:string:
    // las cuentas password-only no tienen el campo (queda ausente, no null) y
    // por eso quedan fuera del índice — sólo dos cuentas con el mismo id de
    // proveedor colisionan. (Un sparse index NO alcanza si el campo default es
    // null, porque null cuenta como valor y choca con el resto de los nulls.)
    googleId: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { googleId: { $type: "string" } },
      },
    },
    facebookId: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { facebookId: { $type: "string" } },
      },
    },
    authProviders: [{ type: String, enum: ["password", "google", "facebook"] }],
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      // Token de color de marca (ej. "--green") que el usuario elige para su
      // avatar cuando no subió foto. Vacío = se usa el color hasheado del _id.
      // Validado contra utils/avatarColors.js en las rutas que lo escriben.
      color: { type: String, default: "" },
    },
    displayName: {
      type: String,
      default: "",
      maxlength: [60, "Display name cannot exceed 60 characters"],
      trim: true,
    },
    nombre: {
      type: String,
      default: "",
      maxlength: [50, "Nombre cannot exceed 50 characters"],
      trim: true,
    },
    apellido: {
      type: String,
      default: "",
      maxlength: [50, "Apellido cannot exceed 50 characters"],
      trim: true,
    },
    direccion: {
      texto: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Horas antes del evento en las que el user quiere recibir el recordatorio.
    // 0 = opt-out (no recibe nada). Default 24 (mantiene el comportamiento
    // histórico para users existentes). El cron de eventoReminders filtra por
    // este campo cuando decide a quién notificar.
    eventoReminderHours: {
      type: Number,
      enum: [0, 2, 24],
      default: 24,
    },
    // Idioma preferido de la UI y del contenido que el server inicia (emails,
    // push). "es" (español rioplatense) es el default — preserva el
    // comportamiento histórico de todos los usuarios existentes sin migración.
    // Lo setea el toggle de /perfil vía PUT /api/auth/profile.
    language: {
      type: String,
      enum: ["es", "en"],
      default: "es",
    },
    telegram: {
      type: String,
      default: "",
      maxlength: [50, "Telegram username cannot exceed 50 characters"],
      trim: true,
    },
    celular: {
      type: String,
      default: "",
      maxlength: [30, "Phone number cannot exceed 30 characters"],
      trim: true,
    },
    bggUsername: {
      type: String,
      default: "",
      maxlength: [50, "BGG username cannot exceed 50 characters"],
      trim: true,
    },
    bggCredentials: {
      encryptedPassword: { type: String, default: "" },
      connectedAt: { type: Date, default: null },
      lastValidatedAt: { type: Date, default: null },
      invalid: { type: Boolean, default: false },
    },
    bggSync: {
      lastFullSyncAt: { type: Date, default: null },
      lastFullSyncCount: { type: Number, default: 0 },
      lastProbedAt: { type: Date, default: null },
      lastProbeOutcome: {
        type: String,
        enum: ["no_drift", "edits_only", "reconciled", "failed", null],
        default: null,
      },
      // Server-enforced cooldown timestamps for the manual "Actualizar"
      // button on BG Watch panels. Throttled per-panel; state persists
      // across page reloads. See routes/bgg.js helpers
      // getManualRefreshRemainingMs / stampManualRefresh.
      lastManualRefreshPartidasAt: { type: Date, default: null },
      lastManualRefreshColeccionAt: { type: Date, default: null },
      // Freshness del cache materializado BggUserGame (selector "Mis juegos").
      // null = nunca construida / sucia → se reconstruye en la próxima lectura.
      // Ver services/bgg/bggUserGames.js.
      userGamesBuiltAt: { type: Date, default: null },
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    bannedReason: {
      type: String,
      default: "",
      maxlength: [500, "Ban reason cannot exceed 500 characters"],
      trim: true,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequests: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    // ── Comunidades (multi-tenancy suave) ────────────────────────────────
    // Membresías del usuario. El rol subadmin vive EN la membership (un user
    // puede ser subadmin de A y member de B), no es un flag global. Espeja
    // cómo viven friends/friendRequests.
    communityMemberships: [
      {
        _id: false,
        community: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Community",
          required: true,
        },
        role: { type: String, enum: ["member", "subadmin"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    // Preferencias de visualización. `viewing` = subconjunto de comunidades a
    // "ver juntas" (feed combinado); vacío ⇒ "todas las memberships" en lectura
    // (solo se persiste un subconjunto cuando el usuario lo cura). `skin` = la
    // única comunidad cuyo skin se aplica (debe ser una membership).
    communityPrefs: {
      viewing: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
      skin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
        default: null,
      },
    },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCodeHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

// Index para "quién está en la comunidad X" + expulsar/cambiar rol.
userSchema.index({ "communityMemberships.community": 1 });

// Normalize legacy avatar (string) → { url, publicId } on hydrate from DB
userSchema.pre("init", (doc) => {
  if (typeof doc.avatar === "string") {
    doc.avatar = { url: doc.avatar, publicId: "" };
  }
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Case-insensitive username lookup. Usernames are stored case-preserved (so
// "Blackwatch" keeps its capitals) but must be unique ignoring case — a new
// "blackWatch" can't be registered once "Blackwatch" exists. The default
// unique index is case-sensitive, so we match with a collation (strength 2 =
// ignore case, keep accents). Used as the guardrail at registration and OAuth
// auto-naming. Returns the matching doc (truthy) or null.
userSchema.statics.findByUsernameCI = function (username) {
  return this.findOne({ username: String(username || "").trim() }).collation({
    locale: "en",
    strength: 2,
  });
};

// Remove password and BGG credentials from JSON output; expose derived flags
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  const creds = obj.bggCredentials;
  obj.bggConnected = !!(creds && creds.encryptedPassword);
  obj.bggInvalid = !!(creds && creds.invalid);
  obj.bggConnectedAt = creds?.connectedAt || null;
  delete obj.bggCredentials;
  delete obj.emailVerificationCodeHash;
  delete obj.emailVerificationExpiresAt;
  delete obj.emailVerificationAttempts;
  delete obj.passwordResetTokenHash;
  delete obj.passwordResetExpiresAt;
  // Los ids crudos de proveedor no aportan al cliente; authProviders sí.
  delete obj.googleId;
  delete obj.facebookId;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
