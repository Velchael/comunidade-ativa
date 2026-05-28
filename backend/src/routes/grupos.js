const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/authMiddleware');
const gruposController = require('../controllers/gruposController');
const verificarRolComunidad = require('../middleware/verificarRolComunidad');
const db = require('../models');

const getGrupoComunidadId = async (req) => {
  const grupo = await db.GrupoActivo.findByPk(req.params.id, {
    attributes: ['id', 'comunidad_id']
  });

  return grupo?.comunidad_id;
};

const allowGrupoAdmins = verificarRolComunidad({
  rolesPermitidos: ['admin_total', 'admin_basic'],
  getComunidadId: getGrupoComunidadId,
  permitirAdminTotalGlobal: true
});

// 📍 Rutas para grupos

// Listar todos los grupos (con reglas internas en el controller)
router.get('/', verificarToken, gruposController.listarTodosGrupos);

// Listar solo los grupos del usuario logado (miembros, líderes, etc.)
router.get('/mios', verificarToken, gruposController.listarMisGrupos);

// Obtener un grupo específico con control de visibilidad
router.get('/:id', verificarToken, gruposController.obtenerGrupo);

// Crear un grupo (cualquier usuario logado puede crear según sus reglas)
router.post('/', verificarToken, gruposController.crearGrupo);

router.put('/:id', verificarToken, allowGrupoAdmins, gruposController.actualizarGrupo);
router.delete('/:id', verificarToken, allowGrupoAdmins, gruposController.eliminarGrupo);

module.exports = router;
