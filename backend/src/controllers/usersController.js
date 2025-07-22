
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const createUser = async (req, res) => {
  try {
    const { email, googleId, ...rest } = req.body;

    // Verificar si ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado' });
    }

    // Crear nuevo usuario
    const newUser = await User.create({
      email,
      googleId,
      ...rest
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error al registrar usuario:", error.message);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params; // ✅ antes estaba mal: req.body

    const user = await User.findOne({
      where: { email },
      attributes: ['id', 'username', 'apellido', 'fecha_nacimiento', 'email']
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
};


const completeGoogleProfile = async (req, res) => {
 
  const { email, googleId, username, ...data } = req.body;
  
  console.log("📥 Payload recibido:", req.body);
  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.warn('❌ Usuario no encontrado con email:', email);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validar coincidencia opcional de googleId
    if (user.googleId && user.googleId !== String(googleId)) {
      return res.status(403).json({ message: 'Google ID no coincide' });
    }
 // ✅ Bloquear que se sobreescriba username si ya existe
    if (user.username && user.username !== username) {
      console.log('⚠️ Intento de sobrescribir username ignorado');
    } else {
      data.username = username; // solo si no existe o coincide
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
// ✅ Obtener todos los usuarios (solo admin_total)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }, // evita enviar el hash de contraseña
      order: [['created_at', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// ✅ Actualizar el rol de un usuario
// ✅ Actualizar el rol de un usuario
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;

  const validRoles = ['miembro', 'admin_basic', 'admin_total'];

  // 1. Verificar que el nuevo rol sea válido
  if (!validRoles.includes(rol)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    // 2. Buscar al usuario por ID
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // 3. Actualizar y guardar
    user.rol = rol;
    await user.save();

    res.status(200).json({ message: 'Rol actualizado con éxito' });
  } catch (error) {
    console.error('❌ Error al actualizar rol: ❌', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


// ✅ Eliminar un usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

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
  updateUserRole,
  deleteUser
};
