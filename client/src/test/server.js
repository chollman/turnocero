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
  // YouTube tutoriales — TableDetail incluye TableTutorials, que dispara
  // este fetch al montar. Default vacío hace que la sección no renderice
  // y no contamine el DOM de tests que no la testean explícitamente.
  http.get("/api/youtube/como-se-juega", () =>
    HttpResponse.json({ items: [] }),
  ),
  // Default para el modo "manual" (1 video específico). Mismo principio:
  // los tests que no testean tutoriales no tienen que mockearlo a mano.
  http.get("/api/youtube/video/:videoId", ({ params }) =>
    HttpResponse.json({
      videoId: params.videoId,
      title: "",
      channel: "",
      thumbnail: "",
      duration: "",
    }),
  ),
];

export const server = setupServer(...defaultHandlers);
