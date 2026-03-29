const express = require('express');
const cors = require('cors');
const passport = require('./src/config/passport');
const apiRoutes = require('./src/routes');
const comunidadRoutes = require('./src/routes/comunidades');

const reportesRoutes = require('./src/routes/reportesRoutes');
const grupoReportesRoutes = require('./src/routes/grupoReportesRoutes');

const app = express();

// Desactivar todas las características de seguridad automáticas de Express
app.disable('x-powered-by');
app.set('trust proxy', true);

// Middleware para eliminar CSP completamente
app.use((req, res, next) => {
  // Sobrescribir setHeader para interceptar CSP
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase().includes('content-security-policy')) {
      return res;
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
