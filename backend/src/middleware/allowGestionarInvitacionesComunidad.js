const { Op } = require('sequelize');
const { User, Comunidad, ComunidadMiembro } = require('../models');

const normalizePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const resolveGestionInvitacionesComunidad = async ({ actorId, comunidadId, transaction } = {}) => {
  const normalizedActorId = normalizePositiveInteger(actorId);
  const normalizedComunidadId = normalizePositiveInteger(comunidadId);

  if (!normalizedActorId) {
    return { permitido: false, status: 401, message: 'Não autenticado' };
  }

  if (!normalizedComunidadId) {
    return { permitido: false, status: 400, message: 'Comunidade inválida' };
  }

  const actor = await User.findByPk(normalizedActorId, {
    attributes: ['id', 'rol_global'],
    transaction,
  });

  if (!actor) {
    return { permitido: false, status: 401, message: 'Usuário autenticado não encontrado' };
  }

  const comunidad = await Comunidad.findByPk(normalizedComunidadId, {
    attributes: ['id', 'nombre_comunidad', 'activa', 'owner_user_id', 'ciudad', 'pais'],
    transaction,
  });

  if (!comunidad) {
    return { permitido: false, status: 404, message: 'Comunidade não encontrada' };
  }

  if (comunidad.activa === false) {
    return {
      permitido: false,
      status: 409,
      message: 'Comunidade inativa',
      actor,
      comunidad,
    };
  }

  if (actor.rol_global === 'admin_total') {
    return {
      permitido: true,
      scope: 'admin_total',
      actor,
      comunidad,
    };
  }

  if (Number(comunidad.owner_user_id) === Number(actor.id)) {
    return {
      permitido: true,
      scope: 'owner',
      actor,
      comunidad,
    };
  }

  const membresia = await ComunidadMiembro.findOne({
    where: {
      user_id: actor.id,
      comunidad_id: comunidad.id,
      estado: 'activo',
      rol_comunidad: {
        [Op.in]: ['admin_total', 'admin_basic'],
      },
    },
    attributes: ['user_id', 'comunidad_id', 'rol_comunidad', 'estado'],
    transaction,
  });

  if (membresia) {
    const scope = membresia.rol_comunidad === 'admin_total'
      ? 'local_admin_total'
      : 'admin_basic';

    return {
      permitido: true,
      scope,
      actor,
      comunidad,
      membresia,
    };
  }

  return {
    permitido: false,
    status: 403,
    message: 'Você não tem permissão para administrar convites desta comunidade',
    actor,
    comunidad,
  };
};

const allowGestionarInvitacionesComunidad = async (req, res, next) => {
  try {
    const result = await resolveGestionInvitacionesComunidad({
      actorId: req.user?.id,
      comunidadId: req.params.id,
    });

    if (!result.permitido) {
      return res.status(result.status || 403).json({ message: result.message });
    }

    req.comunidad = result.comunidad;
    req.actor = result.actor;
    req.actorRoleScope = result.scope;

    return next();
  } catch (error) {
    console.error('allowGestionarInvitacionesComunidad unexpected error', {
      error_name: error?.name || 'UnknownError',
    });
    return res.status(500).json({ message: 'Erro ao verificar permissões para convites' });
  }
};

module.exports = allowGestionarInvitacionesComunidad;
module.exports.resolveGestionInvitacionesComunidad = resolveGestionInvitacionesComunidad;
