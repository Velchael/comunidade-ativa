// src/controllers/reportesController.js
const { Reporte, GrupoActivo, User } = require('../models');

// ✅ Crear reporte en un grupo (solo si el usuario es líder/miembro autorizado del grupo)
exports.crearReporte = async (req, res) => {
  try {
    const { grupoId } = req.params;
    const { semana, asistencia, tema, observaciones } = req.body;

    // Verificar si el grupo existe y pertenece a la misma comunidad del usuario
    const grupo = await GrupoActivo.findByPk(grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // 🔐 Reglas: admins pueden crear en cualquier grupo; miembros solo si son líderes
    console.log('👤 Usuario autenticado:', req.user);
    console.log('🆔 grupoId recibido:', req.params.grupoId);
    const esAdmin = req.user.rol === 'admin_total' || req.user.rol === 'admin_basic';
    if (!esAdmin && grupo.lider_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado para crear reportes en este grupo' });
    }
    const asistenciaNum = asistencia === '' || asistencia === null || asistencia === undefined
      ? null
      : parseInt(asistencia, 10);

    // Validar que sea un número si el campo no es nulo
    if (asistenciaNum !== null && isNaN(asistenciaNum)) {
      return res.status(400).json({ error: 'El valor de asistencia debe ser un número válido' });
    }

    const nuevo = await Reporte.create({
      grupo_id: grupoId,
      creador_id: req.user.id,
      semana,
      asistencia: asistenciaNum,
      tema,
      observaciones,
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error('❌ Error en crearReporte:', error);
    res.status(400).json({ error: 'No se pudo crear el reporte' });
  }
};

// ✅ Listar reportes de un grupo (todos los reportes del grupo activo)
exports.listarReportes = async (req, res) => {
  try {
    const { grupoId } = req.params;

    const grupo = await GrupoActivo.findByPk(grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const reportes = await Reporte.findAll({
      where: { grupo_id: grupoId },
      include: [
        { model: GrupoActivo, as: 'grupo' },
        { model: User, as: 'creador', attributes: ['id', 'username', 'email'] },
      ],
      order: [['semana', 'DESC']],
    });

    res.json(reportes);
  } catch (error) {
    console.error('❌ Error en listarReportes:', error);
    res.status(500).json({ error: 'Error al listar reportes' });
  }
};

// ✅ Obtener un reporte específico
exports.obtenerReporte = async (req, res) => {
  try {
    const { reporteId } = req.params;

    const reporte = await Reporte.findByPk(reporteId, {
      include: [
        { model: GrupoActivo, as: 'grupo' },
        { model: User, as: 'creador', attributes: ['id', 'username', 'email'] },
      ],
    });

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    res.json(reporte);
  } catch (error) {
    console.error('❌ Error en obtenerReporte:', error);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

// ✅ Editar reporte (solo creador/líder del grupo)
exports.editarReporte = async (req, res) => {
  try {
    const { reporteId } = req.params;

    const reporte = await Reporte.findByPk(reporteId);
    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // 🔐 Solo el creador puede editar su reporte
    if (reporte.creador_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado para editar este reporte' });
    }

    await reporte.update(req.body);

    res.json({ mensaje: 'Reporte actualizado correctamente', reporte });
  } catch (error) {
    console.error('❌ Error en editarReporte:', error);
    res.status(400).json({ error: 'No se pudo actualizar el reporte' });
  }
};

// ✅ Eliminar reporte (solo admins, o el creador si decides permitirlo)

exports.eliminarReporte = async (req, res) => {
  try {
    const { reporteId } = req.params;

    const reporte = await Reporte.findByPk(reporteId);

    if (!reporte) {
      return res.status(404).json({
        error: 'Reporte no encontrado'
      });
    }

    // 🔐 Solo admin_total, admin_basic o el creador pueden eliminar
    const esAdmin = ['admin_total', 'admin_basic'].includes(req.user.rol);
    const esCreador = reporte.creador_id === req.user.id;

    if (!esAdmin && !esCreador) {
      return res.status(403).json({
        error: 'No autorizado para eliminar este reporte'
      });
    }

    await reporte.destroy();

    return res.json({
      mensaje: 'Reporte eliminado correctamente'
    });

  } catch (error) {
    console.error('❌ Error en eliminarReporte:', error);

    return res.status(500).json({
      error: 'No se pudo eliminar el reporte'
    });
  }
};
