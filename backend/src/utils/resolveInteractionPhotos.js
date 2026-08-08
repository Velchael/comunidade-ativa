const { resolveProfilePhoto } = require('./resolveProfilePhoto');

const resolveUserPhoto = async (user, photoResolver) => {
  if (!user) return user;

  return {
    ...user,
    foto_perfil: await photoResolver(user.foto_perfil)
  };
};

const resolveInteractionPhotos = async (
  interaction,
  photoResolver = resolveProfilePhoto
) => ({
  ...interaction,
  usuario: await resolveUserPhoto(interaction.usuario, photoResolver),
  respuestas: Array.isArray(interaction.respuestas)
    ? await Promise.all(interaction.respuestas.map(async (response) => ({
        ...response,
        usuario: await resolveUserPhoto(response.usuario, photoResolver)
      })))
    : []
});

module.exports = { resolveInteractionPhotos };
