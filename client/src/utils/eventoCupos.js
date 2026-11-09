// Cupo ocupado de un evento, en un solo lugar para que todas las superficies
// (PosterCard, TimelineRow, TicketStub, EventoDetail, EventoInscripciones)
// muestren el mismo "X/max".
//
// Ocupan cupo:
//   - inscripciones activas (pendientes + confirmadas) — las rechazadas no;
//   - `reservedSpots`: personas anotadas por fuera de la app que el admin
//     carga a mano en el form del evento.

export function getReservedSpots(evento) {
  const n = Number(evento?.reservedSpots);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getOccupiedSpots(evento, { pending, confirmed } = {}) {
  const p = pending ?? evento?.registrationCount?.pending ?? 0;
  const c = confirmed ?? evento?.registrationCount?.confirmed ?? 0;
  return p + c + getReservedSpots(evento);
}
