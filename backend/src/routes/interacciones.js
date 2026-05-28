const router = require("express").Router();
const controller = require("../controllers/interaccionesController");
const { verificarToken } = require("../middleware/authMiddleware");
const verificarRolComunidad = require("../middleware/verificarRolComunidad");

const allowCrearInteraccion = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "miembro"],
  getComunidadId: (req) => req.body?.comunidad_id,
  permitirAdminTotalGlobal: true
});

router.post("/", verificarToken, allowCrearInteraccion, controller.crear);
router.get("/:comunidad_id", controller.listar);

module.exports = router;
