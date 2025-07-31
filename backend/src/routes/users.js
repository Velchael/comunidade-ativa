const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');

const authMiddleware = require('../middleware/authMiddleware');
const { onlyAdminTotal } = require('../middleware/roles');


// Rutas públicas
router.post('/register', usersController.createUser);
router.post('/login', usersController.getUserByEmail);
router.post('/google/complete', usersController.completeGoogleProfile);
router.get('/:email', usersController.getUserByEmail);

// Rutas protegidas solo para admin_total
router.get('/', authMiddleware, onlyAdminTotal, usersController.getAllUsers);
router.put('/:id/rol', authMiddleware, onlyAdminTotal, usersController.updateUserRole);
router.delete('/:id', authMiddleware, onlyAdminTotal, usersController.deleteUser);

module.exports = router;

