const { Usuario, Comunidad } = require('../models');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Crear usuario
const createUser = async (req, res) => {
  try {
    const { email, googleId, ...rest } = req.body;

    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado' });
    }

    const newUser = await Usuario.create({ email, googleId, ...rest });
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

    const user = await Usuario.findOne({
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
  const { email, googleId, username, ...data } = req.body;

  try {
    const user = await Usuario.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.googleId && user.googleId !== String(googleId)) {
      return res.status(403).json({ message: 'Google ID no coincide' });
    }

    if (user.username && user.username !== username) {
      console.log('⚠️ Intento de sobrescribir username ignorado');
    } else {
      data.username = username;
    }

    if (user.apellido && user.fecha_nacimiento) {
      return res.status(400).json({ message: 'Perfil ya fue completado' });
    }

    await user.update(data);
    res.status(200).json({ message: 'Perfil actualizado correctamente' });

  } catch (err) {
    console.error('❌ Error al completar perfil Google:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const users = await Usuario.findAll({
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
  try {
    const { id } = req.params;   // usuario que será editado
    const data = req.body;
    const loggedUser = req.user; // viene del middleware verificarToken

    const user = await Usuario.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // ⚠️ Si se intenta cambiar comunidad_id, solo admin_total puede hacerlo
    if (data.hasOwnProperty('comunidad_id') && loggedUser.rol !== 'admin_total') {
      return res.status(403).json({ message: 'Solo admin_total puede cambiar comunidad' });
    }

    // ⚠️ Si se intenta cambiar rol, solo admin_total puede hacerlo
    if (data.hasOwnProperty('rol') && loggedUser.rol !== 'admin_total') {
      return res.status(403).json({ message: 'Solo admin_total puede cambiar roles' });
    }

    // ⚠️ Si el usuario intenta editar otro usuario y NO es admin_total
    if (loggedUser.rol !== 'admin_total' && loggedUser.id !== user.id) {
      return res.status(403).json({ message: 'No tienes permiso para editar otros usuarios' });
    }

    await user.update(data);

    const updated = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    return res.json(updated);
  } catch (err) {
    console.error('❌ Error al actualizar usuario:', err);
    return res.status(500).json({ message: 'Error actualizando usuario' });
  }
};

// Actualizar solo el rol de usuario
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;

  const validRoles = ['miembro', 'admin_basic', 'admin_total'];
  if (!validRoles.includes(rol)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.rol = rol;
    await user.save();

    res.status(200).json({ message: 'Rol actualizado con éxito' });
  } catch (error) {
    console.error('❌ Error al actualizar rol:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Usuario.findByPk(id);

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

