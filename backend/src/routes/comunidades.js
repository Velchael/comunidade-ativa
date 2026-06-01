const express = require('express');
const router = express.Router();
const controller = require('../controllers/comunidadesController');
const comunidadController = require('../controllers/comunidadesController');
const { verificarToken } = require('../middleware/authMiddleware');

const { onlyAdminTotal } = require('../middleware/roles');
const ownershipComunidad = require('../middleware/ownershipComunidad');

router.get('/', controller.listarComunidades); // Público
router.get('/:id', comunidadController.obtenerComunidadPorId);
router.post('/onboarding', verificarToken, controller.crearComunidadOnboarding);
router.post('/:id/unirse', verificarToken, controller.unirseComunidad);
router.post('/', verificarToken, onlyAdminTotal, controller.crearComunidad);

router.put('/:id', verificarToken, ownershipComunidad, controller.actualizarComunidad);
router.delete('/:id', verificarToken, ownershipComunidad, controller.eliminarComunidad);


module.exports = router;
