const { User, Comunidad, sequelize } = require('../models');
const { syncUserAndPrimaryMembershipTx } = require('../utils/comunidadRoles');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');
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

// Crear usuario
const createUser = async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado' });
    }

    const safeData = pickAllowedFields(req.body, PUBLIC_USER_FIELDS);
    const newUser = await User.create({ email, ...safeData });
    res.status(201).json(newUser);
  } catch (error) {
    console.error("❌ Error al registrar usuario:", error.message);
    res.status(500).json({ message: 'Error al registrar usuario' });
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
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};

// Completar perfil Google
const completeGoogleProfile = async (req, res) => {
  const { email, googleId } = req.body;
  const data = pickAllowedFields(req.body, GOOGLE_PROFILE_FIELDS);

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.googleId && user.googleId !== String(googleId)) {
      return res.status(403).json({ message: 'Google ID no coincide' });
    }

    if (data.username && user.username && user.username !== data.username) {
      console.log('⚠️ Intento de sobrescribir username ignorado');
      delete data.username;
    } else {
      data.username = data.username || user.username;
    }

    if (user.apellido && user.fecha_nacimiento) {
      return res.status(400).json({ message: 'Perfil ya fue completado' });
    }

    await user.update(data);

    const updatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    res.status(200).json({
      message: 'Perfil actualizado correctamente',
      user: await buildAuthUserResponse(updatedUser)
    });

  } catch (err) {
    console.error('❌ Error al completar perfil Google:', err);
    res.status(500).json({ message: 'Error del servidor' });
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
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// ✅ NUEVA FUNCIÓN: Actualizar usuario completo
const updateUser = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;   // usuario que será editado
    const data = pickAllowedFields(req.body, SELF_UPDATE_FIELDS);
    const loggedUser = req.user; // viene del middleware verificarToken

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (loggedUser.rol === 'admin_total') {
      const adminOnlyData = pickAllowedFields(req.body, ['comunidad_id', 'rol']);
      Object.assign(data, adminOnlyData);
    }

    // ⚠️ Si el usuario intenta editar otro usuario y NO es admin_total
    if (loggedUser.rol !== 'admin_total' && loggedUser.id !== user.id) {
      await transaction.rollback();
      return res.status(403).json({ message: 'No tienes permiso para editar otros usuarios' });
    }

    const updatesMembershipState =
      Object.prototype.hasOwnProperty.call(data, 'rol') ||
      Object.prototype.hasOwnProperty.call(data, 'comunidad_id');

    if (updatesMembershipState) {
      await syncUserAndPrimaryMembershipTx({
        user,
        nextRol: Object.prototype.hasOwnProperty.call(data, 'rol') ? data.rol : undefined,
        nextComunidadId: Object.prototype.hasOwnProperty.call(data, 'comunidad_id') ? data.comunidad_id : undefined,
        transaction,
        preserveExistingLocalRole: true,
        forceRoleSync: false,
        syncRoleFromUser: false,
        upsertMembership: true
      });

      const profileOnlyData = { ...data };
      delete profileOnlyData.rol;
      delete profileOnlyData.comunidad_id;

      if (Object.keys(profileOnlyData).length > 0) {
        await user.update(profileOnlyData, { transaction });
      }
    } else {
      await user.update(data, { transaction });
    }

    await transaction.commit();

    const updated = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    return res.json(updated);
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error('❌ Error al actualizar usuario:', err);
    return res.status(500).json({ message: 'Error actualizando usuario' });
  }
};

// Actualizar solo el rol de usuario
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  const transaction = await sequelize.transaction();

  const validRoles = ['miembro', 'admin_basic', 'admin_total'];
  if (!validRoles.includes(rol)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await syncUserAndPrimaryMembershipTx({
      user,
      nextRol: rol,
      nextComunidadId: user.comunidad_id,
      transaction,
      preserveExistingLocalRole: true,
      forceRoleSync: false,
      syncRoleFromUser: false,
      upsertMembership: true
    });

    await transaction.commit();

    res.status(200).json({ message: 'Rol actualizado con éxito' });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error('❌ Error al actualizar rol:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await user.destroy();
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

module.exports = {
  createUser,
  getUserByEmail,
  completeGoogleProfile,
  getAllUsers,
  updateUser,        // ✅ NUEVO EXPORT
  updateUserRole,
  deleteUser
};
