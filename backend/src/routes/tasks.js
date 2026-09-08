const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');

const { verificarToken } = require('../middleware/authMiddleware');
const resolveTaskContext = require('../middleware/resolveTaskContext');
const verificarRolComunidad = require('../middleware/verificarRolComunidad');

const taskAuthOptions = {
  getComunidadId: (req) => req.comunidadContext?.comunidad_id,
  rehidratarUsuario: true,
  permitirLegacyGlobal: false
};

const allowTaskRead = verificarRolComunidad({
  ...taskAuthOptions,
  rolesPermitidos: ['admin_total', 'admin_basic', 'miembro']
});

const allowTaskReadExisting = verificarRolComunidad({
  ...taskAuthOptions,
  rolesPermitidos: ['admin_total', 'admin_basic', 'miembro'],
  forbiddenStatus: 404,
  forbiddenMessage: 'Tarefa não encontrada'
});

const allowTaskAdmins = verificarRolComunidad({
  ...taskAuthOptions,
  rolesPermitidos: ['admin_total', 'admin_basic']
});

router.get('/', verificarToken, resolveTaskContext, allowTaskRead, tasksController.getAllTasks);
router.get('/:id', verificarToken, resolveTaskContext, allowTaskReadExisting, tasksController.getTaskById);

router.post('/', verificarToken, resolveTaskContext, allowTaskAdmins, tasksController.createTask);
router.put('/:id', verificarToken, resolveTaskContext, allowTaskReadExisting, allowTaskAdmins, tasksController.updateTask);
router.delete('/:id', verificarToken, resolveTaskContext, allowTaskReadExisting, allowTaskAdmins, tasksController.deleteTask);

module.exports = router;
