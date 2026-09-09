const db = require('../models');
const agendaNotificationService = require('../services/agendaNotificationService');

const FREQUENCIES = ['semanal', 'mensual', 'anual'];
const STATUSES = ['pendiente', 'en_progreso', 'completada', 'cancelada'];
const PRIORITIES = ['baja', 'media', 'alta'];

const normalizeDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
};

const validateTaskPayload = (body, { partial = false } = {}) => {
  const values = {};

  if (!partial || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string') {
      return { error: 'Título inválido' };
    }

    const title = body.title.trim();
    if (!title) {
      return { error: 'Título inválido' };
    }

    values.title = title;
  }

  if (!partial || Object.hasOwn(body, 'description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { error: 'Descrição inválida' };
    }

    values.description = body.description;
  }

  if (!partial || Object.hasOwn(body, 'frequency')) {
    if (!FREQUENCIES.includes(body.frequency)) {
      return { error: 'Frequência inválida' };
    }

    values.frequency = body.frequency;
  }

  if (!partial || Object.hasOwn(body, 'dueDate')) {
    const dueDate = normalizeDateOnly(body.dueDate);
    if (!dueDate) {
      return { error: 'Data de vencimento inválida' };
    }

    values.due_date = dueDate;
  }

  if (Object.hasOwn(body, 'status')) {
    if (!STATUSES.includes(body.status)) {
      return { error: 'Status inválido' };
    }

    values.status = body.status;
  } else if (!partial) {
    values.status = 'pendiente';
  }

  if (Object.hasOwn(body, 'priority')) {
    if (!PRIORITIES.includes(body.priority)) {
      return { error: 'Prioridade inválida' };
    }

    values.priority = body.priority;
  } else if (!partial) {
    values.priority = 'media';
  }

  return { values };
};

const getComunidadAuthId = (req) => req.comunidadAuth?.comunidad_id;

const snapshotTaskForNotification = (task) => ({
  id: task.id,
  title: task.title,
  due_date: task.due_date,
  status: task.status,
  comunidad_id: task.comunidad_id,
});

const deliverAgendaNotification = async (delivery, logger) => {
  try {
    await delivery();
  } catch (error) {
    logger.error?.('post-save agenda notification delivery error');
  }
};

const createTasksController = ({
  Task = db.Task,
  User = db.User,
  agendaNotifications = agendaNotificationService,
  logger = console,
} = {}) => {
  // ✅ Obtener todas las tareas (puede filtrar por frecuencia y comunidad)
  const getAllTasks = async (req, res) => {
    try {
      const { frecuencia } = req.query;
      if (frecuencia && !FREQUENCIES.includes(frecuencia)) {
        return res.status(400).json({ message: 'Frequência inválida' });
      }

      const where = {
        ...(frecuencia && { frequency: frecuencia }),
        comunidad_id: getComunidadAuthId(req)
      };

      const tasks = await Task.findAll({
        where,
        include: {
          model: User,
          as: 'creator',
          attributes: ['id', 'email', 'username']
        },
        order: [['created_at', 'DESC']]
      });

      return res.json(tasks);
    } catch (error) {
      logger.error?.('getAllTasks error:', error.message);
      return res.status(500).json({ message: 'Erro ao buscar tarefas' });
    }
  };

  // ✅ Obtener una tarea por ID (solo si pertenece a su comunidad)
  const getTaskById = async (req, res) => {
    try {
      const { id } = req.params;
      const task = await Task.findOne({
        where: {
          id,
          comunidad_id: getComunidadAuthId(req)
        },
        include: {
          model: User,
          as: 'creator',
          attributes: ['id', 'email', 'username']
        }
      });

      if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });
      return res.json(task);
    } catch (error) {
      logger.error?.('getTaskById error:', error.message);
      return res.status(500).json({ message: 'Erro ao buscar tarefa' });
    }
  };

  // ✅ Crear nueva tarea (asignar comunidad del usuario automáticamente)
  const createTask = async (req, res) => {
    try {
      const { values, error } = validateTaskPayload(req.body);
      if (error) {
        return res.status(400).json({ message: error });
      }

      const task = await Task.create({
        ...values,
        created_by: req.user.id,
        comunidad_id: getComunidadAuthId(req)
      });

      await deliverAgendaNotification(
        () => agendaNotifications.notifyTaskCreated(task, req.user.id),
        logger
      );

      return res.status(201).json(task);
    } catch (error) {
      logger.error?.('createTask error:', error.message);
      return res.status(500).json({ message: 'Erro ao criar tarefa' });
    }
  };

  // ✅ Actualizar una tarea (solo admins y si pertenece a su comunidad)
  const updateTask = async (req, res) => {
    try {
      const { id } = req.params;
      const { values, error } = validateTaskPayload(req.body, { partial: true });
      if (error) {
        return res.status(400).json({ message: error });
      }

      const task = await Task.findOne({
        where: {
          id,
          comunidad_id: getComunidadAuthId(req)
        }
      });

      if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });

      const previousTask = snapshotTaskForNotification(task);
      Object.assign(task, values);

      await task.save();
      await deliverAgendaNotification(
        () => agendaNotifications.notifyTaskUpdated(previousTask, task, req.user.id),
        logger
      );

      return res.json(task);
    } catch (error) {
      logger.error?.('updateTask error:', error.message);
      return res.status(500).json({ message: 'Erro ao atualizar tarefa' });
    }
  };

  // ✅ Eliminar una tarea (solo admin_total y si pertenece a su comunidad)
  const deleteTask = async (req, res) => {
    try {
      const { id } = req.params;

      const task = await Task.findOne({
        where: {
          id,
          comunidad_id: getComunidadAuthId(req)
        }
      });

      if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });

      const deletedTask = snapshotTaskForNotification(task);
      await task.destroy();
      await deliverAgendaNotification(
        () => agendaNotifications.notifyTaskDeleted(deletedTask, req.user.id),
        logger
      );

      return res.json({ message: 'Tarefa excluída com sucesso' });
    } catch (error) {
      logger.error?.('deleteTask error:', error.message);
      return res.status(500).json({ message: 'Erro ao excluir tarefa' });
    }
  };

  return {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
  };
};

module.exports = {
  ...createTasksController(),
  createTasksController,
  normalizeDateOnly,
  validateTaskPayload,
  snapshotTaskForNotification,
};
