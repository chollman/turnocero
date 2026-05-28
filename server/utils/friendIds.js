const User = require("../models/User");

// Lee `User.friends` lean y devuelve un array de strings.
// Usado por listTables y GET /:id en mesas para evaluar visibilidad de
// mesas con privacy='friends'. Devuelve [] si userId es null/undefined.
async function getFriendIds(userId) {
  if (!userId) return [];
  const me = await User.findById(userId).select("friends").lean();
  if (!me || !Array.isArray(me.friends)) return [];
  return me.friends.map((id) => String(id));
}

module.exports = { getFriendIds };
