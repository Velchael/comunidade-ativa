const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const auth = require('../middleware/authMiddleware');

const { allowAdmins } = require('../middleware/roles');
router.get('/', auth, tasksController.getAllTasks); // usuarios y admins
router.get('/:id', auth, tasksController.getTaskById); // ambos

router.post('/', auth, allowAdmins, tasksController.createTask); // 🔒 solo admin
router.put('/:id', auth, allowAdmins, tasksController.updateTask); // 🔒 solo admin
router.delete('/:id', auth, allowAdmins, tasksController.deleteTask); // 🔒 solo admin

module.exports = router;
