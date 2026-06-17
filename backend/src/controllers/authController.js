// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Comunidad } = require('../models');
const createToken = require('../utils/createToken');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');
require('dotenv').config();

const MAX_REFRESH_AGE_SECONDS = 7 * 24 * 60 * 60;

// LOGIN por email + password (POST /auth/login)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y password son requeridos' });

    const user = await User.findOne({
      where: { email },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    if (!user.password) return res.status(401).json({ message: 'Usuario no tiene password (usar Google Sign-In)' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    const payload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      rol_global: user.rol_global || user.rol,
      username: user.username,
      googleId: user.googleId || null,
      comunidad_id: user.comunidad_id || null
    };

    const token = createToken(payload, '120m');

    const userResponse = await buildAuthUserResponse(user);

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
      rol_global: user.rol_global || user.rol,
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

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    return res.json(await buildAuthUserResponse(user));
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

    if (!payload.iat) {
      return res.status(401).json({ message: 'Token inválido para refresh' });
    }

    const tokenAgeSeconds = Math.floor(Date.now() / 1000) - payload.iat;
    if (tokenAgeSeconds > MAX_REFRESH_AGE_SECONDS) {
      return res.status(401).json({ message: 'Token expirado para refresh' });
    }

    // Obtener usuario actual desde DB (para reflejar cambios de rol/comunidad)
    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado para refresh' });

    const newPayload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      rol_global: user.rol_global || user.rol,
      username: user.username,
      googleId: user.googleId || null,
      comunidad_id: user.comunidad_id || null
    };

    const newToken = createToken(newPayload, '120m');

    const userResponse = await buildAuthUserResponse(user);

    return res.json({ token: newToken, user: userResponse });
  } catch (err) {
    console.error('❌ Error al generar nuevo token (refresh):', err.message);
    return res.status(500).json({ message: 'Error al generar nuevo token' });
  }
};

module.exports = {
  buildUserResponse: buildAuthUserResponse,
  login,
  googleCallback,
  getMe,
  refreshToken
};
