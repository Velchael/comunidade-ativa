// src/controllers/reportesController.js
const { Reporte, GrupoActivo, User } = require('../models');

const puedeAccederGrupo = (user, grupo) => {
  if (user.rol === 'admin_total') return true;
  if (user.rol === 'admin_basic') return grupo.comunidad_id === user.comunidad_id;
  return grupo.lider_id === user.id;
};

// ✅ Crear reporte en un grupo (solo si el usuario es líder/miembro autorizado del grupo)
exports.crearReporte = async (req, res) => {
  try {
    const { grupoId } = req.params;
    const { semana, asistencia, tema, observaciones } = req.body;

    // Verificar si el grupo existe y pertenece a la misma comunidad del usuario
    const grupo = await GrupoActivo.findByPk(grupoId);
    if (!grupo) {
        return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    if (!puedeAccederGrupo(req.user, grupo)) {
      return res.status(403).json({ error: 'Não autorizado a criar relatórios neste grupo' });
    }

    const asistenciaNum = asistencia === '' || asistencia === null || asistencia === undefined
      ? null
      : parseInt(asistencia, 10);

    // Validar que sea un número si el campo no es nulo
    if (asistenciaNum !== null && isNaN(asistenciaNum)) {
      return res.status(400).json({ error: 'O valor de presença deve ser um número válido' });
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

    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error?.parent?.constraint === 'unique_reporte_semana' ||
      error?.original?.constraint === 'unique_reporte_semana'
    ) {
      return res.status(409).json({
        error: 'Já existe um relatório para este grupo nessa semana.'
      });
    }

    res.status(400).json({ error: 'Não foi possível criar o relatório' });
  }
};

// ✅ Listar reportes de un grupo (todos los reportes del grupo activo)
exports.listarReportes = async (req, res) => {
  try {
    const { grupoId } = req.params;

    const grupo = await GrupoActivo.findByPk(grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    if (!puedeAccederGrupo(req.user, grupo)) {
      return res.status(403).json({ error: 'Não autorizado a ver relatórios deste grupo' });
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
    res.status(500).json({ error: 'Erro ao listar relatórios' });
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
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    if (!puedeAccederGrupo(req.user, reporte.grupo)) {
      return res.status(403).json({ error: 'Não autorizado a ver este relatório' });
    }

    res.json(reporte);
  } catch (error) {
    console.error('❌ Error en obtenerReporte:', error);
    res.status(500).json({ error: 'Erro ao obter relatório' });
  }
};

// ✅ Editar reporte (solo creador/líder del grupo)
exports.editarReporte = async (req, res) => {
  try {
    const { reporteId } = req.params;

    const reporte = await Reporte.findByPk(reporteId, {
      include: [{ model: GrupoActivo, as: 'grupo' }],
    });
    if (!reporte) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    if (!puedeAccederGrupo(req.user, reporte.grupo)) {
      return res.status(403).json({ error: 'Não autorizado a editar este relatório' });
    }

    // 🔐 Solo el creador puede editar su reporte
    if (reporte.creador_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado a editar este relatório' });
    }

    await reporte.update(req.body);

    res.json({ mensaje: 'Relatório atualizado com sucesso', reporte });
  } catch (error) {
    console.error('❌ Error en editarReporte:', error);
    res.status(400).json({ error: 'Não foi possível atualizar o relatório' });
  }
};

// ✅ Eliminar reporte (solo admins, o el creador si decides permitirlo)

exports.eliminarReporte = async (req, res) => {
  try {
    const { reporteId } = req.params;

    const reporte = await Reporte.findByPk(reporteId, {
      include: [{ model: GrupoActivo, as: 'grupo' }],
    });

    if (!reporte) {
      return res.status(404).json({
        error: 'Relatório não encontrado'
      });
    }

    // 🔐 Solo admin_total, admin_basic o el creador pueden eliminar
    const esAdmin = req.user.rol === 'admin_total' ||
      (req.user.rol === 'admin_basic' && reporte.grupo?.comunidad_id === req.user.comunidad_id);
    const esCreador = reporte.creador_id === req.user.id;

    if (!esAdmin && !esCreador) {
      return res.status(403).json({
        error: 'Não autorizado a excluir este relatório'
      });
    }

    await reporte.destroy();

    return res.json({
      mensaje: 'Relatório excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ Error en eliminarReporte:', error);

    return res.status(500).json({
      error: 'Não foi possível excluir o relatório'
    });
  }
};
