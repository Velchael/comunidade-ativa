const { User, Comunidad, sequelize } = require('../models');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');
const { buildUserProfileResponse } = require('../utils/buildUserProfileResponse');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pickAllowedFields = (source, allowedFields) => {
  return allowedFields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
    return result;
  }, {});
};

const PUBLIC_USER_FIELDS = [
  'username',
  'apellido',
  'fecha_nacimiento',
  'telefono',
  'direccion',
  'nivel_liderazgo',
  'grupo_familiar_id',
  'estado',
  'foto_perfil',
];

const GOOGLE_PROFILE_FIELDS = [
  'username',
  'apellido',
  'fecha_nacimiento',
  'telefono',
  'direccion',
  'nivel_liderazgo',
  'grupo_familiar_id',
  'estado',
  'foto_perfil',
];

const SELF_UPDATE_FIELDS = [
  'username',
  'apellido',
  'fecha_nacimiento',
  'telefono',
  'direccion',
  'nivel_liderazgo',
  'grupo_familiar_id',
  'estado',
  'foto_perfil',
];

const lockActorAndTargetUsersTx = async ({ actorId, targetId, transaction }) => {
  const ids = [...new Set([Number(actorId), Number(targetId)])]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((left, right) => left - right);
  const lockedUsers = new Map();

  for (const id of ids) {
    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (user) lockedUsers.set(id, user);
  }

  return {
    actor: lockedUsers.get(Number(actorId)) || null,
    target: lockedUsers.get(Number(targetId)) || null
  };
};

// Crear usuario
const createUser = async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'O endereço de e-mail já está cadastrado' });
    }

    const safeData = pickAllowedFields(req.body, PUBLIC_USER_FIELDS);
    const newUser = await User.create({ email, ...safeData });
    res.status(201).json(newUser);
  } catch (error) {
    console.error("❌ Error al registrar usuario:", error.message);
    res.status(500).json({ message: 'Erro ao cadastrar usuário' });
  }
};

// Obtener usuario por email
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({
      where: { email },
      attributes: ['id', 'username', 'apellido', 'fecha_nacimiento', 'email', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: [['nombre_comunidad', 'nombre']] }]
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erro do servidor', error: err.message });
  }
};

// Obtener el perfil del usuario autenticado
const getMyProfile = async (req, res) => {
  try {
    const authenticatedUserId = Number(req.user?.id);

    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const user = await User.findByPk(authenticatedUserId, {
      attributes: [
        'id',
        'username',
        'apellido',
        'email',
        'fecha_nacimiento',
        'telefono',
        'direccion',
        'foto_perfil',
        'rol',
        'rol_global',
        'comunidad_id'
      ],
      include: [{
        model: Comunidad,
        as: 'comunidad',
        attributes: ['id', 'nombre_comunidad', 'owner_user_id']
      }]
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.json(await buildUserProfileResponse(user));
  } catch (error) {
    console.error('❌ Erro ao obter perfil:', error);
    return res.status(500).json({ message: 'Erro ao obter perfil' });
  }
};

// Completar perfil Google
const completeGoogleProfile = async (req, res) => {
  const data = pickAllowedFields(req.body, GOOGLE_PROFILE_FIELDS);

  try {
    const authenticatedUserId = Number(req.user?.id);

    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const user = await User.findByPk(authenticatedUserId);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (!user.googleId) {
      return res.status(403).json({
        message: 'Conta autenticada não está vinculada ao Google'
      });
    }

    if (data.username && user.username && user.username !== data.username) {
      console.log('⚠️ Intento de sobrescribir username ignorado');
      delete data.username;
    } else {
      data.username = data.username || user.username;
    }

    if (user.apellido && user.fecha_nacimiento) {
      return res.status(400).json({ message: 'O perfil já foi concluído' });
    }

    await user.update(data);

    const updatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    res.status(200).json({
      message: 'Perfil atualizado com sucesso',
      user: await buildAuthUserResponse(updatedUser)
    });

  } catch (err) {
    console.error('❌ Error al completar perfil Google:', err);
    res.status(500).json({ message: 'Erro do servidor' });
  }
};

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{
        model: Comunidad,
        as: 'comunidad',
        attributes: [['nombre_comunidad', 'nombre']]
      }],
      order: [['created_at', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter usuários' });
  }
};

// ✅ NUEVA FUNCIÓN: Actualizar usuario completo
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;   // usuario que será editado
    const data = pickAllowedFields(req.body, SELF_UPDATE_FIELDS);
    const loggedUser = req.user; // viene del middleware verificarToken

    const result = await sequelize.transaction(async (transaction) => {
      const { actor, target: user } = await lockActorAndTargetUsersTx({
        actorId: loggedUser?.id,
        targetId: id,
        transaction
      });

      if (!actor) {
        return { status: 401, body: { message: 'Não autenticado' } };
      }

      if (!user) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      // ⚠️ Si el usuario intenta editar otro usuario y NO es admin_total
      const isAdminTotal = actor.rol_global === 'admin_total';
      if (!isAdminTotal && Number(actor.id) !== Number(user.id)) {
        return {
          status: 403,
          body: { message: 'Você não tem permissão para editar outros usuários' }
        };
      }

      if (isAdminTotal) {
        Object.assign(data, pickAllowedFields(req.body, ['comunidad_id', 'rol']));
      }

      if (Object.prototype.hasOwnProperty.call(data, 'comunidad_id')) {
        const currentComunidadId = user.comunidad_id === null
          ? null
          : Number(user.comunidad_id);
        const requestedComunidadId = data.comunidad_id === null || data.comunidad_id === ''
          ? null
          : Number(data.comunidad_id);

        if (currentComunidadId !== requestedComunidadId) {
          return {
            status: 409,
            body: {
              message: 'A comunidade deve ser alterada por um fluxo comunitário específico',
              reason: 'community_change_not_supported'
            }
          };
        }

        delete data.comunidad_id;
      }

      await user.update(data, { transaction });
      return { status: 200 };
    });

    if (result.body) {
      return res.status(result.status).json(result.body);
    }

    const updated = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    return res.json(updated);
  } catch (err) {
    console.error('❌ Error al actualizar usuario:', err);
    return res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
};

// Actualizar solo el rol de usuario
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;

  const validRoles = ['miembro', 'admin_basic', 'admin_total'];
  if (!validRoles.includes(rol)) {
    return res.status(400).json({ message: 'Papel inválido' });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const { actor, target: user } = await lockActorAndTargetUsersTx({
        actorId: req.user?.id,
        targetId: id,
        transaction
      });

      if (!actor || actor.rol_global !== 'admin_total') {
        return { status: 403, body: { message: 'Somente admin_total pode acessar' } };
      }
      if (!user) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      await user.update({ rol }, { transaction });
      return { status: 200 };
    });

    if (result.body) {
      return res.status(result.status).json(result.body);
    }

    return res.status(200).json({ message: 'Papel atualizado com sucesso' });
  } catch (error) {
    console.error('❌ Error al actualizar rol:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sequelize.transaction(async (transaction) => {
      const { actor, target } = await lockActorAndTargetUsersTx({
        actorId: req.user?.id,
        targetId: id,
        transaction
      });

      if (!actor || actor.rol_global !== 'admin_total') {
        return { status: 403, body: { message: 'Somente admin_total pode acessar' } };
      }
      if (!target) {
        return { status: 404, body: { message: 'Usuário não encontrado' } };
      }

      await target.destroy({ transaction });
      return { status: 200, body: { message: 'Usuário excluído com sucesso' } };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
};

module.exports = {
  createUser,
  getMyProfile,
  getUserByEmail,
  completeGoogleProfile,
  getAllUsers,
  updateUser,        // ✅ NUEVO EXPORT
  updateUserRole,
  deleteUser
};
