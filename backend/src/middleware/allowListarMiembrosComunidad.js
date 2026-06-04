const { Comunidad, ComunidadMiembro } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const user = req.user;
    const comunidadId = Number(req.params.id);

    if (!user?.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidad inválida' });
    }

    if (user.rol === 'admin_total') {
      return next();
    }

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'owner_user_id']
    });

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidad no encontrada' });
    }

    if (Number(comunidad.owner_user_id) === Number(user.id)) {
      return next();
    }

    const membresia = await ComunidadMiembro.findOne({
      where: {
        user_id: user.id,
        comunidad_id: comunidadId,
        estado: 'activo',
        rol_comunidad: 'admin_basic'
      },
      attributes: ['user_id', 'comunidad_id', 'rol_comunidad', 'estado']
    });

    if (!membresia) {
      return res.status(403).json({ message: 'No tienes permisos para listar miembros de esta comunidad' });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: 'Error verificando permisos para listar miembros',
      error: error.message
    });
  }
};
