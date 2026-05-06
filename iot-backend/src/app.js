const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const deviceRoutes = require('./routes/device-routes');
const { notFound, errorHandler } = require('./middleware/error-handler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));
app.use(express.json({ limit: '64kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'romers-vendo-iot-api' }));
app.use('/api', deviceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
