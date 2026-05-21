const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const app = express();

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
app.use('/api/torneos', require('./routes/torneos'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/bgg', require('./routes/bgg'));
app.use('/api/dm', require('./routes/dm'));
app.use('/api/admin-chat', require('./routes/adminChat'));
app.use('/api/site-config', require('./routes/siteConfig'));
app.use('/api/geocode', require('./routes/geocode'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Turnocero API is running' });
});

module.exports = app;
