const express = require('express');
const cors = require('cors');
require('dotenv').config();
const passport = require('./src/config/passport');
const apiRoutes = require('./src/routes');
const comunidadRoutes = require('./src/routes/comunidades');
const app = express();
const corsOptions = {
  origin: 'http://localhost:3002', // 🚨 Poné aquí el puerto del FRONTEND
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Cargar todas las rutas en /api
app.use('/api', apiRoutes);
app.use('/api/comunidades', comunidadRoutes);
module.exports = app;
