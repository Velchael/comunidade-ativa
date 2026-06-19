const { Op } = require('sequelize');
const { Comunidad, ComunidadMiembro } = require('../models');

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

const getMembershipTx = async ({ userId, comunidadId, transaction, lock }) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedComunidadId = normalizeId(comunidadId);

  if (!normalizedUserId || !normalizedComunidadId) {
    return null;
  }

  return ComunidadMiembro.findOne({
    where: {
      user_id: normalizedUserId,
      comunidad_id: normalizedComunidadId
    },
    transaction,
    lock
  });
};

const createMembershipTx = async ({
  userId,
  comunidadId,
  rolComunidad = ROLES.MIEMBRO,
  transaction
}) => {
  return ComunidadMiembro.create({
    user_id: userId,
    comunidad_id: comunidadId,
    rol_comunidad: rolComunidad,
    estado: ESTADOS.ACTIVO,
    es_principal: true
  }, { transaction });
};

const deactivateOtherPrimaryMembershipsTx = async ({
  userId,
  keepComunidadId,
  transaction
}) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedKeepComunidadId = normalizeId(keepComunidadId);

  if (!normalizedUserId) {
    return;
  }

  const where = {
    user_id: normalizedUserId,
    es_principal: true
  };

  if (normalizedKeepComunidadId) {
    where.comunidad_id = {
      [Op.ne]: normalizedKeepComunidadId
    };
  }

  await ComunidadMiembro.update(
    { es_principal: false },
    { where, transaction }
  );
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

const syncUserAndPrimaryMembershipTx = async ({
  user,
  nextRol,
  nextComunidadId,
  transaction,
  forceRoleSync = false,
  preserveExistingLocalRole = true,
  syncRoleFromUser = false,
  upsertMembership = true,
  deactivatePreviousPrimary = true
}) => {
  if (!user?.id) {
    throw new Error('syncUserAndPrimaryMembershipTx requiere un usuario valido');
  }

  if (!transaction) {
    throw new Error('syncUserAndPrimaryMembershipTx requiere transaction');
  }

  const previousComunidadId = normalizeId(user.comunidad_id);
  const finalComunidadId = normalizeId(
    nextComunidadId !== undefined ? nextComunidadId : user.comunidad_id
  );
  const finalRol = nextRol !== undefined ? nextRol : user.rol;

  const userUpdates = {};
  if (nextRol !== undefined && user.rol !== finalRol) {
    userUpdates.rol = finalRol;
  }
  if (nextComunidadId !== undefined && user.comunidad_id !== finalComunidadId) {
    userUpdates.comunidad_id = finalComunidadId;
  }

  if (Object.keys(userUpdates).length > 0) {
    await user.update(userUpdates, { transaction });
  }

  let previousMembership = null;
  let targetMembership = null;
  let membershipCreated = false;
  let roleSyncApplied = false;

  if (previousComunidadId) {
    previousMembership = await getMembershipTx({
      userId: user.id,
      comunidadId: previousComunidadId,
      transaction
    });
  }

  if (!finalComunidadId) {
    if (previousMembership && previousMembership.es_principal) {
      await previousMembership.update({ es_principal: false }, { transaction });
    }

    await deactivateOtherPrimaryMembershipsTx({
      userId: user.id,
      keepComunidadId: null,
      transaction
    });

    return {
      user,
      previousComunidadId,
      finalComunidadId,
      finalRol,
      targetMembership: null,
      previousMembership,
      roleSyncApplied,
      membershipCreated
    };
  }

  targetMembership = await getMembershipTx({
    userId: user.id,
    comunidadId: finalComunidadId,
    transaction
  });

  if (!targetMembership && upsertMembership) {
    const initialRolComunidad = syncRoleFromUser ? finalRol : ROLES.MIEMBRO;

    targetMembership = await createMembershipTx({
      userId: user.id,
      comunidadId: finalComunidadId,
      rolComunidad: initialRolComunidad,
      transaction
    });

    membershipCreated = true;
    roleSyncApplied = syncRoleFromUser;
  }

  if (targetMembership) {
    const membershipUpdates = {};

    if (targetMembership.estado !== ESTADOS.ACTIVO) {
      membershipUpdates.estado = ESTADOS.ACTIVO;
    }

    if (targetMembership.es_principal !== true) {
      membershipUpdates.es_principal = true;
    }

    const shouldSyncRole =
      forceRoleSync ||
      (
        syncRoleFromUser &&
        (
          !targetMembership.rol_comunidad ||
          !preserveExistingLocalRole ||
          targetMembership.rol_comunidad === user.rol
        )
      );

    if (shouldSyncRole && targetMembership.rol_comunidad !== finalRol) {
      membershipUpdates.rol_comunidad = finalRol;
      roleSyncApplied = true;
    }

    if (Object.keys(membershipUpdates).length > 0) {
      await targetMembership.update(membershipUpdates, { transaction });
    }
  }

  if (
    deactivatePreviousPrimary &&
    previousComunidadId &&
    previousComunidadId !== finalComunidadId &&
    previousMembership
  ) {
    await previousMembership.update({ es_principal: false }, { transaction });
  }

  await deactivateOtherPrimaryMembershipsTx({
    userId: user.id,
    keepComunidadId: finalComunidadId,
    transaction
  });

  return {
    user,
    previousComunidadId,
    finalComunidadId,
    finalRol,
    targetMembership,
    previousMembership,
    roleSyncApplied,
    membershipCreated
  };
};

module.exports = {
  ROLES,
  ESTADOS,
  getMembresiaActiva,
  resolveRolComunidadHibrido,
  tieneRolComunidad,
  ensureComunidadMiembroFromLegacy,
  syncUserAndPrimaryMembershipTx
};
