const { Comunidad, ComunidadMiembro } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const user = req.user;
    const comunidadId = Number(req.params.id);

    if (!user?.id) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidade inválida' });
    }

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'owner_user_id']
    });

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidade não encontrada' });
    }

    req.comunidad = comunidad;

    if (user.rol === 'admin_total' || user.rol_global === 'admin_total') {
      req.actorRoleScope = 'admin_total';
      return next();
    }

    if (Number(comunidad.owner_user_id) === Number(user.id)) {
      req.actorRoleScope = 'owner';
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
      return res.status(403).json({
        message: 'Você não tem permissão para administrar papéis nesta comunidade'
      });
    }

    req.actorRoleScope = 'admin_basic';
    return next();
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao verificar permissões para administrar papéis',
      error: error.message
    });
  }
};
