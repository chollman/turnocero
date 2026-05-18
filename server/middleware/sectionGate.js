const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isSectionEnabled } = require('../utils/siteConfig');

async function ensureUserMaybe(req) {
  if (req.user) return;
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : req.cookies?.token;
  if (!token) return;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch (_) { /* anon */ }
}

function requireSection(name) {
  return async (req, res, next) => {
    if (isSectionEnabled(name)) return next();
    await ensureUserMaybe(req);
    if (req.user?.isAdmin) return next();
    return res.status(403).json({
      code: 'section_disabled',
      section: name,
      message: 'Sección deshabilitada',
    });
  };
}

module.exports = { requireSection };
