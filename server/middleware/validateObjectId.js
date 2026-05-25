const mongoose = require("mongoose");

/**
 * Middleware factory: valida que `req.params[paramName]` sea un ObjectId válido.
 * Si no, responde 400 sin tocar la DB — evita un CastError 500 silencioso o
 * un 404 confuso cuando el frontend manda un string mal armado.
 *
 * Uso:
 *   router.get('/:id', validateObjectId('id'), handler);
 *
 * @param {string} paramName - nombre del param en la ruta (default: 'id')
 */
function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ message: "ID inválido" });
    }
    next();
  };
}

module.exports = validateObjectId;
