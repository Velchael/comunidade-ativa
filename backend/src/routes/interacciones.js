const router = require("express").Router();
const controller = require("../controllers/interaccionesController");

router.post("/", controller.crear);
router.get("/:comunidad_id", controller.listar);

module.exports = router;