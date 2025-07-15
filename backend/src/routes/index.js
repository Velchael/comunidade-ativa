const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./users');
const taskRoutes = require('./tasks');

// Las rutas quedan accesibles en:
// /api/auth, /api/users, /api/tasks
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);

module.exports = router;
