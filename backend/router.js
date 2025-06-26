const express = require('express');
const router = express.Router();
const usersController = require('./src/controllers/usersController');
const tasksRouter = require('./src/routes/tasks');

router.post('/users', usersController.createUsers);
router.post('/users/login', usersController.getUserByUsernameAndPassword);
router.post('/users/confirm', usersController.confirmUserEmail);

router.use('/tasks', tasksRouter); // ← Añadir rutas de tareas

module.exports = router;