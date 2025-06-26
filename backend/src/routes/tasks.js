const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

router.get('/', auth, tasksController.getAllTasks);           // Todos pueden leer
router.get('/:id', auth, tasksController.getTaskById);        // Todos pueden ver una
router.post('/', auth, admin, tasksController.createTask);    // Solo admin
router.put('/:id', auth, admin, tasksController.updateTask);  // Solo admin
router.delete('/:id', auth, admin, tasksController.deleteTask); // Solo admin

module.exports = router;
