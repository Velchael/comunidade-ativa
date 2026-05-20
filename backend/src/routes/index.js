const express = require('express');
const router = express.Router();

const authRoutes          = require('./authRoutes');
const userRoutes          = require('./users');
const taskRoutes          = require('./tasks');
const interaccionesRoutes = require('./interacciones');
const respuestasRoutes    = require('./respuestas');
const comunidadRoutes     = require('./comunidades');
const gruposRoutes        = require('./grupos');
const grupoReportesRoutes = require('./grupoReportesRoutes');
const reportesRoutes      = require('./reportesRoutes');

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/tasks',         taskRoutes);
router.use('/interacciones', interaccionesRoutes);
router.use('/respuestas',    respuestasRoutes);
router.use('/comunidades',   comunidadRoutes);
router.use('/grupos',        gruposRoutes);
router.use('/grupos',        grupoReportesRoutes); // /:grupoId/reportes — sin conflicto
router.use('/reportes',      reportesRoutes);

module.exports = router;
