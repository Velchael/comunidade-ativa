
const { Task, Usuario } = require('../models'); // ✅ usando modelos centralizados

// ✅ Obtener todas las tareas (puede filtrar por frecuencia)
const getAllTasks = async (req, res) => {
  try {
    const { frecuencia } = req.query;
    const where = frecuencia ? { frequency: frecuencia } : {};

    const tasks = await Task.findAll({
      where,
      include: {
        model: Usuario,
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

// ✅ Obtener una tarea por ID
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id, {
      include: {
        model: Usuario,
        as: 'creator',
        attributes: ['id', 'email', 'username']
      }
    });

    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Crear nueva tarea
const createTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
  return res.status(403).json({ message: 'No tienes permisos para esta acción' });
  }
  try {
    const { title, description, frequency, dueDate, status, priority } = req.body;
    const userId = req.user.id;

    const task = await Task.create({
      title,
      description,
      frequency,
      dueDate,
      status,
      priority,
      createdBy: userId
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Actualizar una tarea
const updateTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
  return res.status(403).json({ message: 'No tienes permisos para esta acción' });
  }
  try {
    const { id } = req.params;
    const { title, description, frequency, dueDate, status, priority } = req.body;

    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    task.title = title;
    task.description = description;
    task.frequency = frequency;
    task.dueDate = dueDate;
    task.status = status;
    task.priority = priority;

    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Eliminar una tarea
const deleteTask = async (req, res) => {
  if (req.user.rol !== 'admin_total') {
  return res.status(403).json({ message: 'Solo un administrador total puede eliminar tareas' });
  }
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    await task.destroy();
    res.json({ message: 'Tarea eliminada correctamente' });
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


