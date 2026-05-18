const dotenv = require('dotenv');
dotenv.config();

const dns = require('dns');
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const logger = require('./utils/logger');
const { loadSiteConfig } = require('./utils/siteConfig');
const app = require('./app');

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  logger.warn('MONGODB_URI not set, falling back to local default');
}

const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  socket.join(`user:${socket.userId}`);

  try {
    const user = await User.findById(socket.userId).select('isAdmin');
    if (user?.isAdmin) socket.join('admin:room');
  } catch { /* non-fatal */ }

  socket.on('join:table', (tableId) => {
    socket.join(`table:${tableId}`);
  });

  socket.on('leave:table', (tableId) => {
    socket.leave(`table:${tableId}`);
  });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/turnocero';
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB');
    await loadSiteConfig();
    server.listen(PORT, () => {
      logger.info(`Turnocero server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });
