
const { Task, Usuario } = require('../models');

// ✅ Obtener todas las tareas (puede filtrar por frecuencia y comunidad)
const getAllTasks = async (req, res) => {
  try {
    const { frecuencia } = req.query;
    const user = await Usuario.findByPk(req.user.id);

    const where = {
      ...(frecuencia && { frequency: frecuencia }),
      comunidad_id: user.comunidad_id  // 🔥 Filtrar por comunidad del usuario logueado
    };

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

// ✅ Obtener una tarea por ID (solo si pertenece a su comunidad)
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Usuario.findByPk(req.user.id);

    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: user.comunidad_id
      },
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

// ✅ Crear nueva tarea (asignar comunidad del usuario automáticamente)
const createTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'No tienes permisos para esta acción' });
  }

  try {
    const { title, description, frequency, dueDate, status, priority } = req.body;
    const user = await Usuario.findByPk(req.user.id);
    console.log("Payload recibido para crear tarea:", req.body);
    const task = await Task.create({
      title,
      description,
      frequency,
      due_date: dueDate,
      status,
      priority,
      created_by: user.id,
      comunidad_id: user.comunidad_id  // 🔥 Relación directa
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Actualizar una tarea (solo admins y si pertenece a su comunidad)
const updateTask = async (req, res) => {
  if (!['admin_basic', 'admin_total'].includes(req.user.rol)) {
    return res.status(403).json({ message: 'No tienes permisos para esta acción' });
  }

  try {
    const { id } = req.params;
    const { title, description, frequency, dueDate, status, priority } = req.body;
    const user = await Usuario.findByPk(req.user.id);

    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: user.comunidad_id
      }
    });

    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    Object.assign(task, { title, description, frequency, dueDate, status, priority });

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Eliminar una tarea (solo admin_total y si pertenece a su comunidad)
const deleteTask = async (req, res) => {
  if (req.user.rol !== 'admin_total') {
    return res.status(403).json({ message: 'Solo un administrador total puede eliminar tareas' });
  }

  try {
    const { id } = req.params;
    const user = await Usuario.findByPk(req.user.id);

    const task = await Task.findOne({
      where: {
        id,
        comunidad_id: user.comunidad_id
      }
    });

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

