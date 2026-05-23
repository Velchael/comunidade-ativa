// src/routes/reportesRoutes.js
const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const permisos = require('../middleware/permisosReporte');
const { verificarToken } = require('../middleware/authMiddleware');

// Rutas de reporte individual
router.get('/:reporteId', verificarToken, permisos.puedeVer, reportesController.obtenerReporte);
router.put('/:reporteId', verificarToken, permisos.puedeCrearEditar, reportesController.editarReporte);
router.delete('/:reporteId', verificarToken, reportesController.eliminarReporte);

module.exports = router;
