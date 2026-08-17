const s3Service = require('../services/s3Service');

const createInteractionMediaResolver = ({
  isManagedKey = s3Service.isManagedInteractionImage,
  signReadUrl = s3Service.getSignedInteractionImageUrl,
  logger = console
} = {}) => async (interaction) => {
  if (!interaction) return interaction;

  const resolved = {
    ...interaction,
    imagen_url: null
  };

  const key = typeof interaction.imagen_key === 'string'
    ? interaction.imagen_key.trim()
    : '';

  delete resolved.imagen_key;

  if (!key) return resolved;

  if (!isManagedKey({ key, interactionId: interaction.id })) {
    logger.warn?.('Interaction image key not managed by COMUVA', {
      interactionId: interaction.id
    });
    return resolved;
  }

  try {
    resolved.imagen_url = await signReadUrl({ key, interactionId: interaction.id });
  } catch (error) {
    logger.error?.('Failed to sign interaction image URL', {
      interactionId: interaction.id,
      code: error.code
    });
  }

  return resolved;
};

const resolveInteractionMedia = createInteractionMediaResolver();

module.exports = {
  createInteractionMediaResolver,
  resolveInteractionMedia
};
