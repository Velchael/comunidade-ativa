// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Usuario, Comunidad } = require('../models'); // Ajusta según index.js de models
const createToken = require('../utils/createToken');
require('dotenv').config();

// LOGIN por email + password (POST /auth/login)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y password son requeridos' });

    const user = await Usuario.findOne({
      where: { email },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    if (!user.password) return res.status(401).json({ message: 'Usuario no tiene password (usar Google Sign-In)' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    const payload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      googleId: user.googleId || null,
      comunidad_id: user.comunidad_id || null
    };

    const token = createToken(payload, '120m');

    // devolver user enriquecido
    const userResponse = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      comunidad_id: user.comunidad_id,
      comunidadNombre: user.comunidad ? user.comunidad.nombre_comunidad : null,
      apellido: user.apellido || null
    };

    return res.json({ token, user: userResponse });
  } catch (err) {
    console.error('❌ authController.login error:', err);
    return res.status(500).json({ message: 'Error al autenticar' });
  }
};

// Google callback existing (tu versión). Aquí solamente se firma y redirige con token
const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ message: 'Error en autenticación Google (usuario inválido)' });

    const payload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      googleId: user.googleId,
      comunidad_id: user.comunidad_id || null
    };

    const token = createToken(payload, '30m'); // token de redirección más corto
    const redirectURL = `${process.env.FRONTEND_URL}/seinscrever?token=${token}`;
    return res.redirect(redirectURL);
  } catch (err) {
    console.error('❌ Error en callback Google:', err.message);
    return res.status(500).json({ message: 'Error interno en autenticación con Google' });
  }
};

// GET /auth/me : devuelve datos del user basado en token (token debe ser válido -> verificar middleware)
const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });

    const user = await Usuario.findByPk(userId, {
      attributes: ['id', 'email', 'rol', 'username', 'apellido', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    return res.json({
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      apellido: user.apellido || null,
      comunidad_id: user.comunidad_id,
      comunidadNombre: user.comunidad ? user.comunidad.nombre_comunidad : null
    });
  } catch (err) {
    console.error('❌ authController.getMe error:', err);
    return res.status(500).json({ message: 'Error obteniendo usuario' });
  }
};

// GET /auth/refresh : acepta token expirado pero con firma válida y devuelve nuevo token + user
const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Token requerido para refresh' });

    let payload;
    try {
      // Verificamos firma aunque esté expirado
      payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      console.error('Token inválido para refresh:', err.message);
      return res.status(401).json({ message: 'Token inválido para refresh' });
    }

    if (!payload?.id) return res.status(400).json({ message: 'Payload inválido en token' });

    // Obtener usuario actual desde DB (para reflejar cambios de rol/comunidad)
    const user = await Usuario.findByPk(payload.id, {
      attributes: ['id', 'email', 'rol', 'username', 'apellido', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado para refresh' });

    const newPayload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      googleId: user.googleId || null,
      comunidad_id: user.comunidad_id || null
    };

    const newToken = createToken(newPayload, '120m');

    const userResponse = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      username: user.username,
      apellido: user.apellido || null,
      comunidad_id: user.comunidad_id,
      comunidadNombre: user.comunidad ? user.comunidad.nombre_comunidad : null
    };

    return res.json({ token: newToken, user: userResponse });
  } catch (err) {
    console.error('❌ Error al generar nuevo token (refresh):', err.message);
    return res.status(500).json({ message: 'Error al generar nuevo token' });
  }
};

module.exports = {
  login,
  googleCallback,
  getMe,
  refreshToken
};




