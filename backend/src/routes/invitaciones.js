const express = require('express');
const router = express.Router();
const controller = require('../controllers/invitacionesController');
const { verificarToken } = require('../middleware/authMiddleware');

// TODO Fase posterior: aplicar rate limiting antes de validar tokens públicos.
router.get('/validar/:token', controller.validarInvitacion);

router.patch('/:id/revocar', verificarToken, controller.revocarInvitacion);

module.exports = router;
