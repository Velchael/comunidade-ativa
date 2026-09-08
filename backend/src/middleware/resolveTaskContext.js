const { Comunidad, ComunidadMiembro, Task } = require('../models');
const { ESTADOS, rehidratarUsuarioComunidad } = require('../utils/comunidadRoles');

const CONTEXT_NOT_DEFINED = 'Contexto de comunidade não definido para Agenda';
const TASK_NOT_FOUND = 'Tarefa não encontrada';

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const jsonError = (res, status, message) => res.status(status).json({ message });

const resolveFromMemberships = async (userId) => {
  const memberships = await ComunidadMiembro.findAll({
    where: {
      user_id: userId,
      estado: ESTADOS.ACTIVO
    },
    attributes: ['id', 'user_id', 'comunidad_id', 'rol_comunidad', 'estado', 'es_principal'],
    include: [{
      model: Comunidad,
      as: 'comunidad',
      attributes: ['id', 'activa'],
      where: { activa: true },
      required: true
    }],
    order: [['id', 'ASC']]
  });

  const principales = memberships.filter((membership) => membership.es_principal === true);

  if (principales.length === 1) {
    return { comunidadId: normalizeId(principales[0].comunidad_id), ambiguous: false };
  }

  if (principales.length > 1) {
    return { comunidadId: null, ambiguous: true };
  }

  if (memberships.length === 1) {
    return { comunidadId: normalizeId(memberships[0].comunidad_id), ambiguous: false };
  }

  if (memberships.length > 1) {
    return { comunidadId: null, ambiguous: true };
  }

  return { comunidadId: null, ambiguous: false };
};

const resolveFromOwnedCommunities = async (userId) => {
  const ownedCommunities = await Comunidad.findAll({
    where: {
      owner_user_id: userId,
      activa: true
    },
    attributes: ['id', 'owner_user_id', 'activa'],
    order: [['id', 'ASC']]
  });

  if (ownedCommunities.length === 1) {
    return { comunidadId: normalizeId(ownedCommunities[0].id), ambiguous: false };
  }

  return { comunidadId: null, ambiguous: ownedCommunities.length > 1 };
};

const resolveTaskContext = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return jsonError(res, 401, 'Não autenticado');
    }

    if (req.params?.id) {
      const task = await Task.findByPk(req.params.id, {
        attributes: ['id', 'comunidad_id']
      });

      if (!task) {
        return jsonError(res, 404, TASK_NOT_FOUND);
      }

      req.taskContext = task;
      req.comunidadContext = {
        comunidad_id: normalizeId(task.comunidad_id),
        source: 'task'
      };
      return next();
    }

    const actor = await rehidratarUsuarioComunidad(req.user.id);

    if (!actor) {
      return jsonError(res, 401, 'Não autenticado');
    }

    req.authUser = actor;

    const membershipResolution = await resolveFromMemberships(actor.id);
    if (membershipResolution.ambiguous) {
      return jsonError(res, 403, CONTEXT_NOT_DEFINED);
    }

    if (membershipResolution.comunidadId) {
      req.comunidadContext = {
        comunidad_id: membershipResolution.comunidadId,
        source: 'membership'
      };
      return next();
    }

    const ownedResolution = await resolveFromOwnedCommunities(actor.id);
    if (ownedResolution.ambiguous) {
      return jsonError(res, 403, CONTEXT_NOT_DEFINED);
    }

    if (ownedResolution.comunidadId) {
      req.comunidadContext = {
        comunidad_id: ownedResolution.comunidadId,
        source: 'owner'
      };
      return next();
    }

    const legacyComunidadId = normalizeId(actor.comunidad_id);
    if (legacyComunidadId) {
      req.comunidadContext = {
        comunidad_id: legacyComunidadId,
        source: 'legacy'
      };
      return next();
    }

    return jsonError(res, 403, CONTEXT_NOT_DEFINED);
  } catch (error) {
    console.error('resolveTaskContext error:', error.message);
    return jsonError(res, 500, 'Erro ao resolver contexto da Agenda');
  }
};

module.exports = resolveTaskContext;
