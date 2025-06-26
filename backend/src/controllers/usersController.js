const usersLogin = require('../models/usersLogin');
const jwt = require('jsonwebtoken');

const createUsers = async (req, res) => {
  console.log("📥 Registro recibido:", req.body); // <-- Agrega esto
  try {
    const result = await usersLogin.createUsers(req.body);
    res.status(201).json(result);
  } catch (error) {
     console.error("❌ Error al registrar usuario:", error.message);
     res.status(500).json({ error: error.message });
    if (error.message === 'El correo electrónico ya está registrado') {
      res.status(409).json({ message: error.message });
    } else if (error.message === 'Grupo familiar no encontrado') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Error interno del servidor...' });
    }
  }
};

const getUserByUsernameAndPassword = async (req, res) => {
  console.log("📩 Ruta /users/login accedida");
  const { username, email, password } = req.body;
  try {
    const user = await usersLogin.getUserByUsernameAndPassword(username, email, password);
    if (user) {
      const token = jwt.sign(
        { username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      return res.status(200).json({ token });
    } else {
      return res.status(404).json({ message: 'Usuario no encontrado o email no confirmado' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor interno' });
  }
};

const confirmUserEmail = async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(400).json({ message: 'Token de confirmación no proporcionado' });
    }

    const result = await usersLogin.confirmUserEmail(token);
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'INVALID_TOKEN') {
      return res.status(404).json({ message: 'El token de confirmación no es válido' });
    } else if (error.code === 'USED_TOKEN') {
      return res.status(400).json({ message: 'El token ya ha sido utilizado' });
    } else if (error.code === 'TOKEN_EXPIRED') {
      return res.status(400).json({ message: 'El token ha expirado' });
    }
    return res.status(500).json({ message: 'Error al confirmar el correo electrónico.' });
  }
};

module.exports = {
  createUsers,
  getUserByUsernameAndPassword,
  confirmUserEmail
};
