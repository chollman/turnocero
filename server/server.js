const dotenv = require("dotenv");
dotenv.config();

const dns = require("dns");
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Community = require("./models/Community");
const logger = require("./utils/logger");
const { loadSiteConfig } = require("./utils/siteConfig");
const { startSchedulers } = require("./jobs/scheduler");
const app = require("./app");
const { socketCorsOptions } = require("./config/cors");

if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET environment variable is required");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  logger.warn("MONGODB_URI not set, falling back to local default");
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: socketCorsOptions,
});

app.set("io", io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication required"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  // 1) Joins síncronos.
  socket.join(`user:${socket.userId}`);

  // 2) Registrar TODOS los handlers ANTES de cualquier `await` — así cuando
  //    el cliente reciba `connect`, los `socket.on(...)` ya están registrados
  //    y emits inmediatos no se pierden por race con la auth.
  socket.on("join:table", (tableId) => {
    socket.join(`table:${tableId}`);
  });

  socket.on("leave:table", (tableId) => {
    socket.leave(`table:${tableId}`);
  });

  socket.on("join:evento", (eventoId) => {
    socket.join(`evento:${eventoId}`);
  });

  socket.on("leave:evento", (eventoId) => {
    socket.leave(`evento:${eventoId}`);
  });

  // Lista pública /eventos. Opt-in via `join:eventos-list`; los emits a este
  // room evitan datos sensibles (drafts no se broadcastean).
  socket.on("join:eventos-list", () => {
    socket.join("eventos:list");
  });

  socket.on("leave:eventos-list", () => {
    socket.leave("eventos:list");
  });

  // 3) Trabajo async sin bloquear la registración de handlers de arriba.
  try {
    const user = await User.findById(socket.userId).select("isAdmin");
    if (user?.isAdmin) socket.join("admin:room");
  } catch {
    /* non-fatal */
  }
});

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/turnocero";
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info("Connected to MongoDB");
    await loadSiteConfig();
    // Garantizar que la comunidad base exista SIEMPRE: resolveCommunities cae a
    // ella para anónimos y como piso del invariante "viewing nunca vacío" (sin
    // base, `community: { $in: [] }` vaciaría todas las listas).
    await Community.ensureBase();
    // Arrancar cron jobs después de Mongo (necesitan el conn) y antes de listen.
    // No se arrancan desde app.js para que los tests no los disparen.
    startSchedulers({ io });
    server.listen(PORT, () => {
      logger.info(`Turnocero server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("MongoDB connection failed", { error: err.message });
    process.exit(1);
  });
