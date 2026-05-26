const { Comunidad, User, sequelize } = require('../models');
const createToken = require('../utils/createToken');

// ✅ Listar comunidades con alias para frontend
exports.listarComunidades = async (req, res) => {
  try {
    const comunidades = await Comunidad.findAll({
      where: { activa: true },
      attributes: [
        'id',
        ['nombre_comunidad', 'nombre'],           // alias = nombre
        ['nombre_administrador', 'administrador'], // alias = administrador
        'telefono',
        'direccion',
        'activa'
      ],
      order: [['id', 'ASC']]
    });

    res.json(comunidades);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar comunidades', error: error.message });
  }
};

// Crear comunidad
exports.crearComunidad = async (req, res) => {
  try {
    const { nombre, administrador, ...resto } = req.body;

    const comunidad = await Comunidad.create({
      nombre_comunidad: nombre,
      nombre_administrador: administrador,
      owner_user_id: req.user.id,
      ...resto
    });

    res.status(201).json(comunidad);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Crear comunidad desde onboarding de usuario autenticado sin comunidad
exports.crearComunidadOnboarding = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user?.id;
    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ message: 'No autenticado' });
    }

    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.comunidad_id) {
      await transaction.rollback();
      return res.status(409).json({ message: 'El usuario ya tiene comunidad asignada' });
    }

    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      administrador,
      objetivo,
      tipo,
      visibilidad,
      ciudad,
      pais
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      await transaction.rollback();
      return res.status(400).json({ message: 'El nombre de la comunidad es obligatorio' });
    }

    const comunidad = await Comunidad.create({
      nombre_comunidad: String(nombre).trim(),
      nombre_administrador: administrador || user.username || user.email,
      descripcion: descripcion || null,
      direccion: direccion || null,
      telefono: telefono || null,
      objetivo: objetivo || null,
      tipo: tipo || null,
      visibilidad: visibilidad || 'publica',
      ciudad: ciudad || null,
      pais: pais || null,
      owner_user_id: user.id,
      activa: true
    }, { transaction });

    await user.update({
      comunidad_id: comunidad.id,
      rol: 'admin_basic'
    }, { transaction });

    await transaction.commit();

    const updatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'email', 'rol', 'username', 'apellido', 'googleId', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad'] }]
    });

    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      username: updatedUser.username,
      apellido: updatedUser.apellido || null,
      comunidad_id: updatedUser.comunidad_id,
      comunidadNombre: updatedUser.comunidad ? updatedUser.comunidad.nombre_comunidad : null
    };

    const token = createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      username: updatedUser.username,
      googleId: updatedUser.googleId || null,
      comunidad_id: updatedUser.comunidad_id || null
    }, '120m');

    return res.status(201).json({
      token,
      user: userResponse,
      comunidad
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    return res.status(400).json({ message: error.message });
  }
};

// Actualizar comunidad
exports.actualizarComunidad = async (req, res) => {
  const { id } = req.params;

  try {
    const comunidad = await Comunidad.findByPk(id);
    if (!comunidad) return res.status(404).json({ message: 'No encontrada' });

    const { nombre, administrador, ...resto } = req.body;

    await comunidad.update({
      nombre_comunidad: nombre,
      nombre_administrador: administrador,
      ...resto
    });

    res.json(comunidad);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar comunidad', error: error.message });
  }
};

// Eliminar comunidad
exports.eliminarComunidad = async (req, res) => {
  const { id } = req.params;
  try {
    await Comunidad.destroy({ where: { id } });
    res.json({ message: 'Comunidad eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar comunidad', error: error.message });
  }
};

// ✅ Obtener una comunidad por ID (para frontend/contexto)
exports.obtenerComunidadPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const comunidad = await Comunidad.findByPk(id);

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidad no encontrada' });
    }

    res.json(comunidad);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener comunidad', error: error.message });
  }
};
