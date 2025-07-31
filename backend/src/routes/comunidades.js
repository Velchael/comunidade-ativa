const express = require('express');
const router = express.Router();
const controller = require('../controllers/comunidadesController');
const { authenticateToken } = require('../middleware/auth');
const { onlyAdminTotal } = require('../middleware/roles');

router.get('/', controller.listarComunidades); // Público
router.post('/', authenticateToken, onlyAdminTotal, controller.crearComunidad);

router.put('/:id', authenticateToken, onlyAdminTotal, controller.actualizarComunidad);
router.delete('/:id', authenticateToken, onlyAdminTotal, controller.eliminarComunidad);


module.exports = router;
