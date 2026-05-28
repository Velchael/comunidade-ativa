const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');

const { verificarToken } = require('../middleware/authMiddleware');
const verificarRolComunidad = require('../middleware/verificarRolComunidad');

const allowTaskAdmins = verificarRolComunidad({
  rolesPermitidos: ['admin_total', 'admin_basic'],
  getComunidadId: (req) => req.user?.comunidad_id,
  permitirAdminTotalGlobal: true
});

const allowTaskAdminTotal = verificarRolComunidad({
  rolesPermitidos: ['admin_total'],
  getComunidadId: (req) => req.user?.comunidad_id,
  permitirAdminTotalGlobal: true
});

router.get('/', verificarToken, tasksController.getAllTasks); // usuarios y admins
router.get('/:id', verificarToken, tasksController.getTaskById); // ambos

router.post('/', verificarToken, allowTaskAdmins, tasksController.createTask); // 🔒 solo admin
router.put('/:id', verificarToken, allowTaskAdmins, tasksController.updateTask); // 🔒 solo admin
router.delete('/:id', verificarToken, allowTaskAdminTotal, tasksController.deleteTask); // 🔒 solo admin

module.exports = router;
