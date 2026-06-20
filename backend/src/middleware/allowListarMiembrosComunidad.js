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

    if (user.rol === 'admin_total') {
      return next();
    }

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'owner_user_id']
    });

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidade não encontrada' });
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
      return res.status(403).json({ message: 'Você não tem permissão para listar membros desta comunidade' });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao verificar permissões para listar membros',
      error: error.message
    });
  }
};
