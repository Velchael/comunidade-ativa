const router = require("express").Router();
const controller = require("../controllers/respuestasController");

router.post("/", controller.crear);

module.exports = router;