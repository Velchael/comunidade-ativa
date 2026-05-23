// src/middleware/ownershipComunidad.js
const { Comunidad } = require('../models');

module.exports = async (req, res, next) => {
  const user = req.user;

  if (user?.rol === 'admin_total') return next();

  try {
    const comunidad = await Comunidad.findByPk(req.params.id);
    if (!comunidad) return res.status(404).json({ message: 'Comunidad no encontrada' });

    if (comunidad.owner_user_id !== user?.id) {
      return res.status(403).json({ message: 'Solo el owner o admin_total puede realizar esta acción' });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: 'Error verificando ownership', error: err.message });
  }
};
