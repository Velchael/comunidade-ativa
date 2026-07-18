const { QueryTypes } = require('sequelize');
const {
  ComunidadInvitacion,
  ComunidadMiembro,
  Comunidad,
  User,
  sequelize,
} = require('../models');
const {
  generateInviteToken,
  hashInviteToken,
  normalizeInviteToken,
} = require('../utils/invitacionTokens');
const {
  resolveGestionInvitacionesComunidad,
} = require('../middleware/allowGestionarInvitacionesComunidad');

const DEFAULT_EXPIRES_DAYS = 7;
const MAX_EXPIRES_DAYS = 30;

// Política funcional de creación de la V1:
// toda invitación nueva representa un único enlace individual.
// La aceptación permanece genérica y sigue respetando el max_usos
// persistido para invitaciones existentes o futuras.
const CURRENT_INVITE_CREATION_MAX_USES = 1;

const MAX_TOKEN_CREATE_ATTEMPTS = 3;
const RFC3339_WITH_TIMEZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const PUBLIC_INVALID_RESPONSE = {
  valid: false,
  reason: 'invalid_or_unavailable',
};

const ACCEPT_INVALID_RESPONSE = {
  accepted: false,
  reason: 'invalid_or_unavailable',
};

const MEMBERSHIP_INACTIVE_RESPONSE = {
  accepted: false,
  reason: 'membership_inactive',
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  error.isHttpError = true;
  return error;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const getTimezoneOffsetMinutes = (value) => {
  if (value.endsWith('Z')) return 0;

  const match = value.match(/([+-])(\d{2}):(\d{2})$/);
  if (!match) return null;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  if (hours > 23 || minutes > 59) return null;

  return sign * ((hours * 60) + minutes);
};

const hasValidCalendarComponents = (value, parsedDate) => {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-]\d{2}:\d{2})$/
  );

  if (!match) return false;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, millisecondRaw] = match;
  const expected = {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
    second: Number(secondRaw),
    millisecond: Number((millisecondRaw || '0').padEnd(3, '0')),
  };

  if (
    expected.month < 1 ||
    expected.month > 12 ||
    expected.hour > 23 ||
    expected.minute > 59 ||
    expected.second > 59
  ) {
    return false;
  }

  const offsetMinutes = getTimezoneOffsetMinutes(value);
  if (offsetMinutes === null) return false;

  const localTimestamp = parsedDate.getTime() + (offsetMinutes * 60 * 1000);
  const localDate = new Date(localTimestamp);

  return (
    localDate.getUTCFullYear() === expected.year &&
    localDate.getUTCMonth() + 1 === expected.month &&
    localDate.getUTCDate() === expected.day &&
    localDate.getUTCHours() === expected.hour &&
    localDate.getUTCMinutes() === expected.minute &&
    localDate.getUTCSeconds() === expected.second &&
    localDate.getUTCMilliseconds() === expected.millisecond
  );
};

const getEstadoEfectivo = (invitacion, now = new Date()) => {
  if (!invitacion) return null;
  if (invitacion.estado === 'revocada') return 'revocada';

  if (
    invitacion.estado === 'agotada' ||
    Number(invitacion.usos_actuales) >= Number(invitacion.max_usos)
  ) {
    return 'agotada';
  }

  const expiresAt = new Date(invitacion.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    return 'expirada';
  }

  return 'activa';
};

const serializeInviteAdmin = (invitacion, now = new Date()) => {
  return {
    id: invitacion.id,
    comunidad_id: invitacion.comunidad_id,
    estado: invitacion.estado,
    estado_efectivo: getEstadoEfectivo(invitacion, now),
    expires_at: invitacion.expires_at,
    max_usos: invitacion.max_usos,
    usos_actuales: invitacion.usos_actuales,
    created_at: invitacion.created_at,
    updated_at: invitacion.updated_at,
    revoked_at: invitacion.revoked_at,
    revoked_by_user_id: invitacion.revoked_by_user_id,
    last_used_at: invitacion.last_used_at,
  };
};

const parseMaxUsos = (value) => {
  if (value === undefined || value === null) {
    return CURRENT_INVITE_CREATION_MAX_USES;
  }

  if (
    !Number.isInteger(value) ||
    value !== CURRENT_INVITE_CREATION_MAX_USES
  ) {
    return null;
  }

  return value;
};

const parseExpiresAt = (value, now = new Date()) => {
  if (value === undefined || value === null) {
    return addDays(now, DEFAULT_EXPIRES_DAYS);
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (!RFC3339_WITH_TIMEZONE_PATTERN.test(value)) {
    return null;
  }

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  if (!hasValidCalendarComponents(value, expiresAt)) {
    return null;
  }

  if (expiresAt <= now) {
    return null;
  }

  if (expiresAt > addDays(now, MAX_EXPIRES_DAYS)) {
    return 'too_far';
  }

  return expiresAt;
};

const getPublicFrontendBaseUrl = () => {
  const configuredUrl = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
  const candidate = configuredUrl || (
    process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000'
  );

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch (_) {
    return null;
  }
};

const buildInviteUrl = (token) => {
  const baseUrl = getPublicFrontendBaseUrl();
  if (!baseUrl) return null;

  return `${baseUrl}/convite/${encodeURIComponent(token)}`;
};

const isUniqueTokenHashError = (error) => {
  return (
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.constraint === 'comunidad_invitaciones_token_hash_key' ||
    error?.parent?.constraint === 'comunidad_invitaciones_token_hash_key'
  );
};

exports.crearInvitacion = async (req, res) => {
  try {
    const comunidad = req.comunidad;
    const actor = req.actor;

    if (!comunidad || !actor) {
      return res.status(500).json({ message: 'Erro ao criar convite' });
    }

    const now = new Date();
    const maxUsos = parseMaxUsos(req.body?.max_usos);
    if (!maxUsos) {
      return res.status(400).json({
        message: 'max_usos deve ser exatamente 1 nesta versão',
      });
    }

    const expiresAt = parseExpiresAt(req.body?.expires_at, now);
    if (!expiresAt) {
      return res.status(400).json({ message: 'expires_at deve ser uma string ISO futura válida' });
    }

    if (expiresAt === 'too_far') {
      return res.status(400).json({ message: 'expires_at não pode exceder 30 dias' });
    }

    for (let attempt = 1; attempt <= MAX_TOKEN_CREATE_ATTEMPTS; attempt += 1) {
      const token = generateInviteToken();
      const tokenHash = hashInviteToken(token);
      const inviteUrl = buildInviteUrl(token);

      if (!inviteUrl) {
        console.error('Invite creation blocked: public frontend URL is not configured or invalid');
        return res.status(500).json({ message: 'Erro de configuração ao criar convite' });
      }

      try {
        const invitacion = await ComunidadInvitacion.create({
          token_hash: tokenHash,
          comunidad_id: comunidad.id,
          created_by_user_id: actor.id,
          estado: 'activa',
          expires_at: expiresAt,
          max_usos: maxUsos,
          usos_actuales: 0,
        });

        return res.status(201).json({
          id: invitacion.id,
          token,
          url: inviteUrl,
          comunidad_id: invitacion.comunidad_id,
          estado: invitacion.estado,
          expires_at: invitacion.expires_at,
          max_usos: invitacion.max_usos,
          usos_actuales: invitacion.usos_actuales,
          created_at: invitacion.created_at,
        });
      } catch (error) {
        if (isUniqueTokenHashError(error)) {
          console.error('Invite token hash collision', { attempt });
          continue;
        }

        console.error('crearInvitacion unexpected error', {
          error_name: error?.name || 'UnknownError',
        });
        return res.status(500).json({ message: 'Erro ao criar convite' });
      }
    }

    console.error('Invite token hash collision retries exhausted');
    return res.status(500).json({ message: 'Erro ao criar convite' });
  } catch (error) {
    console.error('crearInvitacion unexpected error', {
      error_name: error?.name || 'UnknownError',
    });
    return res.status(500).json({ message: 'Erro ao criar convite' });
  }
};

exports.listarInvitacionesComunidad = async (req, res) => {
  try {
    const comunidad = req.comunidad;
    if (!comunidad) {
      return res.status(500).json({ message: 'Erro ao listar convites' });
    }

    const invitaciones = await ComunidadInvitacion.findAll({
      where: { comunidad_id: comunidad.id },
      attributes: [
        'id',
        'comunidad_id',
        'estado',
        'expires_at',
        'max_usos',
        'usos_actuales',
        'created_at',
        'updated_at',
        'revoked_at',
        'revoked_by_user_id',
        'last_used_at',
      ],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
    });

    const now = new Date();

    return res.json({
      comunidad_id: comunidad.id,
      total: invitaciones.length,
      invitaciones: invitaciones.map((invitacion) => serializeInviteAdmin(invitacion, now)),
    });
  } catch (error) {
    console.error('listarInvitacionesComunidad unexpected error', {
      error_name: error?.name || 'UnknownError',
    });
    return res.status(500).json({ message: 'Erro ao listar convites' });
  }
};

exports.revocarInvitacion = async (req, res) => {
  try {
    const inviteId = Number(req.params.id);
    if (!Number.isInteger(inviteId) || inviteId <= 0) {
      return res.status(400).json({ message: 'Convite inválido' });
    }

    let serializedInvitacion = null;

    await sequelize.transaction(async (transaction) => {
      const invitacion = await ComunidadInvitacion.findByPk(inviteId, {
        attributes: [
          'id',
          'comunidad_id',
          'estado',
          'expires_at',
          'max_usos',
          'usos_actuales',
          'created_at',
          'updated_at',
          'revoked_at',
          'revoked_by_user_id',
          'last_used_at',
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!invitacion) {
        throw createHttpError(404, 'Convite não encontrado');
      }

      const permission = await resolveGestionInvitacionesComunidad({
        actorId: req.user?.id,
        comunidadId: invitacion.comunidad_id,
        transaction,
      });

      if (!permission.permitido) {
        throw createHttpError(permission.status || 403, permission.message);
      }

      if (invitacion.estado !== 'revocada') {
        await invitacion.update({
          estado: 'revocada',
          revoked_at: new Date(),
          revoked_by_user_id: permission.actor.id,
        }, { transaction });
      }

      serializedInvitacion = serializeInviteAdmin(invitacion);
    });

    return res.json({
      message: 'Convite revogado',
      invitacion: serializedInvitacion,
    });
  } catch (error) {
    if (error?.isHttpError) {
      return res.status(error.status).json({ message: error.publicMessage });
    }

    console.error('revocarInvitacion unexpected error', {
      error_name: error?.name || 'UnknownError',
    });
    return res.status(500).json({ message: 'Erro ao revogar convite' });
  }
};

exports.aceptarInvitacion = async (req, res) => {
  try {
    const token = normalizeInviteToken(req.params.token);
    const tokenHash = token ? hashInviteToken(token) : null;
    const authenticatedUserId = Number(req.user?.id);

    if (!tokenHash) {
      return res.status(404).json(ACCEPT_INVALID_RESPONSE);
    }

    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).json({
        accepted: false,
        reason: 'authentication_required',
      });
    }

    const result = await sequelize.transaction(async (transaction) => {
      // Primer lock de aceptación y revocación: siempre la invitación.
      const invitacion = await ComunidadInvitacion.findOne({
        where: { token_hash: tokenHash },
        attributes: [
          'id',
          'comunidad_id',
          'estado',
          'expires_at',
          'max_usos',
          'usos_actuales',
          'revoked_at',
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!invitacion) {
        return {
          status: 404,
          body: ACCEPT_INVALID_RESPONSE,
        };
      }

      const comunidad = await Comunidad.findByPk(invitacion.comunidad_id, {
        attributes: ['id', 'activa'],
        transaction,
        lock: transaction.LOCK.SHARE,
      });

      if (!comunidad || comunidad.activa !== true) {
        return {
          status: 404,
          body: ACCEPT_INVALID_RESPONSE,
        };
      }

      // La identidad procede exclusivamente del JWT validado, pero se
      // confirma que el usuario todavía existe en PostgreSQL.
      // Este lock también serializa la decisión sobre comunidad principal.
      const user = await User.findByPk(authenticatedUserId, {
        attributes: ['id', 'comunidad_id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        return {
          status: 401,
          body: {
            accepted: false,
            reason: 'authentication_required',
          },
        };
      }

      const now = new Date();
      const expiresAt = new Date(invitacion.expires_at);
      const revokedOrExpired =
        invitacion.estado === 'revocada' ||
        invitacion.revoked_at !== null ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= now;

      if (revokedOrExpired) {
        return {
          status: 404,
          body: ACCEPT_INVALID_RESPONSE,
        };
      }

      const existingMembership = await ComunidadMiembro.findOne({
        where: {
          comunidad_id: invitacion.comunidad_id,
          user_id: user.id,
        },
        attributes: [
          'id',
          'comunidad_id',
          'user_id',
          'rol_comunidad',
          'estado',
          'es_principal',
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // Esta comprobación se realiza antes del rechazo final por cupo:
      // permite reintentar idempotentemente un enlace que este mismo
      // usuario agotó en una solicitud anterior.
      if (existingMembership?.estado === 'activo') {
        return {
          status: 200,
          body: {
            accepted: true,
            already_member: true,
            comunidad_id: invitacion.comunidad_id,
          },
        };
      }

      if (existingMembership?.estado === 'inactivo') {
        return {
          status: 409,
          body: MEMBERSHIP_INACTIVE_RESPONSE,
        };
      }

      // No se compara con el literal 1. Las invitaciones existentes con
      // max_usos mayor siguen siendo procesables.
      const hasCapacity =
        invitacion.estado === 'activa' &&
        Number(invitacion.usos_actuales) < Number(invitacion.max_usos);

      if (!hasCapacity) {
        return {
          status: 404,
          body: ACCEPT_INVALID_RESPONSE,
        };
      }

      // La fila de User está bloqueada antes de esta consulta. Dos
      // aceptaciones concurrentes del mismo usuario no pueden decidir
      // simultáneamente que ambas membresías deben ser principales.
      const existingPrimaryMembership = await ComunidadMiembro.findOne({
        where: {
          user_id: user.id,
          es_principal: true,
        },
        attributes: ['id', 'comunidad_id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const shouldBecomePrimary =
        user.comunidad_id === null &&
        existingPrimaryMembership === null;

      const insertedMemberships = await sequelize.query(
        `
          INSERT INTO comunidad_miembros (
            user_id,
            comunidad_id,
            rol_comunidad,
            estado,
            es_principal,
            created_at,
            updated_at
          )
          VALUES (
            :userId,
            :comunidadId,
            'miembro',
            'activo',
            :esPrincipal,
            NOW(),
            NOW()
          )
          ON CONFLICT (user_id, comunidad_id)
          DO NOTHING
          RETURNING
            id,
            comunidad_id,
            user_id,
            rol_comunidad,
            estado,
            es_principal
        `,
        {
          replacements: {
            userId: user.id,
            comunidadId: invitacion.comunidad_id,
            esPrincipal: shouldBecomePrimary,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      // Protege el escenario de dos invitaciones diferentes para la misma
      // combinación user_id + comunidad_id.
      if (insertedMemberships.length === 0) {
        const concurrentMembership = await ComunidadMiembro.findOne({
          where: {
            comunidad_id: invitacion.comunidad_id,
            user_id: user.id,
          },
          attributes: ['estado'],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (concurrentMembership?.estado === 'activo') {
          return {
            status: 200,
            body: {
              accepted: true,
              already_member: true,
              comunidad_id: invitacion.comunidad_id,
            },
          };
        }

        if (concurrentMembership?.estado === 'inactivo') {
          return {
            status: 409,
            body: MEMBERSHIP_INACTIVE_RESPONSE,
          };
        }

        throw new Error('Membership conflict could not be resolved');
      }

      if (shouldBecomePrimary) {
        await user.update({
          comunidad_id: invitacion.comunidad_id,
        }, { transaction });
      }

      const nextUsos = Number(invitacion.usos_actuales) + 1;

      await invitacion.update({
        usos_actuales: nextUsos,
        estado:
          nextUsos >= Number(invitacion.max_usos)
            ? 'agotada'
            : 'activa',
        last_used_at: now,
      }, { transaction });

      return {
        status: 201,
        body: {
          accepted: true,
          already_member: false,
          comunidad_id: invitacion.comunidad_id,
          membresia: {
            rol_comunidad: 'miembro',
            estado: 'activo',
          },
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('aceptarInvitacion unexpected error', {
      error_name: error?.name || 'UnknownError',
    });

    return res.status(500).json({
      accepted: false,
      reason: 'internal_error',
    });
  }
};

exports.validarInvitacion = async (req, res) => {
  try {
    const token = normalizeInviteToken(req.params.token);
    if (!token) {
      res.set('Cache-Control', 'no-store');
      return res.status(200).json(PUBLIC_INVALID_RESPONSE);
    }

    const tokenHash = hashInviteToken(token);
    if (!tokenHash) {
      res.set('Cache-Control', 'no-store');
      return res.status(200).json(PUBLIC_INVALID_RESPONSE);
    }

    const invitacion = await ComunidadInvitacion.findOne({
      where: { token_hash: tokenHash },
      attributes: [
        'estado',
        'expires_at',
        'max_usos',
        'usos_actuales',
      ],
      include: [{
        model: Comunidad,
        as: 'comunidad',
        attributes: ['nombre_comunidad', 'activa', 'ciudad', 'pais'],
        required: true,
      }],
    });

    if (!invitacion || !invitacion.comunidad || invitacion.comunidad.activa === false) {
      res.set('Cache-Control', 'no-store');
      return res.status(200).json(PUBLIC_INVALID_RESPONSE);
    }

    if (getEstadoEfectivo(invitacion) !== 'activa') {
      res.set('Cache-Control', 'no-store');
      return res.status(200).json(PUBLIC_INVALID_RESPONSE);
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      valid: true,
      comunidad: {
        nombre: invitacion.comunidad.nombre_comunidad,
        ciudad: invitacion.comunidad.ciudad || null,
        pais: invitacion.comunidad.pais || null,
      },
      expires_at: invitacion.expires_at,
    });
  } catch (error) {
    console.error('validarInvitacion unexpected error', {
      error_name: error?.name || 'UnknownError',
    });
    return res.status(500).json({ message: 'Erro ao validar convite' });
  }
};

module.exports.getEstadoEfectivo = getEstadoEfectivo;
module.exports.__testables = {
  addDays,
  buildInviteUrl,
  getEstadoEfectivo,
  getPublicFrontendBaseUrl,
  hasValidCalendarComponents,
  parseExpiresAt,
  parseMaxUsos,
};
