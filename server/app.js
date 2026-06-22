const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { corsOptions } = require("./config/cors");

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json());

// i18n: parsea el header Accept-Language y adjunta req.t/req.language a TODAS
// las rutas (fallback "es"). Las rutas usan req.t('ns:key') para localizar
// errores/mensajes; sin header, todo resuelve en español (comportamiento actual).
app.use(require("./i18n").handler);

// Detecta el tenant (subdominio de comunidad) vía header X-Community-Slug y lo
// deja en req.tenant para TODAS las rutas. No toca Mongo si no hay header.
app.use(require("./middleware/resolveCommunities").resolveTenant);

// Contabiliza las llamadas salientes a BGG por request (AsyncLocalStorage).
// No escribe a Mongo si el request no tocó BGG. Va antes de las rutas para
// envolver cualquier handler que dispare fetchBgg (BG Watch, ludoteca, OG).
app.use(require("./middleware/bggUsageContext"));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tables", require("./routes/tables"));
app.use("/api/tables/:id/messages", require("./routes/messages"));
app.use("/api/tables/:id/comments", require("./routes/comments"));
app.use("/api/tables/:id/images", require("./routes/images"));
app.use("/api/tables/:id/ratings", require("./routes/ratings"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/users", require("./routes/users"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/compartidas", require("./routes/compartidas"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/push", require("./routes/push"));
app.use("/api/noticias", require("./routes/noticias"));
app.use("/api/torneos", require("./routes/torneos"));
app.use("/api/mathtrade", require("./routes/mathtrade"));
app.use("/api/eventos", require("./routes/eventos"));
app.use("/api/calendario", require("./routes/calendario"));
app.use("/api/comunidades", require("./routes/comunidades"));
app.use("/api/bgg", require("./routes/bgg"));
app.use("/api/dm", require("./routes/dm"));
app.use("/api/admin-chat", require("./routes/adminChat"));
app.use("/api/site-config", require("./routes/siteConfig"));
app.use("/api/shortlinks", require("./routes/shortlinks"));
app.use("/api/geocode", require("./routes/geocode"));
app.use("/api/youtube", require("./routes/youtube"));
app.use("/api/ideas", require("./routes/ideas"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Turnocero API is running" });
});

// Error handler central — debe ir AL FINAL, después de todas las rutas.
// Captura cualquier error que llegue vía next(err), incluidos los
// promise rejections envueltos por utils/asyncHandler.js.
app.use(require("./middleware/errorHandler"));

module.exports = app;
