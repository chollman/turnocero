const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const multer = require('../config/multer');
const { uploadToCloudinary, cloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');
const { encrypt } = require('../utils/encryption');
const { loginToBgg, clearSession } = require('../utils/bggAuth');
const {
  generateCode,
  generateUrlToken,
  hashToken,
  compareToken,
} = require('../utils/authTokens');
const {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
} = require('../utils/email');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
});

// Stricter limiter for endpoints that trigger outbound email (resend, forgot).
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
});

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

// POST /api/auth/register — public, rate-limited.
// Creates an unverified account, emails a 6-digit code, does NOT issue a JWT.
// Client must call /verify-email with the code to complete signup.
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const code = generateCode();
    const user = await User.create({
      username,
      email,
      password,
      emailVerified: false,
      emailVerificationCodeHash: hashToken(code),
      emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      emailVerificationAttempts: 0,
    });

    // Send email — if it fails we still return 201 so the user can request a resend.
    try {
      const tpl = verificationEmail({ username: user.username, code });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error('Verification email failed at register', { userId: user._id.toString(), msg: mailErr.message });
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('DEV verification code', { email: user.email, code });
    }

    res.status(201).json({
      email: user.email,
      message: 'Te enviamos un código a tu email para verificar la cuenta.',
    });
  } catch (err) {
    logger.error('Register failed', { name: err.name, code: err.code, msg: err.message });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    // MongoDB duplicate key (unique index violation)
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email or username already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login — public, rate-limited
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        code: 'email_not_verified',
        email: user.email,
        message: 'Tenés que verificar tu email antes de iniciar sesión.',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        code: 'banned',
        message: user.bannedReason
          ? `Tu cuenta ha sido suspendida. Motivo: ${user.bannedReason}`
          : 'Tu cuenta ha sido suspendida.',
      });
    }

    const token = generateToken(user._id);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user, token });
  } catch (err) {
    logger.error('Login failed', { name: err.name, code: err.code, msg: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/verify-email — public, rate-limited.
// Body: { email, code }. On success returns { user, token } like /login.
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ message: 'Email y código son requeridos' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
      '+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts'
    );

    // Generic error to avoid leaking which emails are registered / verified.
    const genericFail = () => res.status(400).json({ message: 'Código inválido o expirado' });

    if (!user || user.emailVerified) return genericFail();
    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) return genericFail();
    if (user.emailVerificationExpiresAt.getTime() < Date.now()) return genericFail();

    if ((user.emailVerificationAttempts || 0) >= MAX_VERIFICATION_ATTEMPTS) {
      return res.status(429).json({
        message: 'Demasiados intentos. Pedí un código nuevo.',
      });
    }

    if (!compareToken(code, user.emailVerificationCodeHash)) {
      user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
      await user.save({ validateModifiedOnly: true });
      return genericFail();
    }

    if (user.isBanned) {
      return res.status(403).json({
        code: 'banned',
        message: user.bannedReason
          ? `Tu cuenta ha sido suspendida. Motivo: ${user.bannedReason}`
          : 'Tu cuenta ha sido suspendida.',
      });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationAttempts = 0;
    await user.save({ validateModifiedOnly: true });

    const token = generateToken(user._id);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user, token });
  } catch (err) {
    logger.error('Verify email failed', { msg: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/resend-verification — public, stricter rate limit.
// Always responds 200 with a generic message to avoid leaking account state.
router.post('/resend-verification', emailLimiter, async (req, res) => {
  const generic = { message: 'Si la cuenta existe y no está verificada, te enviamos un nuevo código.' };
  try {
    const { email } = req.body || {};
    if (!email) return res.status(200).json(generic);

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
      '+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts'
    );
    if (!user || user.emailVerified) {
      return res.status(200).json(generic);
    }

    const code = generateCode();
    user.emailVerificationCodeHash = hashToken(code);
    user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
    user.emailVerificationAttempts = 0;
    await user.save({ validateModifiedOnly: true });

    try {
      const tpl = verificationEmail({ username: user.username, code });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error('Resend verification email failed', { userId: user._id.toString(), msg: mailErr.message });
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('DEV verification code (resend)', { email: user.email, code });
    }

    res.status(200).json(generic);
  } catch (err) {
    logger.error('Resend verification failed', { msg: err.message });
    res.status(200).json(generic);
  }
});

// POST /api/auth/forgot-password — public, stricter rate limit.
// Always responds 200 with a generic message.
router.post('/forgot-password', emailLimiter, async (req, res) => {
  const generic = { message: 'Si existe una cuenta con ese email, te enviamos un link para recuperar la contraseña.' };
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

    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${frontend}/restablecer-contrasenia?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      const tpl = passwordResetEmail({ username: user.username, resetUrl });
      await sendEmail({ to: user.email, ...tpl });
    } catch (mailErr) {
      logger.error('Password reset email failed', { userId: user._id.toString(), msg: mailErr.message });
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('DEV password reset link', { email: user.email, resetUrl });
    }

    res.status(200).json(generic);
  } catch (err) {
    logger.error('Forgot password failed', { msg: err.message });
    res.status(200).json(generic);
  }
});

// POST /api/auth/reset-password — public, rate-limited.
// Body: { email, token, password }. On success returns 200 (no auto-login).
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, token, password } = req.body || {};
    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
      '+passwordResetTokenHash +passwordResetExpiresAt'
    );

    const invalid = () =>
      res.status(400).json({ message: 'El link es inválido o expiró. Pedí uno nuevo.' });

    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) return invalid();
    if (user.passwordResetExpiresAt.getTime() < Date.now()) return invalid();
    if (!compareToken(token, user.passwordResetTokenHash)) return invalid();

    user.password = password; // pre-save hook hashes
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    // If the user had never verified their email, completing a password reset
    // (which requires control of the inbox) is sufficient proof of ownership.
    if (!user.emailVerified) user.emailVerified = true;

    await user.save({ validateModifiedOnly: true });
    res.status(200).json({ message: 'Contraseña actualizada' });
  } catch (err) {
    logger.error('Reset password failed', { name: err.name, msg: err.message });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout — public
router.post('/logout', (req, res) => {
  // Express 5 ignores maxAge on clearCookie; pass only the cookie attributes
  // that determine which cookie to clear (path/domain/secure/sameSite/httpOnly).
  const { maxAge: _ignore, ...clearOpts } = COOKIE_OPTIONS;
  res.clearCookie('token', clearOpts);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — protected
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile — protected
router.put('/profile', protect, async (req, res) => {
  try {
    const { displayName, nombre, apellido, direccion, telegram, celular, bggUsername } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (displayName !== undefined) user.displayName = displayName;
    if (nombre !== undefined) user.nombre = nombre;
    if (apellido !== undefined) user.apellido = apellido;
    if (telegram !== undefined) user.telegram = telegram;
    if (celular !== undefined) user.celular = celular;
    if (bggUsername !== undefined) {
      const newBgg = bggUsername.replace(/^@/, '').trim();
      if (newBgg !== user.bggUsername && user.bggCredentials?.encryptedPassword) {
        // Stored credentials are tied to the previous username — clear them
        user.bggCredentials.encryptedPassword = '';
        user.bggCredentials.connectedAt = null;
        user.bggCredentials.lastValidatedAt = null;
        user.bggCredentials.invalid = false;
        clearSession(user._id);
      }
      user.bggUsername = newBgg;
    }
    if (direccion !== undefined) {
      user.direccion = {
        texto: direccion.texto ?? user.direccion?.texto ?? '',
        lat: direccion.lat ?? user.direccion?.lat ?? null,
        lng: direccion.lng ?? user.direccion?.lng ?? null,
      };
    }

    await user.save({ validateModifiedOnly: true });
    res.json(user);
  } catch (err) {
    logger.error('Profile update failed', { msg: err.message });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/avatar — protected, multipart (field: 'avatar')
router.put('/avatar', protect, multer.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Imagen requerida' });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/users/${user._id}`,
      public_id: 'avatar',
      overwrite: true,
      format: 'webp',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto' },
      ],
    });

    user.avatar = { url: result.secure_url, publicId: result.public_id };
    await user.save({ validateModifiedOnly: true });
    res.json(user);
  } catch (err) {
    logger.error('Avatar upload failed', { msg: err.message });
    res.status(500).json({ message: 'Error al subir avatar' });
  }
});

// DELETE /api/auth/avatar — protected
router.delete('/avatar', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.avatar?.publicId) {
      await cloudinary.uploader.destroy(user.avatar.publicId).catch(() => {});
    }
    user.avatar = { url: '', publicId: '' };
    await user.save({ validateModifiedOnly: true });
    res.json(user);
  } catch (err) {
    logger.error('Avatar remove failed', { msg: err.message });
    res.status(500).json({ message: 'Error al quitar avatar' });
  }
});

// POST /api/auth/bgg-connect — validates BGG password and stores encrypted
router.post('/bgg-connect', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password de BGG requerida' });
    }
    const user = req.user;
    if (!user.bggUsername) {
      return res.status(400).json({
        message: 'Configurá primero tu username de BGG en el perfil',
      });
    }

    // Validate by attempting login (do NOT store on failure)
    try {
      await loginToBgg(user.bggUsername, password);
    } catch (e) {
      const status = e.status === 401 ? 401 : 502;
      return res.status(status).json({ message: e.message });
    }

    user.bggCredentials.encryptedPassword = encrypt(password);
    user.bggCredentials.connectedAt = new Date();
    user.bggCredentials.lastValidatedAt = new Date();
    user.bggCredentials.invalid = false;
    await user.save();
    clearSession(user._id);

    // Drop any cached plays/collection/OG for this username so the next
    // /bg-watch read comes fresh from BGG.
    require('./bgg').clearUserCache(user.bggUsername);

    res.json(user);
  } catch (err) {
    logger.error('BGG connect failed', { msg: err.message });
    res.status(500).json({ message: 'Error al conectar con BGG' });
  }
});

// DELETE /api/auth/bgg-connection — removes stored BGG credentials
router.delete('/bgg-connection', protect, async (req, res) => {
  try {
    const user = req.user;
    user.bggCredentials.encryptedPassword = '';
    user.bggCredentials.connectedAt = null;
    user.bggCredentials.lastValidatedAt = null;
    user.bggCredentials.invalid = false;
    await user.save();
    clearSession(user._id);

    res.json(user);
  } catch (err) {
    logger.error('BGG disconnect failed', { msg: err.message });
    res.status(500).json({ message: 'Error al desconectar BGG' });
  }
});

module.exports = router;
