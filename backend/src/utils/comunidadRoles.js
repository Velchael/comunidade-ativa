const { Op } = require('sequelize');
const { Comunidad, ComunidadMiembro, User } = require('../models');

const ROLES = {
  ADMIN_TOTAL: 'admin_total',
  ADMIN_BASIC: 'admin_basic',
  MODERADOR: 'moderador',
  MIEMBRO: 'miembro'
};

const ESTADOS = {
  ACTIVO: 'activo',
  INACTIVO: 'inactivo'
};

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
};

const normalizeRoles = (rolesPermitidos = []) => {
  if (typeof rolesPermitidos === 'string') return [rolesPermitidos];
  if (Array.isArray(rolesPermitidos)) return rolesPermitidos;
  return [];
};

const getMembresiaActiva = async (userId, comunidadId) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedComunidadId = normalizeId(comunidadId);

  if (!normalizedUserId || !normalizedComunidadId) {
    return null;
  }

  return ComunidadMiembro.findOne({
    where: {
      user_id: normalizedUserId,
      comunidad_id: normalizedComunidadId,
      estado: ESTADOS.ACTIVO
    }
  });
};

const getComunidadOwner = async (comunidadId) => {
  const normalizedComunidadId = normalizeId(comunidadId);

  if (!normalizedComunidadId) {
    return null;
  }

  return Comunidad.findByPk(normalizedComunidadId, {
    attributes: ['id', 'owner_user_id']
  });
};

const resolveRolComunidadHibrido = async (user, comunidadId) => {
  if (!user?.id) {
    return {
      rol: null,
      source: 'none',
      membresia: null
    };
  }

  const normalizedComunidadId = normalizeId(comunidadId);
  const membresia = await getMembresiaActiva(user.id, normalizedComunidadId);
  const comunidad = await getComunidadOwner(normalizedComunidadId);
  const isOwner = Number(comunidad?.owner_user_id) === Number(user.id);

  if (isOwner) {
    return {
      rol: membresia?.rol_comunidad === ROLES.ADMIN_TOTAL
        ? ROLES.ADMIN_TOTAL
        : ROLES.ADMIN_BASIC,
      source: 'owner',
      membresia
    };
  }

  if (membresia?.rol_comunidad) {
    return {
      rol: membresia.rol_comunidad,
      source: 'comunidad_miembros',
      membresia
    };
  }

  const userComunidadId = normalizeId(user.comunidad_id);
  if (user.rol && normalizedComunidadId && userComunidadId === normalizedComunidadId) {
    return {
      rol: user.rol,
      source: 'legacy',
      membresia: null
    };
  }

  if (user.rol === ROLES.ADMIN_TOTAL) {
    return {
      rol: user.rol,
      source: 'legacy_global',
      membresia: null
    };
  }

  return {
    rol: null,
    source: 'none',
    membresia: null
  };
};

const tieneRolComunidad = async (user, comunidadId, rolesPermitidos = []) => {
  const roles = normalizeRoles(rolesPermitidos);
  const resolved = await resolveRolComunidadHibrido(user, comunidadId);

  return {
    permitido: Boolean(resolved.rol && roles.includes(resolved.rol)),
    ...resolved
  };
};

const ensureComunidadMiembroFromLegacy = async (user) => {
  const userId = normalizeId(user?.id);
  const comunidadId = normalizeId(user?.comunidad_id);
  const rol = user?.rol || ROLES.MIEMBRO;

  if (!userId || !comunidadId) {
    return null;
  }

  const [membresia] = await ComunidadMiembro.findOrCreate({
    where: {
      user_id: userId,
      comunidad_id: comunidadId
    },
    defaults: {
      rol_comunidad: rol,
      estado: ESTADOS.ACTIVO,
      es_principal: true
    }
  });

  const updates = {};
  if (membresia.rol_comunidad !== rol) updates.rol_comunidad = rol;
  if (membresia.estado !== ESTADOS.ACTIVO) updates.estado = ESTADOS.ACTIVO;
  if (membresia.es_principal !== true) updates.es_principal = true;

  if (Object.keys(updates).length > 0) {
    await membresia.update(updates);
  }

  return membresia;
};

const lockUserCommunityEligibilityTx = async ({
  userId,
  targetComunidadId = null,
  transaction
}) => {
  if (!transaction) {
    throw new Error('lockUserCommunityEligibilityTx requer transaction');
  }

  const normalizedUserIdCandidate = normalizeId(userId);
  const normalizedTargetComunidadIdCandidate = normalizeId(targetComunidadId);
  const normalizedUserId = normalizedUserIdCandidate > 0
    ? normalizedUserIdCandidate
    : null;
  const normalizedTargetComunidadId = normalizedTargetComunidadIdCandidate > 0
    ? normalizedTargetComunidadIdCandidate
    : null;

  if (!normalizedUserId) {
    throw new Error('lockUserCommunityEligibilityTx requer userId válido');
  }

  if (
    targetComunidadId !== null &&
    targetComunidadId !== undefined &&
    !normalizedTargetComunidadId
  ) {
    throw new Error('lockUserCommunityEligibilityTx recebeu targetComunidadId inválido');
  }

  const user = await User.findByPk(normalizedUserId, {
    attributes: [
      'id',
      'email',
      'username',
      'googleId',
      'rol',
      'rol_global',
      'comunidad_id'
    ],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (!user) {
    return {
      user: null,
      targetCommunity: null,
      assignedComunidadId: null,
      activeMemberships: [],
      ownedCommunities: [],
      targetActiveMembership: null,
      ownsTarget: false,
      assignedToTarget: false,
      otherActiveMemberships: [],
      otherOwnedCommunities: [],
      hasOtherRelation: false,
      hasAnyRelation: false,
      eligible: false
    };
  }

  const communityWhere = normalizedTargetComunidadId
    ? {
        [Op.or]: [
          { id: normalizedTargetComunidadId },
          { owner_user_id: normalizedUserId, activa: true }
        ]
      }
    : { owner_user_id: normalizedUserId, activa: true };

  const lockedCommunities = await Comunidad.findAll({
    where: communityWhere,
    attributes: ['id', 'activa', 'owner_user_id'],
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  const targetCommunity = normalizedTargetComunidadId
    ? lockedCommunities.find(
      (comunidad) => normalizeId(comunidad.id) === normalizedTargetComunidadId
    ) || null
    : null;
  const ownedCommunities = lockedCommunities.filter(
    (comunidad) =>
      comunidad.activa === true &&
      normalizeId(comunidad.owner_user_id) === normalizedUserId
  );

  const activeMemberships = await ComunidadMiembro.findAll({
    where: {
      user_id: normalizedUserId,
      estado: ESTADOS.ACTIVO
    },
    attributes: [
      'id',
      'user_id',
      'comunidad_id',
      'rol_comunidad',
      'estado',
      'es_principal'
    ],
    order: [['user_id', 'ASC'], ['comunidad_id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  const assignedComunidadId = normalizeId(user.comunidad_id);
  const targetActiveMembership = normalizedTargetComunidadId
    ? activeMemberships.find(
      (membership) => normalizeId(membership.comunidad_id) === normalizedTargetComunidadId
    ) || null
    : null;
  const ownsTarget = Boolean(
    normalizedTargetComunidadId &&
    ownedCommunities.some(
      (comunidad) => normalizeId(comunidad.id) === normalizedTargetComunidadId
    )
  );
  const assignedToTarget = Boolean(
    normalizedTargetComunidadId &&
    assignedComunidadId === normalizedTargetComunidadId
  );
  const otherActiveMemberships = activeMemberships.filter(
    (membership) => normalizeId(membership.comunidad_id) !== normalizedTargetComunidadId
  );
  const otherOwnedCommunities = ownedCommunities.filter(
    (comunidad) => normalizeId(comunidad.id) !== normalizedTargetComunidadId
  );
  const hasOtherRelation = Boolean(
    (assignedComunidadId && assignedComunidadId !== normalizedTargetComunidadId) ||
    otherActiveMemberships.length > 0 ||
    otherOwnedCommunities.length > 0
  );
  const hasAnyRelation = Boolean(
    assignedComunidadId ||
    activeMemberships.length > 0 ||
    ownedCommunities.length > 0
  );

  return {
    user,
    targetCommunity,
    assignedComunidadId,
    activeMemberships,
    ownedCommunities,
    targetActiveMembership,
    ownsTarget,
    assignedToTarget,
    otherActiveMemberships,
    otherOwnedCommunities,
    hasOtherRelation,
    hasAnyRelation,
    eligible: !hasAnyRelation
  };
};

module.exports = {
  ROLES,
  ESTADOS,
  getMembresiaActiva,
  resolveRolComunidadHibrido,
  tieneRolComunidad,
  ensureComunidadMiembroFromLegacy,
  lockUserCommunityEligibilityTx
};
