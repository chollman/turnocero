// Configuración CORS compartida entre el Express app (app.js) y Socket.IO
// (server.js). Antes vivía duplicada en ambos archivos — un cambio de origen
// requería editar dos lugares y era fácil dejar al socket fuera de sync.
//
// `CORS_ORIGIN` admite múltiples orígenes separados por coma; sin la env var
// se asume desarrollo local contra Vite (puerto 3000).

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

// Para Express: callback dinámico que permite same-origin (sin header Origin)
// y rechaza el resto con un error CORS estándar.
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Para Socket.IO: acepta un array literal en lugar de callback.
const socketCorsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

module.exports = { allowedOrigins, corsOptions, socketCorsOptions };
