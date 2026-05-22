/**
 * Helper de permisos para acciones de write dentro del scope de un Evento
 * (ludoteca, mesas del evento, etc.).
 *
 * Permite actuar si:
 *   - el user es admin del sitio (override global), o
 *   - el user es el author/host del evento, o
 *   - el user tiene una registration con status = 'confirmed' en el evento.
 *
 * NO permite:
 *   - guests sin auth (user null)
 *   - registrants pending o rejected (todavía no son "del evento")
 *   - usuarios sin relación con el evento
 *
 * Coherente con el resto del flujo de eventos: el host confirma quiénes
 * realmente van, y sólo esas personas (más el host/admin) pueden poblar
 * la ludoteca y crear mesas del evento.
 *
 * @param {Object} evento  Documento Evento (necesita `author` + `registrations`).
 * @param {Object|null} user  req.user (puede ser null si no hay sesión).
 * @returns {boolean}
 */
function canActInEvento(evento, user) {
  if (!user) return false;
  if (!evento) return false;
  if (user.isAdmin) return true;
  if (String(evento.author) === String(user._id)) return true;
  return (evento.registrations || []).some(
    (r) =>
      String(r.user) === String(user._id) && r.status === 'confirmed',
  );
}

module.exports = { canActInEvento };
