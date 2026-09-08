const { ROLES, rehidratarUsuarioComunidad, tieneRolComunidad } = require('../utils/comunidadRoles');

const defaultGetComunidadId = (req) => req.user?.comunidad_id || req.params?.comunidad_id || req.body?.comunidad_id;
const normalizeComunidadId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const verificarRolComunidad = ({
  rolesPermitidos = [],
  getComunidadId = defaultGetComunidadId,
  permitirAdminTotalGlobal = true,
  permitirLegacyGlobal = true,
  rehidratarUsuario = false,
  forbiddenStatus = 403,
  forbiddenMessage = 'Você não tem permissão para esta comunidade'
} = {}) => {
  return async (req, res, next) => {
    try {
      let user = req.user;

      if (!user?.id) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      if (rehidratarUsuario) {
        user = await rehidratarUsuarioComunidad(user.id);

        if (!user) {
          return res.status(401).json({ message: 'Não autenticado' });
        }

        req.authUser = user;
      }

      const hasAdminTotalGlobal = rehidratarUsuario
        ? user.rol_global === ROLES.ADMIN_TOTAL
        : user.rol === ROLES.ADMIN_TOTAL;

      if (permitirAdminTotalGlobal && hasAdminTotalGlobal) {
        const comunidadId = normalizeComunidadId(await getComunidadId(req));

        if (comunidadId) {
          req.comunidadAuth = {
            comunidad_id: comunidadId,
            rol_comunidad: ROLES.ADMIN_TOTAL,
            source: 'admin_total_context',
            membresia: null
          };
        }

        return next();
      }

      const comunidadId = await getComunidadId(req);
      if (!comunidadId) {
        return res.status(400).json({ message: 'comunidad_id é obrigatório para verificar permissões' });
      }

      const resultado = await tieneRolComunidad(user, comunidadId, rolesPermitidos, {
        permitirLegacyGlobal
      });
      if (!resultado.permitido) {
        return res.status(forbiddenStatus).json({ message: forbiddenMessage });
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
      return res.status(500).json({ message: 'Erro ao verificar permissões da comunidade' });
    }
  };
};

module.exports = verificarRolComunidad;
