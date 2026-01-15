const express = require('express');
const cors = require('cors');
require('dotenv').config();
const passport = require('./src/config/passport');
const apiRoutes = require('./src/routes');
const comunidadRoutes = require('./src/routes/comunidades');

const reportesRoutes = require('./src/routes/reportesRoutes');
const grupoReportesRoutes = require('./src/routes/grupoReportesRoutes');

const app = express();

// Desactivar CSP automático de Express (Nginx maneja CSP)
app.use((req, res, next) => {
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'content-security-policy') {
      return;
    }
    return originalSetHeader.call(this, name, value);
  };
  next();
});

const gruposRoutes = require('./src/routes/grupos');

const corsOptions = {
  origin: [ process.env.FRONTEND_URL || "http://localhost:3001" ], // 🚨 Poné aquí el puerto del FRONTEND
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

// Ahora separados
app.use('/api/grupos', grupoReportesRoutes);   // para colección por grupo
app.use('/api/reportes', reportesRoutes);      // para un reporte puntual

module.exports = app;
