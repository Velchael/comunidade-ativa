const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const permisos = require('../middleware/permisosReporte');
const { verificarToken } = require('../middleware/authMiddleware');

// Rutas de reportes dentro de un grupo
router.post('/:grupoId/reportes', verificarToken, permisos.puedeCrearEditar, reportesController.crearReporte);
router.get('/:grupoId/reportes', verificarToken, permisos.puedeVer, reportesController.listarReportes);

module.exports = router;
