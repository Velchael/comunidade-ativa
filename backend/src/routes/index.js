const express = require('express');
const router = express.Router();
const interaccionesRoutes = require('./interacciones');
const respuestasRoutes = require('./respuestas');
const authRoutes = require('./authRoutes');
const userRoutes = require('./users');
const taskRoutes = require('./tasks');

// Las rutas quedan accesibles en:
// /api/auth, /api/users, /api/tasks
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);
router.use('/interacciones', interaccionesRoutes);
router.use('/respuestas', respuestasRoutes);
module.exports = router;
