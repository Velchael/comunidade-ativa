const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.get('/', auth, tasksController.getAllTasks); // usuarios y admins
router.get('/:id', auth, tasksController.getTaskById); // ambos

router.post('/', auth, admin, tasksController.createTask); // 🔒 solo admin
router.put('/:id', auth, admin, tasksController.updateTask); // 🔒 solo admin
router.delete('/:id', auth, admin, tasksController.deleteTask); // 🔒 solo admin

module.exports = router;
