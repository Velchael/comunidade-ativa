const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');
const avatarController = require('../controllers/avatarController');
const { verificarToken } = require('../middleware/authMiddleware');
const { receiveAvatar, validateAvatar } = require('../middleware/avatarUpload');
const { onlyAdminTotal } = require('../middleware/roles');

// Rutas públicas
router.post('/register', usersController.createUser);
router.post('/login', usersController.getUserByEmail);
router.post(
  '/google/complete',
  verificarToken,
  usersController.completeGoogleProfile
);
router.get('/me', verificarToken, usersController.getMyProfile);
router.patch('/me', verificarToken, usersController.updateMyProfile);
router.post(
  '/me/avatar',
  verificarToken,
  receiveAvatar,
  validateAvatar,
  avatarController.uploadMyAvatar
);
router.get('/:email', usersController.getUserByEmail);

// ✅ Nueva ruta: actualizar perfil (cualquier usuario autenticado)
// Solo admin_total podrá modificar comunidad_id dentro del controlador
router.put('/:id', verificarToken, usersController.updateUser);

// Rutas protegidas solo para admin_total
router.get('/', verificarToken, onlyAdminTotal, usersController.getAllUsers);
router.put('/:id/rol', verificarToken, onlyAdminTotal, usersController.updateUserRole);
router.delete('/:id', verificarToken, onlyAdminTotal, usersController.deleteUser);

module.exports = router;
