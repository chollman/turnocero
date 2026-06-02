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
app.use("/api/noticias", require("./routes/noticias"));
app.use("/api/torneos", require("./routes/torneos"));
app.use("/api/mathtrade", require("./routes/mathtrade"));
app.use("/api/eventos", require("./routes/eventos"));
app.use("/api/calendario", require("./routes/calendario"));
app.use("/api/bgg", require("./routes/bgg"));
app.use("/api/dm", require("./routes/dm"));
app.use("/api/admin-chat", require("./routes/adminChat"));
app.use("/api/site-config", require("./routes/siteConfig"));
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
