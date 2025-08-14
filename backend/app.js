const express = require('express');
const cors = require('cors');
require('dotenv').config();
const passport = require('./src/config/passport');
const apiRoutes = require('./src/routes');
const comunidadRoutes = require('./src/routes/comunidades');


const app = express();

const gruposRoutes = require('./src/routes/grupos');
const reunionesRoutes = require('./src/routes/reuniones');

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
app.use('/api/grupos', gruposRoutes);
app.use('/api/reuniones', reunionesRoutes);
module.exports = app;
