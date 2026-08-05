const { buildLocalCommunityContext } = require('./buildAuthUserResponse');

const buildUserProfileResponse = async (user) => {
  const localContext = await buildLocalCommunityContext(user);
  const hydratedUser = localContext.user || user;

  return {
    id: hydratedUser.id,
    username: hydratedUser.username || null,
    apellido: hydratedUser.apellido || null,
    email: hydratedUser.email,
    fecha_nacimiento: hydratedUser.fecha_nacimiento || null,
    telefono: hydratedUser.telefono || null,
    direccion: hydratedUser.direccion || null,
    foto_perfil: hydratedUser.foto_perfil || null,
    comunidad: hydratedUser.comunidad
      ? {
          id: hydratedUser.comunidad.id,
          nombre: hydratedUser.comunidad.nombre_comunidad
        }
      : null,
    rol_global: hydratedUser.rol_global || null,
    rol_comunidad: localContext.rol_comunidad || null
  };
};

module.exports = { buildUserProfileResponse };
