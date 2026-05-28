const { ensureComunidadMiembroFromLegacy } = require('../utils/comunidadRoles');

const syncComunidadMiembro = async (req, res, next) => {
  try {
    if (req.user?.id && req.user?.comunidad_id) {
      req.comunidadMiembroSync = await ensureComunidadMiembroFromLegacy(req.user);
    }

    return next();
  } catch (error) {
    console.error('syncComunidadMiembro error:', error.message);
    return res.status(500).json({ message: 'Error sincronizando membresia de comunidad' });
  }
};

module.exports = {
  syncComunidadMiembro,
  ensureComunidadMiembroFromLegacy
};
