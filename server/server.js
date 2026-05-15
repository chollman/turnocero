const dotenv = require('dotenv');
dotenv.config();

const dns = require('dns');
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const logger = require('./utils/logger');

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  logger.warn('MONGODB_URI not set, falling back to local default');
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Expose io to routes via app
app.set('io', io);

// Socket auth middleware
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

  // Admins auto-join the shared admin chat room
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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/tables/:id/messages', require('./routes/messages'));
app.use('/api/tables/:id/comments', require('./routes/comments'));
app.use('/api/tables/:id/images', require('./routes/images'));
app.use('/api/tables/:id/ratings', require('./routes/ratings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/compartidas', require('./routes/compartidas'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/noticias', require('./routes/noticias'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/bgg', require('./routes/bgg'));
app.use('/api/dm', require('./routes/dm'));
app.use('/api/admin-chat', require('./routes/adminChat'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Turnocero API is running' });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/turnocero';
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    server.listen(PORT, () => {
      logger.info(`Turnocero server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });
