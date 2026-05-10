const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
});

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

// POST /api/auth/register — public, rate-limited
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user });
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

    const token = generateToken(user._id);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user });
  } catch (err) {
    logger.error('Login failed', { name: err.name, code: err.code, msg: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout — public
router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — protected
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile — protected
router.put('/profile', protect, async (req, res) => {
  try {
    const { displayName, nombre, apellido, direccion, telegram, celular } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (displayName !== undefined) user.displayName = displayName;
    if (nombre !== undefined) user.nombre = nombre;
    if (apellido !== undefined) user.apellido = apellido;
    if (telegram !== undefined) user.telegram = telegram;
    if (celular !== undefined) user.celular = celular;
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

module.exports = router;
