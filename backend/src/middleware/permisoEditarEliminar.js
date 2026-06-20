// backend/middleware/permisoEditarEliminar.js
const db = require('../models');

module.exports = async (req, res, next) => {
  try {
    const grupoId = req.params.id;
    const grupo = await db.GrupoActivo.findByPk(grupoId);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (req.user.rol === 'admin_total') {
      return next();
    }

    if (req.user.rol === 'admin_basic') {
      if (grupo.comunidad_id === req.user.comunidad_id) return next();
      return res.status(403).json({ message: 'Você não pode modificar grupos de outra comunidade' });
    }

    // miembros u otros roles
    return res.status(403).json({ message: 'Você não tem permissão' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro na verificação de permissões' });
  }
};
