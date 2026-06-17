const { Comunidad } = require('../models');
const { ROLES, resolveRolComunidadHibrido } = require('./comunidadRoles');

const ensureUserWithComunidad = async (user) => {
  if (!user?.id) {
    return user;
  }

  if (user.comunidad !== undefined) {
    return user;
  }

  return user.constructor.findByPk(user.id, {
    attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'comunidad_id'],
    include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
  });
};

const buildLocalCommunityContext = async (user) => {
  const hydratedUser = await ensureUserWithComunidad(user);
  const comunidadId = hydratedUser?.comunidad_id || null;

  if (!comunidadId) {
    return {
      user: hydratedUser,
      rol_comunidad: null,
      is_owner: false,
      can_manage_comunidad: false
    };
  }

  const resolved = await resolveRolComunidadHibrido(hydratedUser, comunidadId);
  const isOwner = Number(hydratedUser?.comunidad?.owner_user_id) === Number(hydratedUser?.id);
  const canManageComunidad =
    isOwner ||
    resolved.rol === ROLES.ADMIN_BASIC ||
    resolved.rol === ROLES.ADMIN_TOTAL;

  return {
    user: hydratedUser,
    rol_comunidad: resolved.rol || null,
    is_owner: isOwner,
    can_manage_comunidad: canManageComunidad
  };
};

const buildAuthUserResponse = async (user) => {
  const localContext = await buildLocalCommunityContext(user);
  const hydratedUser = localContext.user || user;

  return {
    id: hydratedUser.id,
    username: hydratedUser.username,
    email: hydratedUser.email,
    rol: hydratedUser.rol,
    rol_global: hydratedUser.rol_global || hydratedUser.rol,
    comunidad_id: hydratedUser.comunidad_id,
    comunidadNombre: hydratedUser.comunidad ? hydratedUser.comunidad.nombre_comunidad : null,
    apellido: hydratedUser.apellido || null,
    rol_comunidad: localContext.rol_comunidad,
    is_owner: localContext.is_owner,
    can_manage_comunidad: localContext.can_manage_comunidad
  };
};

module.exports = {
  buildLocalCommunityContext,
  buildAuthUserResponse
};
