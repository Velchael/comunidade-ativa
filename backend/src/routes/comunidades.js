const express = require('express');
const router = express.Router();
const controller = require('../controllers/comunidadesController');
const comunidadController = require('../controllers/comunidadesController');
const { verificarToken } = require('../middleware/authMiddleware');

const { onlyAdminTotal } = require('../middleware/roles');
const ownershipComunidad = require('../middleware/ownershipComunidad');
const allowListarMiembrosComunidad = require('../middleware/allowListarMiembrosComunidad');
const allowGestionarRolesComunidad = require('../middleware/allowGestionarRolesComunidad');
const allowGestionarInvitacionesComunidad = require('../middleware/allowGestionarInvitacionesComunidad');
const invitacionesController = require('../controllers/invitacionesController');

const setNoStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return next();
};

router.get('/', controller.listarComunidades); // Público
router.get('/:id/miembros', verificarToken, allowListarMiembrosComunidad, controller.listarMiembrosComunidad);
router.patch('/:id/miembros/:userId/rol', verificarToken, allowGestionarRolesComunidad, controller.actualizarRolMiembroComunidad);
router.post('/:id/invitaciones', setNoStore, verificarToken, allowGestionarInvitacionesComunidad, invitacionesController.crearInvitacion);
router.get('/:id/invitaciones', verificarToken, allowGestionarInvitacionesComunidad, invitacionesController.listarInvitacionesComunidad);
router.get('/:id', comunidadController.obtenerComunidadPorId);
router.post('/onboarding', verificarToken, controller.crearComunidadOnboarding);
router.post('/:id/unirse', verificarToken, controller.unirseComunidad);
router.post('/', verificarToken, onlyAdminTotal, controller.crearComunidad);

router.put('/:id', verificarToken, ownershipComunidad, controller.actualizarComunidad);
router.delete('/:id', verificarToken, ownershipComunidad, controller.eliminarComunidad);


module.exports = router;
