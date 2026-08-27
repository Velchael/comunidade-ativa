// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Comunidad, AuthSession, sequelize } = require('../models');
const createToken = require('../utils/createToken');
const { createAccessToken } = require('../utils/createToken');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthSessionError,
  createAuthSessionService
} = require('../services/authSessionService');
const { REFRESH_COOKIE_NAME } = require('../utils/authCookies');
const { setRefreshCookie, clearRefreshCookie } = require('../utils/authCookies');
require('dotenv').config();

const MAX_REFRESH_AGE_SECONDS = 7 * 24 * 60 * 60;
const authSessionService = createAuthSessionService({ AuthSession, sequelize });

const REFRESH_401_CODES = new Set([
  'AUTH_REFRESH_MISSING',
  'AUTH_REFRESH_MALFORMED',
  'AUTH_SESSION_NOT_FOUND',
  'AUTH_SESSION_REVOKED',
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_REFRESH_INVALID',
  'AUTH_REFRESH_REUSE'
]);

const TERMINATED_SESSION_CODES = new Set([
  'AUTH_SESSION_NOT_FOUND',
  'AUTH_SESSION_REVOKED',
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_REFRESH_REUSE'
]);

const readCookie = (req, name) => {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch (_) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
};

const isLocalHttpRequest = (req) => (
  process.env.NODE_ENV === 'development' &&
  req.protocol === 'http' &&
  (req.hostname === 'localhost' || req.hostname === '127.0.0.1')
);

const cookieContext = (req) => ({ isLocalHttp: isLocalHttpRequest(req) });

const loadAuthoritativeUser = (userId) => User.findByPk(userId, {
  attributes: [
    'id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'foto_perfil', 'comunidad_id'
  ],
  include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
});

const buildAccessPayload = (user) => ({
  id: user.id,
  email: user.email,
  rol: user.rol,
  rol_global: user.rol_global || user.rol,
  username: user.username,
  googleId: user.googleId || null,
  comunidad_id: user.comunidad_id || null
});

const sendNewAuthResponse = async (res, user, credential, session, req) => {
  const userResponse = await buildAuthUserResponse(user);
  const accessToken = createAccessToken(buildAccessPayload(user));
  setRefreshCookie(res, credential, session, cookieContext(req));
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: userResponse
  });
};

// LOGIN por email + password (POST /auth/login)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });

    const user = await User.findOne({
      where: { email },
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(401).json({ message: 'Usuário ou senha incorretos' });

    if (!user.password) return res.status(401).json({ message: 'Usuário não possui senha (use o login com Google)' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Usuário ou senha incorretos' });

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
    return res.status(500).json({ message: 'Erro ao autenticar' });
  }
};

// Google callback existing (tu versión). Aquí solamente se firma y redirige con token
const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ message: 'Erro na autenticação Google (usuário inválido)' });

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
    return res.status(500).json({ message: 'Erro interno na autenticação com Google' });
  }
};

// GET /auth/me : devuelve datos del user basado en token (token debe ser válido -> verificar middleware)
const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Não autenticado' });

    const user = await User.findByPk(userId, {
      attributes: [
        'id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'foto_perfil', 'comunidad_id'
      ],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    return res.json(await buildAuthUserResponse(user));
  } catch (err) {
    console.error('❌ authController.getMe error:', err);
    return res.status(500).json({ message: 'Erro ao obter usuário' });
  }
};

// GET /auth/refresh : acepta token expirado pero con firma válida y devuelve nuevo token + user
const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Token obrigatório para refresh' });

    let payload;
    try {
      // Verificamos firma aunque esté expirado
      payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      console.error('Token inválido para refresh:', err.message);
      return res.status(401).json({ message: 'Token inválido para refresh' });
    }

    if (!payload?.id) return res.status(400).json({ message: 'Payload inválido no token' });

    if (!payload.iat) {
      return res.status(401).json({ message: 'Token inválido para refresh' });
    }

    const tokenAgeSeconds = Math.floor(Date.now() / 1000) - payload.iat;
    if (tokenAgeSeconds > MAX_REFRESH_AGE_SECONDS) {
      return res.status(401).json({ message: 'Token expirado para refresh' });
    }

    // Obtener usuario actual desde DB (para reflejar cambios de rol/comunidad)
    const user = await User.findByPk(payload.id, {
      attributes: [
        'id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'foto_perfil', 'comunidad_id'
      ],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado para refresh' });

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
    return res.status(500).json({ message: 'Erro ao gerar novo token' });
  }
};

// POST /auth/refresh: refresh credential HttpOnly, independent from legacy Bearer refresh.
const refreshSession = async (req, res) => {
  const credential = readCookie(req, REFRESH_COOKIE_NAME);
  let rotated = null;
  try {
    rotated = await authSessionService.rotateSessionCredential({ credential });
    const user = await loadAuthoritativeUser(rotated.session.user_id);
    if (!user) {
      try {
        await authSessionService.revokeSession({
          credential: rotated.credential,
          reason: 'user_logout'
        });
      } catch (revokeError) {
        if (
          !(revokeError instanceof AuthSessionError) ||
          !TERMINATED_SESSION_CODES.has(revokeError.code)
        ) {
          throw revokeError;
        }
      }
      clearRefreshCookie(res, cookieContext(req));
      return res.status(401).json({
        message: 'Usuário não encontrado',
        error: { code: 'AUTH_USER_NOT_FOUND' }
      });
    }
    return await sendNewAuthResponse(res, user, rotated.credential, rotated.session, req);
  } catch (err) {
    if (!rotated && err instanceof AuthSessionError && err.code === 'AUTH_REFRESH_RACE') {
      return res.status(409).json({ message: 'Refresh concorrente', error: { code: err.code } });
    }
    if (!rotated && err instanceof AuthSessionError && REFRESH_401_CODES.has(err.code)) {
      clearRefreshCookie(res, cookieContext(req));
      return res.status(401).json({ message: 'Refresh inválido', error: { code: err.code } });
    }
    console.error('❌ authController.refreshSession error:', err.message);
    if (rotated) {
      // Rotation has already committed. Preserve browser/server synchronization
      // even when authoritative hydration, photo signing or JWT creation fails.
      setRefreshCookie(res, rotated.credential, rotated.session, cookieContext(req));
    }
    return res.status(503).json({
      message: 'Erro ao renovar sessão',
      error: { code: 'AUTH_REFRESH_UNAVAILABLE' }
    });
  }
};

// POST /auth/logout: deliberately idempotent and scoped to the presented session.
const logoutSession = async (req, res) => {
  // TODO(auth-next): desvincular PushSubscription en una subfase posterior,
  // antes de conectar el nuevo flujo al frontend. Auth y Push siguen aislados aquí.
  const credential = readCookie(req, REFRESH_COOKIE_NAME);
  try {
    if (credential) {
      await authSessionService.revokeSession({ credential, reason: 'user_logout' });
    }
  } catch (err) {
    if (!(err instanceof AuthSessionError)) {
      console.error('❌ authController.logoutSession error:', err.message);
    }
  } finally {
    clearRefreshCookie(res, cookieContext(req));
  }
  return res.status(204).send();
};

const validateLegacyMigrationToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    const error = new Error('Legacy token missing');
    error.code = 'AUTH_LEGACY_MISSING';
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
  } catch (_) {
    const error = new Error('Legacy token invalid');
    error.code = 'AUTH_LEGACY_INVALID';
    throw error;
  }
  if (!payload?.id || !payload.iat || payload.token_use === 'access') {
    const error = new Error('Legacy token invalid');
    error.code = 'AUTH_LEGACY_INVALID';
    throw error;
  }
  if (Math.floor(Date.now() / 1000) - payload.iat > MAX_REFRESH_AGE_SECONDS) {
    const error = new Error('Legacy token too old');
    error.code = 'AUTH_LEGACY_TOO_OLD';
    throw error;
  }
  return payload;
};

// POST /auth/session/migrate: temporary one-way bridge from a legacy JWT.
const migrateLegacySession = async (req, res) => {
  try {
    const payload = validateLegacyMigrationToken(req);
    const user = await loadAuthoritativeUser(payload.id);
    if (!user) {
      return res.status(401).json({
        message: 'Usuário não encontrado',
        error: { code: 'AUTH_LEGACY_USER_NOT_FOUND' }
      });
    }
    const userResponse = await buildAuthUserResponse(user);
    const accessToken = createAccessToken(buildAccessPayload(user));
    const created = await authSessionService.createSession({ userId: user.id });
    setRefreshCookie(res, created.credential, created.session, cookieContext(req));
    return res.status(200).json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: userResponse
    });
  } catch (err) {
    if (typeof err.code === 'string' && err.code.startsWith('AUTH_LEGACY_')) {
      return res.status(401).json({ message: 'Token legacy inválido', error: { code: err.code } });
    }
    console.error('❌ authController.migrateLegacySession error:', err.message);
    return res.status(500).json({
      message: 'Erro ao migrar sessão',
      error: { code: 'AUTH_MIGRATION_UNAVAILABLE' }
    });
  }
};

module.exports = {
  buildUserResponse: buildAuthUserResponse,
  login,
  googleCallback,
  getMe,
  refreshToken,
  refreshSession,
  logoutSession,
  migrateLegacySession,
  validateLegacyMigrationToken,
  readCookie
};
