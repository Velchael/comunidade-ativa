const s3Service = require('../services/s3Service');

const createProfilePhotoResolver = ({
  isManagedKey = s3Service.isManagedProfilePhoto,
  signReadUrl = s3Service.getSignedReadUrl
} = {}) => async (fotoPerfil) => {
  if (typeof fotoPerfil !== 'string' || !fotoPerfil.trim()) return null;

  const reference = fotoPerfil.trim();
  if (/^https:\/\//i.test(reference)) return fotoPerfil;
  if (!isManagedKey(reference)) return null;

  return signReadUrl(reference);
};

const resolveProfilePhoto = createProfilePhotoResolver();

module.exports = {
  createProfilePhotoResolver,
  resolveProfilePhoto
};
