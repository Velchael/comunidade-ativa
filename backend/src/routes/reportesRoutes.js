// src/routes/reportesRoutes.js
const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const permisos = require('../middleware/permisosReporte');
const { authenticateToken } = require('../middleware/auth');

// Rutas de reporte individual
router.get('/:reporteId', authenticateToken, permisos.puedeVer, reportesController.obtenerReporte);
router.put('/:reporteId', authenticateToken, permisos.puedeCrearEditar, reportesController.editarReporte);
router.delete('/:reporteId', authenticateToken, permisos.puedeEliminar, reportesController.eliminarReporte);

module.exports = router;
