const express = require('express');
const cors = require('cors');
const passport = require('./src/config/passport');
const apiRoutes = require('./src/routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

const corsOptions = {
  origin: [process.env.FRONTEND_URL || 'http://localhost:3001'],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Todas las rutas centralizadas en src/routes/index.js
app.use('/api', apiRoutes);

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no capturado:', err);
  res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' });
});

module.exports = app;
