
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


module.exports = {
  createUser,
  getUserByEmail,
  completeGoogleProfile
};
