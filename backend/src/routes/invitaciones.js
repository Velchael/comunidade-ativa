const express = require('express');
const router = express.Router();
const controller = require('../controllers/invitacionesController');
const { verificarToken } = require('../middleware/authMiddleware');

const setNoStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return next();
};

// TODO Fase posterior: aplicar rate limiting antes de validar tokens públicos.
router.get('/validar/:token', controller.validarInvitacion);

router.post(
  '/:token/aceptar',
  setNoStore,
  verificarToken,
  controller.aceptarInvitacion
);

router.patch(
  '/:id/revocar',
  setNoStore,
  verificarToken,
  controller.revocarInvitacion
);

module.exports = router;
