const { ROLES, tieneRolComunidad } = require('../utils/comunidadRoles');

const defaultGetComunidadId = (req) => req.user?.comunidad_id || req.params?.comunidad_id || req.body?.comunidad_id;

const verificarRolComunidad = ({
  rolesPermitidos = [],
  getComunidadId = defaultGetComunidadId,
  permitirAdminTotalGlobal = true
} = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      if (permitirAdminTotalGlobal && user.rol === ROLES.ADMIN_TOTAL) {
        return next();
      }

      const comunidadId = await getComunidadId(req);
      if (!comunidadId) {
        return res.status(400).json({ message: 'comunidad_id requerido para verificar permisos' });
      }

      const resultado = await tieneRolComunidad(user, comunidadId, rolesPermitidos);
      if (!resultado.permitido) {
        return res.status(403).json({ message: 'No tienes permisos para esta comunidad' });
      }

      req.comunidadAuth = {
        comunidad_id: Number(comunidadId),
        rol_comunidad: resultado.rol,
        source: resultado.source,
        membresia: resultado.membresia
      };

      return next();
    } catch (error) {
      console.error('verificarRolComunidad error:', error.message);
      return res.status(500).json({ message: 'Error verificando permisos de comunidad' });
    }
  };
};

module.exports = verificarRolComunidad;
