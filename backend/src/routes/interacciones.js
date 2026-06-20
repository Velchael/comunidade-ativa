const router = require("express").Router();
const controller = require("../controllers/interaccionesController");
const { verificarToken } = require("../middleware/authMiddleware");
const verificarRolComunidad = require("../middleware/verificarRolComunidad");
const db = require("../models");

const allowCrearInteraccion = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "moderador", "miembro"],
  getComunidadId: (req) => req.body?.comunidad_id,
  permitirAdminTotalGlobal: true
});

const allowListarInteraccion = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "moderador", "miembro"],
  getComunidadId: (req) => req.params?.comunidad_id,
  permitirAdminTotalGlobal: true
});

const cargarInteraccion = async (req, res, next) => {
  try {
    const interaccion = await db.Interaccion.findByPk(req.params?.id, {
      attributes: ["id", "comunidad_id", "estado"]
    });

    if (!interaccion) {
      return res.status(404).json({ message: "Interação não encontrada" });
    }

    req.interaccionTarget = interaccion;
    return next();
  } catch (error) {
    console.error("cargarInteraccion error:", error.message);
    return res.status(500).json({ message: "Erro ao carregar interação" });
  }
};

const allowModerarInteraccion = verificarRolComunidad({
  rolesPermitidos: ["admin_total", "admin_basic", "moderador"],
  getComunidadId: (req) => req.interaccionTarget?.comunidad_id,
  permitirAdminTotalGlobal: true
});

router.post("/", verificarToken, allowCrearInteraccion, controller.crear);
router.get("/:comunidad_id", verificarToken, allowListarInteraccion, controller.listar);
router.patch("/:id/estado", verificarToken, cargarInteraccion, allowModerarInteraccion, controller.actualizarEstado);

module.exports = router;
