const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const permisos = require('../middleware/permisosReporte');
const { authenticateToken } = require('../middleware/auth');

// Rutas de reportes dentro de un grupo
router.post('/:grupoId/reportes', authenticateToken, permisos.puedeCrearEditar, reportesController.crearReporte);
router.get('/:grupoId/reportes', authenticateToken, permisos.puedeVer, reportesController.listarReportes);

module.exports = router;
