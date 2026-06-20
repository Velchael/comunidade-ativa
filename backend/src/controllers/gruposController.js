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
          { model: db.User, as: 'lider' },
          { model: db.Comunidad, as: 'comunidad' }
        ]
      });
    } else if (req.user.rol === 'admin_basic') {
      where.comunidad_id = req.user.comunidad_id;
      grupos = await db.GrupoActivo.findAll({
        where,
        include: [
          { model: db.User, as: 'lider' },
          { model: db.Comunidad, as: 'comunidad' }
        ]
      });
    } else {
      return res.status(403).json({ message: 'Você não tem permissão para ver todos os grupos' });
    }

    res.json(grupos);
  } catch (error) {
    console.error('❌ Error al listar grupos:', error);
    res.status(500).json({ message: 'Erro ao listar grupos' });
  }
};

// 📍 Listar solo mis grupos
exports.listarMisGrupos = async (req, res) => {
  try {
    const grupos = await db.GrupoActivo.findAll({
      where: { lider_id: req.user.id },
      include: [
        { model: db.User, as: 'lider' },
        { model: db.Comunidad, as: 'comunidad' }
      ]
    });
    res.json(grupos);
  } catch (error) {
    console.error('❌ Error al listar mis grupos:', error);
    res.status(500).json({ message: 'Erro ao listar meus grupos' });
  }
};

// 📍 Obtener un grupo específico
exports.obtenerGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'lider' },
        { model: db.Comunidad, as: 'comunidad' }
      ]
    });
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (req.user.rol === 'admin_total') {
      return res.json(grupo);
    }

    if (req.user.rol === 'admin_basic') {
      if (grupo.comunidad_id === req.user.comunidad_id) return res.json(grupo);
      return res.status(403).json({ message: 'Você não pode ver grupos de outra comunidade' });
    }

    if (grupo.lider_id !== req.user.id) {
      return res.status(403).json({ message: 'Você não tem permissão para ver este grupo' });
    }

    res.json(grupo);
  } catch (error) {
    console.error('❌ Error al obtener grupo:', error);
    res.status(500).json({ message: 'Erro ao obter grupo' });
  }
};

// ✅ Crear Grupo
exports.crearGrupo = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Não autorizado: usuário inválido' });
    }

    let liderIdToUse;
    if (req.user.rol === 'admin_total' && req.body.lider_id) {
      liderIdToUse = req.body.lider_id;
    } else {
      liderIdToUse = req.user.id;
    }

    if (!req.user.comunidad_id) {
      return res.status(400).json({
        message: 'Seu usuário não possui comunidade atribuída. Complete seu perfil antes de criar um grupo.'
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
        message: 'Já existe um grupo cadastrado com esse líder e endereço'
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
    res.status(500).json({ message: 'Erro ao criar grupo no servidor' });
  }
};

// 📍 Actualizar grupo (solo admins)
exports.actualizarGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (req.user.rol === 'admin_basic' && grupo.comunidad_id !== req.user.comunidad_id) {
      return res.status(403).json({ message: 'Você não pode editar grupos de outra comunidade' });
    }

    // ✅ Solo los campos válidos según el modelo
    const { colider_nombre, anfitrion_nombre, direccion_grupo } = req.body;
    await grupo.update({ colider_nombre, anfitrion_nombre, direccion_grupo });

    res.json({ message: 'Grupo atualizado com sucesso', grupo });
  } catch (error) {
    console.error('❌ Error al actualizar grupo:', error);
    res.status(500).json({ message: 'Erro ao atualizar grupo' });
  }
};

// 📍 Eliminar grupo (solo admins)
exports.eliminarGrupo = async (req, res) => {
  try {
    const grupo = await db.GrupoActivo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (req.user.rol === 'admin_basic' && grupo.comunidad_id !== req.user.comunidad_id) {
      return res.status(403).json({ message: 'Você não pode excluir grupos de outra comunidade' });
    }

    await grupo.destroy();
    res.json({ message: 'Grupo excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error al eliminar grupo:', error);
    res.status(500).json({ message: 'Erro ao excluir grupo' });
  }
};
