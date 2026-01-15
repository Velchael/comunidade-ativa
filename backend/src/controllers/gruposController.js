// src/controllers/gruposController.js
const db = require('../models');

// 📍 Listar todos los grupos (según rol)
exports.listarTodosGrupos = async (req, res) => {
  try {
    const { comunidad_id, lider_id } = req.query;
    const where = {};

    if (comunidad_id) where.comunidad_id = comunidad_id;
    if (lider_id) where.lider_id = lider_id;

    let grupos;

    if (req.user.rol === 'admin_total') {
      grupos = await db.GrupoActivo.findAll({
        where,
        include: [
          { model: db.Usuario, as: 'lider' },
          { model: db.Comunidad, as: 'comunidad' }
        ]
      });
    } else if (req.user.rol === 'admin_basic') {
      where.comunidad_id = req.user.comunidad_id;
      grupos = await db.GrupoActivo.findAll({
        where,
        include: [
          { model: db.Usuario, as: 'lider' },
          { model: db.Comunidad, as: 'comunidad' }
        ]
      });
    } else {
      return res.status(403).json({ message: 'No tienes permiso para ver todos los grupos' });
    }

    res.json(grupos);
  } catch (error) {
    console.error('❌ Error al listar grupos:', error);
    res.status(500).json({ message: 'Error al listar grupos' });
  }
};

// 📍 Listar solo mis grupos
exports.listarMisGrupos = async (req, res) => {
  try {
    const grupos = await db.GrupoActivo.findAll({
      where: { lider_id: req.user.id },
      include: [
        { model: db.Usuario, as: 'lider' },
        { model: db.Comunidad, as: 'comunidad' }
      ]
    });
    res.json(grupos);
  } catch (error) {
    console.error('❌ Error al listar mis grupos:', error);
    res.status(500).json({ message: 'Error al listar mis grupos' });
  }
};

// 📍 Obtener un grupo específico
exports.obtenerGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id, {
      include: [
        { model: db.Usuario, as: 'lider' },
        { model: db.Comunidad, as: 'comunidad' }
      ]
    });
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
    res.json(grupo);
  } catch (error) {
    console.error('❌ Error al obtener grupo:', error);
    res.status(500).json({ message: 'Error al obtener grupo' });
  }
};

// ✅ Crear Grupo
exports.crearGrupo = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'No autorizado: usuario no válido' });
    }

    let liderIdToUse;
    if (req.user.rol === 'admin_total' && req.body.lider_id) {
      liderIdToUse = req.body.lider_id;
    } else {
      liderIdToUse = req.user.id;
    }

    if (!req.user.comunidad_id) {
      return res.status(400).json({
        message: 'Tu usuario no tiene comunidad asignada. Completa tu perfil antes de crear un grupo.'
      });
    }

    const existente = await db.GrupoActivo.findOne({
      where: {
        lider_id: liderIdToUse,
        comunidad_id: req.user.comunidad_id,
        direccion_grupo: req.body.direccion_grupo
      }
    });

    if (existente) {
      return res.status(409).json({
        message: 'Ya existe un grupo registrado con ese líder y dirección'
      });
    }

    // ✅ Campos corregidos según el modelo real
    const nuevoGrupo = await db.GrupoActivo.create({
      comunidad_id: req.user.comunidad_id,
      lider_id: liderIdToUse,
      colider_nombre: req.body.colider_nombre || null,
      anfitrion_nombre: req.body.anfitrion_nombre || null,
      direccion_grupo: req.body.direccion_grupo
    });

    res.status(201).json(nuevoGrupo);

  } catch (error) {
    console.error('❌ Error al crear grupo:', error);
    res.status(500).json({ message: 'Error al crear grupo en el servidor' });
  }
};

// 📍 Actualizar grupo (solo admins)
exports.actualizarGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });

    if (req.user.rol === 'admin_basic' && grupo.comunidad_id !== req.user.comunidad_id) {
      return res.status(403).json({ message: 'No puedes editar grupos de otra comunidad' });
    }

    // ✅ Solo los campos válidos según el modelo
    const { colider_nombre, anfitrion_nombre, direccion_grupo } = req.body;
    await grupo.update({ colider_nombre, anfitrion_nombre, direccion_grupo });

    res.json({ message: 'Grupo actualizado correctamente', grupo });
  } catch (error) {
    console.error('❌ Error al actualizar grupo:', error);
    res.status(500).json({ message: 'Error al actualizar grupo' });
  }
};

// 📍 Eliminar grupo (solo admins)
exports.eliminarGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });

    if (req.user.rol === 'admin_basic' && grupo.comunidad_id !== req.user.comunidad_id) {
      return res.status(403).json({ message: 'No puedes eliminar grupos de otra comunidad' });
    }

    await grupo.destroy();
    res.json({ message: 'Grupo eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar grupo:', error);
    res.status(500).json({ message: 'Error al eliminar grupo' });
  }
};
