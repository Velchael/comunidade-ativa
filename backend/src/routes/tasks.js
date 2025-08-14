const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');

const { verificarToken } = require('../middleware/authMiddleware');
const { allowAdmins } = require('../middleware/roles');
router.get('/', verificarToken, tasksController.getAllTasks); // usuarios y admins
router.get('/:id', verificarToken, tasksController.getTaskById); // ambos

router.post('/', verificarToken, allowAdmins, tasksController.createTask); // 🔒 solo admin
router.put('/:id', verificarToken, allowAdmins, tasksController.updateTask); // 🔒 solo admin
router.delete('/:id', verificarToken, allowAdmins, tasksController.deleteTask); // 🔒 solo admin

module.exports = router;
