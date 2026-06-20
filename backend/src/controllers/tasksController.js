
const { Task, User } = require('../models');

// ✅ Obtener todas las tareas (puede filtrar por frecuencia y comunidad)
const getAllTasks = async (req, res) => {
  try {
    const { frecuencia } = req.query;
    const where = {
      ...(frecuencia && { frequency: frecuencia }),
      comunidad_id: req.user.comunidad_id
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

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Obtener una tarea por ID (solo si pertenece a su comunidad)
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: req.user.comunidad_id
      },
      include: {
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'username']
      }
    });

    if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Crear nueva tarea (asignar comunidad del usuario automáticamente)
const createTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'Você não tem permissão para esta ação' });
  }

  try {
    const { title, description, frequency, dueDate, status, priority } = req.body;
    const task = await Task.create({
      title,
      description,
      frequency,
      due_date: dueDate,
      status,
      priority,
      created_by: req.user.id,
      comunidad_id: req.user.comunidad_id
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Actualizar una tarea (solo admins y si pertenece a su comunidad)
const updateTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'Você não tem permissão para esta ação' });
  }

  try {
    const { id } = req.params;
    const { title, description, frequency, dueDate, status, priority } = req.body;

    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: req.user.comunidad_id
      }
    });

    if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });

    Object.assign(task, { title, description, frequency, due_date: dueDate, status, priority });

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Eliminar una tarea (solo admin_total y si pertenece a su comunidad)
const deleteTask = async (req, res) => {
  if (req.user.rol !== 'admin_total') {
    return res.status(403).json({ message: 'Somente um administrador total pode excluir tarefas' });
  }

  try {
    const { id } = req.params;

    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: req.user.comunidad_id
      }
    });

    if (!task) return res.status(404).json({ message: 'Tarefa não encontrada' });

    await task.destroy();
    res.json({ message: 'Tarefa excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
