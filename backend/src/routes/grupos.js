const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/authMiddleware');
const gruposController = require('../controllers/gruposController');
const permisoSoloAdmins = require('../middleware/permisoSoloAdmins'); // ✅ import correcto
const permisoEditarEliminar = require('../middleware/permisoEditarEliminar');
// 📍 Rutas para grupos

// Listar todos los grupos (con reglas internas en el controller)
router.get('/', verificarToken, gruposController.listarTodosGrupos);

// Listar solo los grupos del usuario logado (miembros, líderes, etc.)
router.get('/mios', verificarToken, gruposController.listarMisGrupos);

// Obtener un grupo específico con control de visibilidad
router.get('/:id', verificarToken, gruposController.obtenerGrupo);

// Crear un grupo (cualquier usuario logado puede crear según sus reglas)
router.post('/', verificarToken, gruposController.crearGrupo);

router.put('/:id', verificarToken, permisoEditarEliminar, gruposController.actualizarGrupo);
router.delete('/:id', verificarToken, permisoEditarEliminar, gruposController.eliminarGrupo);

module.exports = router;

