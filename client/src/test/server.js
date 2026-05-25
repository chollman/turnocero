import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Default handlers — tests can override per case with server.use(...).
export const defaultHandlers = [
  http.get("/api/auth/me", () => HttpResponse.json(null, { status: 401 })),
  http.get("/api/site-config", () =>
    HttpResponse.json({
      sections: {
        mesas: { enabled: true },
        compartidas: { enabled: true },
        noticias: { enabled: true },
        torneos: { enabled: true },
        eventos: { enabled: true },
        comunidad: { enabled: true },
        miFeed: { enabled: true },
        amigos: { enabled: true },
        dms: { enabled: true },
        bgwatch: { enabled: true },
        utilidades: { enabled: true },
      },
    }),
  ),
  http.get("/api/notifications", () => HttpResponse.json([])),
  // Default vacío para /api/eventos/mine — usado por CreateCompartidaForm.
  // Tests específicos pueden overridear con server.use(...).
  http.get("/api/eventos/mine", () => HttpResponse.json({ eventos: [] })),
];

export const server = setupServer(...defaultHandlers);
