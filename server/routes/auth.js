const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const multer = require("../config/multer");
const { uploadToCloudinary, cloudinary } = require("../config/cloudinary");
const logger = require("../utils/logger");
const { encrypt } = require("../utils/encryption");
const { loginToBgg, clearSession } = require("../utils/bggAuth");
const {
  generateCode,
  generateUrlToken,
  hashToken,
  compareToken,
} = require("../utils/authTokens");
const {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
} = require("../utils/email");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isValidAvatarColor } = require("../utils/avatarColors");
const { findOrCreateOAuthUser } = require("../services/oauthService");
const communityService = require("../services/communityService");
const { OAuth2Client } = require("google-auth-library");

// Cliente reutilizable para validar access tokens de Google vía getTokenInfo
// (devuelve aud/sub/email/email_verified). El aud se chequea contra
// GOOGLE_CLIENT_ID en la ruta.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again in 15 minutes" },
});

// Stricter limiter for endpoints that trigger outbound email (resend, forgot).
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again in 15 minutes" },
});

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Helper: convierte un Mongoose ValidationError o un E11000 (dup key) en un
// httpError 400 con mensaje user-facing. Los demás errores se dejan pasar al
// errorHandler central como 500 genérico.
function rethrowAsValidation(err) {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    throw httpError(400, messages[0]);
  }
  if (err.code === 11000) {
    throw httpError(400, "Email or username already in use");
  }
  throw err;
}

// POST /api/auth/register — public, rate-limited.
// Creates an unverified account, emails a 6-digit code, does NOT issue a JWT.
// Client must call /verify-email with the code to complete signup.
router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, email, password, displayName, avatarColor } = req.body;

    if (!username || !email || !password) {
      throw httpError(400, "All fields are required");
    }

    // Username único ignorando mayúsculas/minúsculas: "Blackwatch" se guarda
    // tal cual, pero un alta posterior de "blackWatch" (mismo nombre, otro
    // casing) se rechaza. El índice unique es case-sensitive, así que validamos
    // acá con la búsqueda case-insensitive. (El email ya es único por estar
    // normalizado a lowercase en el schema.)
    if (await User.findByUsernameCI(username)) {
      throw httpError(400, "Username already in use");
    }

    const code = generateCode();
    let user;
    try {
      user = await User.create({
        username,
        email,
        password,
        // displayName/avatarColor son opcionales (los manda el registro nuevo).
        // El color es cosmético: si viene inválido lo ignoramos en vez de
        // bloquear el alta. displayName se valida por maxlength en el schema.
        ...(displayName ? { displayName } : {}),
        ...(isValidAvatarColor(avatarColor)
          ? { avatar: { color: avatarColor } }
          : {}),
        emailVerified: false,
        emailVerificationCodeHash: hashToken(code),
        emailVerificationExpiresAt: new Date(
          Date.now() + VERIFICATION_CODE_TTL_MS,
        ),
        emailVerificationAttempts: 0,
      });
    } catch (err) {
      logger.error("Register failed", {
        name: err.name,
        code: err.code,
        msg: err.message,
      });
      rethrowAsValidation(err);
    }

    // eslint-disable-next-line no-warning-comments
    // Todo usuario pertenece a la comunidad base desde el alta (membership +
    // skin base). Sin esto quedaría sin comunidad y con prefs inconsistentes.
    await communityService.ensureBaseMembership(user);

    // Si se registró desde un subdominio de comunidad, queda miembro de esa
    // comunidad automáticamente (ignora joinPolicy). No-op si no hay tenant.
    await communityService.ensureTenantMembership(user, req.tenant);

    // Send email — if it fails we still return 201 so the user can request a resend.
    try {
      const tpl = verificationEmail({ username: user.username, code });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error("Verification email failed at register", {
        userId: user._id.toString(),
        msg: mailErr.message,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info("DEV verification code", { email: user.email, code });
    }

    res.status(201).json({
      email: user.email,
      message: "Te enviamos un código a tu email para verificar la cuenta.",
    });
  }),
);

// POST /api/auth/login — public, rate-limited.
// Acepta `identifier` (email O username) — el campo `email` se mantiene como
// alias por compatibilidad. La búsqueda matchea email (guardado lowercase) o
// username (case-preservado, match exacto) con un $or.
router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, email, password } = req.body;
    const loginId = (identifier ?? email ?? "").trim();

    if (!loginId || !password) {
      throw httpError(400, "Email or username and password are required");
    }

    const user = await User.findOne({
      $or: [{ email: loginId.toLowerCase() }, { username: loginId }],
    });
    if (!user) throw httpError(401, "Invalid credentials");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw httpError(401, "Invalid credentials");

    // Email not verified + banned son control flow, NO errores — necesitamos
    // mandar fields extra (code, email, message). El errorHandler solo
    // expone { message }, así que estos van con res.status().json() directo.
    if (!user.emailVerified) {
      return res.status(403).json({
        code: "email_not_verified",
        email: user.email,
        message: "Tenés que verificar tu email antes de iniciar sesión.",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        code: "banned",
        message: user.bannedReason
          ? `Tu cuenta ha sido suspendida. Motivo: ${user.bannedReason}`
          : "Tu cuenta ha sido suspendida.",
      });
    }

    // Login desde un subdominio de comunidad → auto-join a esa comunidad
    // (ignora joinPolicy). No-op fuera de modo tenant.
    await communityService.ensureTenantMembership(user, req.tenant);

    const token = generateToken(user._id);

    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user, token });
  }),
);

// POST /api/auth/verify-email — public, rate-limited.
// Body: { email, code }. On success returns { user, token } like /login.
router.post(
  "/verify-email",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) throw httpError(400, "Email y código son requeridos");

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts",
    );

    // Generic error to avoid leaking which emails are registered / verified.
    const genericFailMsg = "Código inválido o expirado";

    if (!user || user.emailVerified) throw httpError(400, genericFailMsg);
    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      throw httpError(400, genericFailMsg);
    }
    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw httpError(400, genericFailMsg);
    }

    if ((user.emailVerificationAttempts || 0) >= MAX_VERIFICATION_ATTEMPTS) {
      throw httpError(429, "Demasiados intentos. Pedí un código nuevo.");
    }

    if (!compareToken(code, user.emailVerificationCodeHash)) {
      user.emailVerificationAttempts =
        (user.emailVerificationAttempts || 0) + 1;
      await user.save({ validateModifiedOnly: true });
      throw httpError(400, genericFailMsg);
    }

    // Banned check: control flow con code:banned (mismo motivo que /login).
    if (user.isBanned) {
      return res.status(403).json({
        code: "banned",
        message: user.bannedReason
          ? `Tu cuenta ha sido suspendida. Motivo: ${user.bannedReason}`
          : "Tu cuenta ha sido suspendida.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationAttempts = 0;
    await user.save({ validateModifiedOnly: true });

    // Verificación desde un subdominio de comunidad → auto-join (ignora joinPolicy).
    await communityService.ensureTenantMembership(user, req.tenant);

    const token = generateToken(user._id);
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user, token });
  }),
);

// Emite la sesión para un usuario OAuth ya resuelto: chequea baneo (mismo
// contrato code:banned que /login) y, si está OK, setea cookie + responde
// { user, token }. Devuelve true si ya respondió (baneado).
function respondBannedIfNeeded(res, user) {
  if (!user.isBanned) return false;
  res.status(403).json({
    code: "banned",
    message: user.bannedReason
      ? `Tu cuenta ha sido suspendida. Motivo: ${user.bannedReason}`
      : "Tu cuenta ha sido suspendida.",
  });
  return true;
}

// POST /api/auth/oauth/google — public, rate-limited.
// Body: { accessToken } — el access token que devuelve el flujo implícito de
// Google Identity Services (hook useGoogleLogin del cliente). Usamos access
// token (no ID token) para poder renderizar un botón propio acorde al theme.
// Validación: getTokenInfo confirma que el token fue emitido para NUESTRO
// client (aud — anti token-substitution) y que el email está verificado;
// luego enriquecemos nombre/foto con userinfo (best-effort).
router.post(
  "/oauth/google",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { accessToken } = req.body || {};
    if (!accessToken) throw httpError(400, "Falta el token de Google");
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw httpError(503, "Login con Google no está configurado");
    }

    let info;
    try {
      info = await googleClient.getTokenInfo(accessToken);
    } catch {
      throw httpError(401, "Token de Google inválido");
    }

    // El token tiene que haber sido emitido para nuestro client ID.
    if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw httpError(401, "Token de Google inválido");
    }
    // El endpoint tokeninfo de Google devuelve email_verified como string
    // "true" (no booleano), y getTokenInfo no lo convierte — toleramos ambos.
    const emailVerified =
      info.email_verified === true || info.email_verified === "true";
    if (!info.email || !emailVerified) {
      throw httpError(401, "Tu email de Google no está verificado");
    }

    // Nombre/foto son best-effort: si userinfo falla, seguimos sin ellos.
    let profile = {};
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) profile = await r.json();
    } catch {
      /* sin nombre/foto */
    }

    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerId: info.sub,
      email: info.email,
      name: profile.name,
      picture: profile.picture,
    });

    if (respondBannedIfNeeded(res, user)) return;

    // Garantiza membership + skin base (incluye cuentas OAuth ya existentes que
    // se crearon antes de Comunidades). Idempotente.
    await communityService.ensureBaseMembership(user);

    // OAuth desde un subdominio de comunidad → auto-join (ignora joinPolicy).
    await communityService.ensureTenantMembership(user, req.tenant);

    const token = generateToken(user._id);
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user, token });
  }),
);

// POST /api/auth/oauth/facebook — public, rate-limited.
// Body: { accessToken } — el access token que devuelve el FB JS SDK.
// Lo valida contra Graph API (debug_token, que confirma app_id + is_valid) y
// luego lee el perfil; sin email otorgado, falla.
router.post(
  "/oauth/facebook",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { accessToken } = req.body || {};
    if (!accessToken) throw httpError(400, "Falta el token de Facebook");
    if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
      throw httpError(503, "Login con Facebook no está configurado");
    }

    const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;

    let debug;
    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
          accessToken,
        )}&access_token=${encodeURIComponent(appToken)}`,
      );
      debug = (await debugRes.json())?.data;
    } catch {
      throw httpError(401, "No pudimos validar el token de Facebook");
    }

    if (!debug?.is_valid || debug.app_id !== process.env.FB_APP_ID) {
      throw httpError(401, "Token de Facebook inválido");
    }

    let profile;
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      profile = await meRes.json();
    } catch {
      throw httpError(401, "No pudimos leer tu perfil de Facebook");
    }

    if (!profile?.id) throw httpError(401, "Token de Facebook inválido");
    if (!profile.email) {
      throw httpError(400, "No pudimos obtener tu email de Facebook");
    }

    const user = await findOrCreateOAuthUser({
      provider: "facebook",
      providerId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture?.data?.url,
    });

    if (respondBannedIfNeeded(res, user)) return;

    // Garantiza membership + skin base (incluye cuentas OAuth ya existentes que
    // se crearon antes de Comunidades). Idempotente.
    await communityService.ensureBaseMembership(user);

    // OAuth desde un subdominio de comunidad → auto-join (ignora joinPolicy).
    await communityService.ensureTenantMembership(user, req.tenant);

    const token = generateToken(user._id);
    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user, token });
  }),
);

// POST /api/auth/resend-verification — public, stricter rate limit.
// Always responds 200 with a generic message to avoid leaking account state.
// Por eso el handler mantiene su propio try/catch (los catch caen también a
// 200 generic en vez de bubble al errorHandler).
router.post("/resend-verification", emailLimiter, async (req, res) => {
  const generic = {
    message:
      "Si la cuenta existe y no está verificada, te enviamos un nuevo código.",
  };
  try {
    const { email } = req.body || {};
    if (!email) return res.status(200).json(generic);

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts",
    );
    if (!user || user.emailVerified) {
      return res.status(200).json(generic);
    }

    const code = generateCode();
    user.emailVerificationCodeHash = hashToken(code);
    user.emailVerificationExpiresAt = new Date(
      Date.now() + VERIFICATION_CODE_TTL_MS,
    );
    user.emailVerificationAttempts = 0;
    await user.save({ validateModifiedOnly: true });

    try {
      const tpl = verificationEmail({ username: user.username, code });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error("Resend verification email failed", {
        userId: user._id.toString(),
        msg: mailErr.message,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info("DEV verification code (resend)", {
        email: user.email,
        code,
      });
    }

    res.status(200).json(generic);
  } catch (err) {
    logger.error("Resend verification failed", { msg: err.message });
    res.status(200).json(generic);
  }
});

// POST /api/auth/forgot-password — public, stricter rate limit.
// Always responds 200 with a generic message. Mismo motivo que resend.
router.post("/forgot-password", emailLimiter, async (req, res) => {
  const generic = {
    message:
      "Si existe una cuenta con ese email, te enviamos un link para recuperar la contraseña.",
  };
  try {
    const { email } = req.body || {};
    if (!email) return res.status(200).json(generic);

    const normalized = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(200).json(generic);

    const rawToken = generateUrlToken();
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save({ validateModifiedOnly: true });

    const frontend = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/$/, "");
    const resetUrl = `${frontend}/restablecer-contrasenia?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      const tpl = passwordResetEmail({ username: user.username, resetUrl });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error("Password reset email failed", {
        userId: user._id.toString(),
        msg: mailErr.message,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info("DEV password reset link", { email: user.email, resetUrl });
    }

    res.status(200).json(generic);
  } catch (err) {
    logger.error("Forgot password failed", { msg: err.message });
    res.status(200).json(generic);
  }
});

// POST /api/auth/reset-password — public, rate-limited.
// Body: { email, token, password }. On success returns 200 (no auto-login).
router.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, token, password } = req.body || {};
    if (!email || !token || !password)
      throw httpError(400, "Datos incompletos");

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    const invalidMsg = "El link es inválido o expiró. Pedí uno nuevo.";

    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      throw httpError(400, invalidMsg);
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now())
      throw httpError(400, invalidMsg);
    if (!compareToken(token, user.passwordResetTokenHash))
      throw httpError(400, invalidMsg);

    user.password = password; // pre-save hook hashes
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    // If the user had never verified their email, completing a password reset
    // (which requires control of the inbox) is sufficient proof of ownership.
    if (!user.emailVerified) user.emailVerified = true;

    try {
      await user.save({ validateModifiedOnly: true });
    } catch (err) {
      logger.error("Reset password failed", {
        name: err.name,
        msg: err.message,
      });
      rethrowAsValidation(err);
    }
    res.status(200).json({ message: "Contraseña actualizada" });
  }),
);

// POST /api/auth/logout — public
router.post("/logout", (req, res) => {
  // Express 5 ignores maxAge on clearCookie; pass only the cookie attributes
  // that determine which cookie to clear (path/domain/secure/sameSite/httpOnly).
  const { maxAge: _ignore, ...clearOpts } = COOKIE_OPTIONS;
  res.clearCookie("token", clearOpts);
  res.json({ message: "Logged out" });
});

// GET /api/auth/me — protected
router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile — protected
router.put(
  "/profile",
  protect,
  asyncHandler(async (req, res) => {
    const {
      displayName,
      nombre,
      apellido,
      direccion,
      telegram,
      celular,
      bggUsername,
      eventoReminderHours,
      avatarColor,
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) throw httpError(404, "User not found");

    if (displayName !== undefined) user.displayName = displayName;
    // Color de avatar (sólo aplica cuando no hay foto). "" lo limpia; un token
    // válido lo setea; cualquier otra cosa se ignora. Preserva url/publicId.
    if (avatarColor !== undefined) {
      if (avatarColor === "" || isValidAvatarColor(avatarColor)) {
        user.avatar.color = avatarColor;
      }
    }
    if (nombre !== undefined) user.nombre = nombre;
    if (apellido !== undefined) user.apellido = apellido;
    if (telegram !== undefined) user.telegram = telegram;
    if (celular !== undefined) user.celular = celular;
    if (bggUsername !== undefined) {
      const newBgg = bggUsername.replace(/^@/, "").trim();
      if (
        newBgg !== user.bggUsername &&
        user.bggCredentials?.encryptedPassword
      ) {
        // Stored credentials are tied to the previous username — clear them
        user.bggCredentials.encryptedPassword = "";
        user.bggCredentials.connectedAt = null;
        user.bggCredentials.lastValidatedAt = null;
        user.bggCredentials.invalid = false;
        clearSession(user._id);
      }
      user.bggUsername = newBgg;
    }
    if (direccion !== undefined) {
      user.direccion = {
        texto: direccion.texto ?? user.direccion?.texto ?? "",
        lat: direccion.lat ?? user.direccion?.lat ?? null,
        lng: direccion.lng ?? user.direccion?.lng ?? null,
      };
    }
    if (eventoReminderHours !== undefined) {
      // Coerción explícita: el cliente puede mandar string del <select>.
      const n = Number(eventoReminderHours);
      if (![0, 2, 24].includes(n)) {
        throw httpError(400, "Valor inválido para recordatorios");
      }
      user.eventoReminderHours = n;
    }

    try {
      await user.save({ validateModifiedOnly: true });
    } catch (err) {
      logger.error("Profile update failed", { msg: err.message });
      rethrowAsValidation(err);
    }
    res.json(user);
  }),
);

// PUT /api/auth/avatar — protected, multipart (field: 'avatar')
router.put(
  "/avatar",
  protect,
  multer.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "Imagen requerida");
    const user = await User.findById(req.user._id);
    if (!user) throw httpError(404, "User not found");

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/users/${user._id}`,
      public_id: "avatar",
      overwrite: true,
      format: "webp",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
      ],
    });

    // Preservamos el color elegido: si más adelante quita la foto, vuelve a
    // mostrarse con su color en vez del hash del _id.
    user.avatar = {
      url: result.secure_url,
      publicId: result.public_id,
      color: user.avatar?.color || "",
    };
    await user.save({ validateModifiedOnly: true });
    res.json(user);
  }),
);

// DELETE /api/auth/avatar — protected
router.delete(
  "/avatar",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw httpError(404, "User not found");
    if (user.avatar?.publicId) {
      await cloudinary.uploader.destroy(user.avatar.publicId).catch(() => {});
    }
    // Quita la foto pero conserva el color elegido para el fallback de inicial.
    user.avatar = { url: "", publicId: "", color: user.avatar?.color || "" };
    await user.save({ validateModifiedOnly: true });
    res.json(user);
  }),
);

// POST /api/auth/bgg-connect — validates BGG password and stores encrypted
router.post(
  "/bgg-connect",
  protect,
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password || typeof password !== "string") {
      throw httpError(400, "Password de BGG requerida");
    }
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá primero tu username de BGG en el perfil");
    }

    // Validate by attempting login (do NOT store on failure)
    try {
      await loginToBgg(user.bggUsername, password);
    } catch (e) {
      const status = e.status === 401 ? 401 : 502;
      throw httpError(status, e.message);
    }

    user.bggCredentials.encryptedPassword = encrypt(password);
    user.bggCredentials.connectedAt = new Date();
    user.bggCredentials.lastValidatedAt = new Date();
    user.bggCredentials.invalid = false;
    await user.save();
    clearSession(user._id);

    // Drop any cached plays/collection/OG for this username so the next
    // /bg-watch read comes fresh from BGG.
    const bggRouter = require("./bgg");
    await bggRouter.clearUserCache(user.bggUsername);

    // Kick off the first full reconcile in the background. The response
    // returns immediately; the user will see their plays appear in
    // /bg-watch once the reconcile completes (typically seconds to
    // minutes depending on history size). This closes the gap where a
    // freshly-connected user had no BggPlay data until they manually
    // clicked "Sincronizar con BGG".
    bggRouter.triggerBackgroundReconcile(user.bggUsername);

    res.json(user);
  }),
);

// DELETE /api/auth/bgg-connection — removes stored BGG credentials
router.delete(
  "/bgg-connection",
  protect,
  asyncHandler(async (req, res) => {
    const user = req.user;
    user.bggCredentials.encryptedPassword = "";
    user.bggCredentials.connectedAt = null;
    user.bggCredentials.lastValidatedAt = null;
    user.bggCredentials.invalid = false;
    await user.save();
    clearSession(user._id);

    res.json(user);
  }),
);

module.exports = router;
