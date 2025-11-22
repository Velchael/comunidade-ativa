const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');
const { verificarToken } = require('../middleware/authMiddleware');
const { onlyAdminTotal } = require('../middleware/roles');

// Rutas públicas
router.post('/register', usersController.createUser);
router.post('/login', usersController.getUserByEmail);
router.post('/google/complete', usersController.completeGoogleProfile);
router.get('/:email', usersController.getUserByEmail);

// ✅ Nueva ruta: actualizar perfil (cualquier usuario autenticado)
// Solo admin_total podrá modificar comunidad_id dentro del controlador
router.put('/:id', verificarToken, usersController.updateUser);

// Rutas protegidas solo para admin_total
router.get('/', verificarToken, onlyAdminTotal, usersController.getAllUsers);
router.put('/:id/rol', verificarToken, onlyAdminTotal, usersController.updateUserRole);
router.delete('/:id', verificarToken, onlyAdminTotal, usersController.deleteUser);

module.exports = router;

