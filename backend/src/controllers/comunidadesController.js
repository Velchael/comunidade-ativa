const { Comunidad, User, ComunidadMiembro, sequelize } = require('../models');
const createToken = require('../utils/createToken');
const {
  lockUserCommunityEligibilityTx
} = require('../utils/comunidadRoles');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');

const SESSION_REFRESH_REQUIRED = {
  reason: 'session_refresh_required',
  message: 'A operação foi concluída, mas não foi possível atualizar a sessão.'
};

const ADMIN_COMMUNITY_FIELDS = [
  'descripcion',
  'direccion',
  'telefono',
  'objetivo',
  'tipo',
  'visibilidad',
  'ciudad',
  'pais'
];

const pickFields = (source, fields) => fields.reduce((result, field) => {
  if (Object.prototype.hasOwnProperty.call(source || {}, field)) {
    result[field] = source[field];
  }
  return result;
}, {});

const lockUsersByAscendingIdTx = async ({ userIds, transaction }) => {
  const ids = [...new Set(userIds.map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((left, right) => left - right);
  const users = new Map();

  for (const id of ids) {
    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (user) users.set(id, user);
  }

  return users;
};

// ✅ Listar comunidades con alias para frontend
exports.listarComunidades = async (req, res) => {
  try {
    const comunidades = await Comunidad.findAll({
      where: { activa: true },
      attributes: [
        'id',
        ['nombre_comunidad', 'nombre'],           // alias = nombre
        ['nombre_administrador', 'administrador'], // alias = administrador
        'telefono',
        'direccion',
        'activa'
      ],
      order: [['id', 'ASC']]
    });

    res.json(comunidades);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar comunidades', error: error.message });
  }
};

// Crear comunidad
exports.crearComunidad = async (req, res) => {
  try {
    const { nombre, administrador } = req.body;
    const publicFields = pickFields(req.body, ADMIN_COMMUNITY_FIELDS);
    const result = await sequelize.transaction(async (transaction) => {
      const eligibility = await lockUserCommunityEligibilityTx({
        userId: req.user?.id,
        transaction
      });

      if (!eligibility.user) {
        return { status: 401, body: { message: 'Não autenticado' } };
      }

      if (eligibility.user.rol_global !== 'admin_total') {
        return { status: 403, body: { message: 'Somente admin_total pode acessar' } };
      }

      if (!eligibility.eligible) {
        return {
          status: 409,
          body: {
            message: 'O usuário já possui uma comunidade ativa',
            reason: 'already_has_community'
          }
        };
      }

      const comunidad = await Comunidad.create({
        nombre_comunidad: nombre,
        nombre_administrador: administrador,
        ...publicFields,
        owner_user_id: eligibility.user.id,
        activa: true
      }, { transaction });

      await ComunidadMiembro.create({
        user_id: eligibility.user.id,
        comunidad_id: comunidad.id,
        rol_comunidad: 'admin_basic',
        estado: 'activo',
        es_principal: true
      }, { transaction });

      await eligibility.user.update({
        comunidad_id: comunidad.id
      }, { transaction });

      return { status: 201, body: comunidad };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Crear comunidad desde onboarding de usuario autenticado sin comunidad
exports.crearComunidadOnboarding = async (req, res) => {
  let committedResult = null;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      administrador,
      objetivo,
      tipo,
      visibilidad,
      ciudad,
      pais
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ message: 'O nome da comunidade é obrigatório' });
    }

    committedResult = await sequelize.transaction(async (transaction) => {
      const eligibility = await lockUserCommunityEligibilityTx({
        userId,
        transaction
      });

      if (!eligibility.user) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      if (!eligibility.eligible) {
        return {
          status: 409,
          body: {
            message: 'O usuário já possui uma comunidade ativa',
            reason: 'already_has_community'
          }
        };
      }

      const user = eligibility.user;
      const comunidad = await Comunidad.create({
        nombre_comunidad: String(nombre).trim(),
        nombre_administrador: administrador || user.username || user.email,
        descripcion: descripcion || null,
        direccion: direccion || null,
        telefono: telefono || null,
        objetivo: objetivo || null,
        tipo: tipo || null,
        visibilidad: visibilidad || 'publica',
        ciudad: ciudad || null,
        pais: pais || null,
        owner_user_id: user.id,
        activa: true
      }, { transaction });

      await ComunidadMiembro.create({
        user_id: user.id,
        comunidad_id: comunidad.id,
        rol_comunidad: 'admin_basic',
        estado: 'activo',
        es_principal: true
      }, { transaction });
      await user.update({
        rol: 'admin_basic',
        comunidad_id: comunidad.id
      }, { transaction });

      return { status: 201, userId: user.id, comunidad };
    });

    if (committedResult.body) {
      return res.status(committedResult.status).json(committedResult.body);
    }

  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const updatedUser = await User.findByPk(committedResult.userId, {
      attributes: [
        'id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId',
        'foto_perfil', 'comunidad_id'
      ],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    const userResponse = await buildAuthUserResponse(updatedUser);

    const token = createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      rol_global: updatedUser.rol_global || updatedUser.rol,
      username: updatedUser.username,
      googleId: updatedUser.googleId || null,
      comunidad_id: updatedUser.comunidad_id || null
    }, '120m');

    return res.status(201).json({
      token,
      user: userResponse,
      comunidad: committedResult.comunidad
    });
  } catch (error) {
    return res.status(500).json(SESSION_REFRESH_REQUIRED);
  }
};

// Unirse a una comunidad existente desde onboarding social
exports.unirseComunidad = async (req, res) => {
  let committedResult = null;

  try {
    const userId = req.user?.id;
    const comunidadId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    if (!Number.isInteger(comunidadId)) {
      return res.status(400).json({ message: 'Comunidade inválida' });
    }

    committedResult = await sequelize.transaction(async (transaction) => {
      const eligibility = await lockUserCommunityEligibilityTx({
        userId,
        targetComunidadId: comunidadId,
        transaction
      });

      if (!eligibility.user) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      const comunidad = eligibility.targetCommunity;
      if (!comunidad || comunidad.activa !== true) {
        return { status: 404, body: { message: 'Comunidade não encontrada' } };
      }

      if (eligibility.targetActiveMembership) {
        if (eligibility.hasOtherRelation) {
          return {
            status: 409,
            body: {
              message: 'O usuário já possui uma comunidade ativa',
              reason: 'already_has_community'
            }
          };
        }

        if (eligibility.targetActiveMembership.es_principal !== true) {
          await eligibility.targetActiveMembership.update(
            { es_principal: true },
            { transaction }
          );
        }

        if (!eligibility.assignedToTarget) {
          await eligibility.user.update(
            { comunidad_id: comunidad.id },
            { transaction }
          );
        }

        return {
          status: 200,
          userId: eligibility.user.id,
          comunidadId: comunidad.id
        };
      }

      if (eligibility.hasOtherRelation) {
        return {
          status: 409,
          body: {
            message: 'O usuário já possui uma comunidade ativa',
            reason: 'already_has_community'
          }
        };
      }

      const inactiveMembership = await ComunidadMiembro.findOne({
        where: {
          user_id: eligibility.user.id,
          comunidad_id: comunidad.id,
          estado: 'inactivo'
        },
        attributes: ['id', 'user_id', 'comunidad_id', 'estado', 'es_principal'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (inactiveMembership) {
        return {
          status: 409,
          body: {
            message: 'A associação com esta comunidade está inativa',
            reason: 'membership_inactive'
          }
        };
      }

      const localRole = eligibility.ownsTarget ? 'admin_basic' : 'miembro';
      await ComunidadMiembro.create({
        user_id: eligibility.user.id,
        comunidad_id: comunidad.id,
        rol_comunidad: localRole,
        estado: 'activo',
        es_principal: true
      }, { transaction });

      const userUpdates = { comunidad_id: comunidad.id };
      if (eligibility.ownsTarget && eligibility.user.rol !== 'admin_total') {
        userUpdates.rol = 'admin_basic';
      }
      await eligibility.user.update(userUpdates, { transaction });

      return {
        status: 200,
        userId: eligibility.user.id,
        comunidadId: comunidad.id
      };
    });

    if (committedResult.body) {
      return res.status(committedResult.status).json(committedResult.body);
    }

  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const updatedUser = await User.findByPk(committedResult.userId, {
      attributes: [
        'id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId',
        'foto_perfil', 'comunidad_id'
      ],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    const userResponse = await buildAuthUserResponse(updatedUser);

    const token = createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      rol_global: updatedUser.rol_global || updatedUser.rol,
      username: updatedUser.username,
      googleId: updatedUser.googleId || null,
      comunidad_id: updatedUser.comunidad_id || null
    }, '120m');

    return res.json({
      token,
      user: userResponse,
      comunidad: updatedUser.comunidad
    });
  } catch (error) {
    return res.status(500).json(SESSION_REFRESH_REQUIRED);
  }
};

// Actualizar comunidad
exports.actualizarComunidad = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const actor = await User.findByPk(req.user?.id, {
        attributes: ['id', 'rol_global'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!actor) {
        return { status: 401, body: { message: 'Não autenticado' } };
      }

      const comunidad = await Comunidad.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!comunidad) {
        return { status: 404, body: { message: 'Não encontrada' } };
      }

      const isOwner = Number(comunidad.owner_user_id) === Number(actor.id);
      if (!isOwner && actor.rol_global !== 'admin_total') {
        return {
          status: 403,
          body: { message: 'Somente o owner ou admin_total pode realizar esta ação' }
        };
      }

      const { nombre, administrador, ...resto } = req.body;
      await comunidad.update({
        nombre_comunidad: nombre,
        nombre_administrador: administrador,
        ...resto
      }, { transaction });

      return { status: 200, body: comunidad };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar comunidade', error: error.message });
  }
};

// Eliminar comunidad
exports.eliminarComunidad = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const actor = await User.findByPk(req.user?.id, {
        attributes: ['id', 'rol_global'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!actor) {
        return { status: 401, body: { message: 'Não autenticado' } };
      }

      const comunidad = await Comunidad.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!comunidad) {
        return { status: 404, body: { message: 'Comunidade não encontrada' } };
      }

      const isOwner = Number(comunidad.owner_user_id) === Number(actor.id);
      if (!isOwner && actor.rol_global !== 'admin_total') {
        return {
          status: 403,
          body: { message: 'Somente o owner ou admin_total pode realizar esta ação' }
        };
      }

      await comunidad.destroy({ transaction });
      return { status: 200, body: { message: 'Comunidade excluída' } };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir comunidade', error: error.message });
  }
};

// ✅ Obtener una comunidad por ID (para frontend/contexto)
exports.obtenerComunidadPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const comunidad = await Comunidad.findByPk(id);

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidade não encontrada' });
    }

    res.json(comunidad);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter comunidade', error: error.message });
  }
};

// ✅ Listar miembros de una comunidad
exports.listarMiembrosComunidad = async (req, res) => {
  try {
    const comunidadId = Number(req.params.id);

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidade inválida' });
    }

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'owner_user_id']
    });

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidade não encontrada' });
    }

    const membresias = await ComunidadMiembro.findAll({
      where: { comunidad_id: comunidadId },
      attributes: ['user_id', 'rol_comunidad', 'estado', 'es_principal'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'rol', 'rol_global'],
        required: true
      }],
      order: [
        ['es_principal', 'DESC'],
        ['rol_comunidad', 'ASC'],
        [{ model: User, as: 'user' }, 'username', 'ASC'],
        ['user_id', 'ASC']
      ]
    });

    const miembros = membresias.map((membresia) => {
      const isOwner = Number(comunidad.owner_user_id) === Number(membresia.user_id);
      const rolGlobal = membresia.user?.rol_global || membresia.user?.rol || 'miembro';
      const isAdminTotalGlobal = rolGlobal === 'admin_total';

      return {
        user_id: membresia.user_id,
        username: membresia.user?.username || null,
        email: membresia.user?.email || null,
        rol_comunidad: membresia.rol_comunidad,
        rol_comunidad_effective: isOwner ? 'admin_basic' : membresia.rol_comunidad,
        rol_global: rolGlobal,
        is_admin_total_global: isAdminTotalGlobal,
        estado: membresia.estado,
        es_principal: membresia.es_principal,
        is_owner: isOwner,
        can_edit_local_role: !isOwner && !isAdminTotalGlobal
      };
    });

    return res.json({
      comunidad_id: comunidadId,
      total: miembros.length,
      miembros
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao listar membros da comunidade',
      error: error.message
    });
  }
};

exports.actualizarRolMiembroComunidad = async (req, res) => {
  try {
    const comunidadId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const { rol_comunidad } = req.body || {};
    const actorId = Number(req.user?.id);

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidade inválida' });
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: 'Usuário inválido' });
    }

    if (!['admin_basic', 'moderador', 'miembro'].includes(rol_comunidad)) {
      return res.status(400).json({
        message: 'rol_comunidad inválido. Só é permitido admin_basic, moderador ou miembro'
      });
    }

    if (actorId === Number(targetUserId)) {
      return res.status(403).json({
        message: 'Você não pode alterar seu próprio papel local nesta fase'
      });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const lockedUsers = await lockUsersByAscendingIdTx({
        userIds: [actorId, targetUserId],
        transaction
      });
      const actor = lockedUsers.get(actorId);
      const targetUser = lockedUsers.get(targetUserId);

      if (!actor) {
        return { status: 401, body: { message: 'Não autenticado' } };
      }
      if (!targetUser) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      const comunidad = await Comunidad.findByPk(comunidadId, {
        attributes: ['id', 'owner_user_id'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!comunidad) {
        return { status: 404, body: { message: 'Comunidade não encontrada' } };
      }

      const actorIsOwner = Number(comunidad.owner_user_id) === actorId;
      const actorMembership = actorIsOwner || actor.rol_global === 'admin_total'
        ? null
        : await ComunidadMiembro.findOne({
            where: {
              user_id: actorId,
              comunidad_id: comunidadId,
              estado: 'activo',
              rol_comunidad: 'admin_basic'
            },
            transaction,
            lock: transaction.LOCK.UPDATE
          });
      if (!actorIsOwner && actor.rol_global !== 'admin_total' && !actorMembership) {
        return {
          status: 403,
          body: { message: 'Você não tem permissão para administrar papéis nesta comunidade' }
        };
      }

      if (Number(comunidad.owner_user_id) === Number(targetUserId)) {
        return {
          status: 403,
          body: { message: 'Não é possível modificar o papel local do owner da comunidade' }
        };
      }

      const targetMembership = await ComunidadMiembro.findOne({
        where: { user_id: targetUserId, comunidad_id: comunidadId },
        attributes: ['user_id', 'comunidad_id', 'rol_comunidad', 'estado', 'es_principal'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!targetMembership) {
        return {
          status: 404,
          body: { message: 'Associação não encontrada para essa comunidade' }
        };
      }

      if (targetUser.rol_global === 'admin_total') {
        return {
          status: 403,
          body: { message: 'Você não pode modificar o papel local de um admin_total' }
        };
      }

      if (targetMembership.rol_comunidad !== rol_comunidad) {
        await targetMembership.update({ rol_comunidad }, { transaction });
      }

      return {
        status: 200,
        body: {
          message: 'Papel comunitário atualizado',
          comunidad_id: comunidadId,
          miembro: {
            user_id: targetMembership.user_id,
            username: targetUser.username || null,
            email: targetUser.email || null,
            rol_comunidad,
            estado: targetMembership.estado,
            es_principal: targetMembership.es_principal,
            is_owner: false
          }
        }
      }
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao atualizar papel comunitário',
      error: error.message
    });
  }
};
