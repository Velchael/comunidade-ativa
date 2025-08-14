// src/routes/reuniones.js

const express = require('express');
const router = express.Router();
const reunionesController = require('../controllers/reunionesController');

// GET: listar reuniones (puede filtrar por grupo_id)
router.get('/', reunionesController.listarReuniones);

// GET: obtener reunión por ID
router.get('/:id', reunionesController.obtenerReunion);

// POST: crear reunión
router.post('/', reunionesController.crearReunion);

// PUT: actualizar reunión
router.put('/:id', reunionesController.actualizarReunion);

// DELETE: eliminar reunión
router.delete('/:id', reunionesController.eliminarReunion);

module.exports = router;
