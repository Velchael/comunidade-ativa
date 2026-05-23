const express = require('express');
const router = express.Router();
const controller = require('../controllers/comunidadesController');
const comunidadController = require('../controllers/comunidadesController');
const { verificarToken } = require('../middleware/authMiddleware');

const { onlyAdminTotal } = require('../middleware/roles');

router.get('/', controller.listarComunidades); // Público
router.get('/:id', comunidadController.obtenerComunidadPorId); // ✅ NUEVO
router.post('/', verificarToken, onlyAdminTotal, controller.crearComunidad);

router.put('/:id', verificarToken, onlyAdminTotal, controller.actualizarComunidad);
router.delete('/:id', verificarToken, onlyAdminTotal, controller.eliminarComunidad);


module.exports = router;
