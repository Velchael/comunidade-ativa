const { Comunidad } = require('../models');

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
      ...resto
    });

    res.status(201).json(comunidad);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
