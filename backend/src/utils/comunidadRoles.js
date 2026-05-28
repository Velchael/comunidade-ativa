const { ComunidadMiembro } = require('../models');

const ROLES = {
  ADMIN_TOTAL: 'admin_total',
  ADMIN_BASIC: 'admin_basic',
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

module.exports = {
  ROLES,
  ESTADOS,
  getMembresiaActiva,
  resolveRolComunidadHibrido,
  tieneRolComunidad,
  ensureComunidadMiembroFromLegacy
};
