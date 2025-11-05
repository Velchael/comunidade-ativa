// src/controllers/gruposController.js
const db = require('../models');

// 📍 Listar todos los grupos (según rol)
exports.listarTodosGrupos = async (req, res) => {
  try {
    const { comunidad_id, lider_id } = req.query; // filtros opcionales

    // Construir where dinámico
    const where = {};

    // Si viene comunidad_id por query y el user es admin_total, permitir filtrar por eso
    if (comunidad_id) {
      where.comunidad_id = comunidad_id;
    }

    // Filtrado por lider_id si viene
    if (lider_id) {
      where.lider_id = lider_id;
    }

    let grupos;

    if (req.user.rol === 'admin_total') {
      // Admin total ve todos (pero con filtros si se envían)
      grupos = await db.GrupoActivo.findAll({
        where,
        include: ['lider', 'comunidad']
      });
    } else if (req.user.rol === 'admin_basic') {
      // Admin basic solo su comunidad: forzamos comunidad_id
      where.comunidad_id = req.user.comunidad_id;
      grupos = await db.GrupoActivo.findAll({
        where,
        include: ['lider', 'comunidad']
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
      include: ['lider', 'comunidad']
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
    const grupo = await db.GrupoActivo.findByPk(req.params.id, { include: ['lider', 'comunidad'] });
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
    res.json(grupo);
  } catch (error) {
    console.error('❌ Error al obtener grupo:', error);
    res.status(500).json({ message: 'Error al obtener grupo' });
  }
};

// ✅ Controlador: Crear Grupo
exports.crearGrupo = async (req, res) => {
  try {
    // 1️⃣ Determinar qué lider_id usar (según rol)
    let liderIdToUse;
    if (req.user.rol === 'admin_total' && req.body.lider_id) {
      liderIdToUse = req.body.lider_id; // admin_total puede elegir líder
    } else {
      liderIdToUse = req.user.id; // otros roles solo pueden asignarse a sí mismos
    }

    // 2️⃣ Verificar si ya existe un grupo duplicado
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

    // 3️⃣ Crear grupo
    const nuevoGrupo = await db.GrupoActivo.create({
      ...req.body,
      lider_id: liderIdToUse,
      comunidad_id: req.user.comunidad_id || null
    });

    res.status(201).json(nuevoGrupo);

  } catch (error) {
    console.error('❌ Error al crear grupo:', error);
    res.status(500).json({ message: 'Error al crear grupo' });
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

    await grupo.update(req.body);
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




