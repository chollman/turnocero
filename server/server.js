const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

dotenv.config();

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  logger.warn('MONGODB_URI not set, falling back to local default');
}

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/bgg', require('./routes/bgg'));

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
    app.listen(PORT, () => {
      logger.info(`Turnocero server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });
