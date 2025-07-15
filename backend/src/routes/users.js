const express = require('express');
const router = express.Router();

// ✅ Asegurate que la ruta al archivo sea correcta:
const usersController = require('../controllers/usersController');


// ✅ Verificá que exista esta función en el controlador

router.post('/register', usersController.createUser);
router.post('/login', usersController.getUserByEmail);
router.post('/google/complete', usersController.completeGoogleProfile);
router.get('/:email', usersController.getUserByEmail);
module.exports = router;

