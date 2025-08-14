const { ReunionesGrupo, GrupoActivo, Usuario } = require('../models');

exports.listarReuniones = async (req, res) => {
  try {
    const { grupoId } = req.query;

    const where = grupoId ? { grupo_id: grupoId } : {};
    const reuniones = await ReunionesGrupo.findAll({
      where,
      include: [
        { model: GrupoActivo, as: 'grupo', attributes: ['id', 'direccion_grupo'] },
        { model: Usuario, as: 'creador', attributes: ['id', 'username'] }
      ],
      order: [['fecha', 'DESC']]
    });

    res.json(reuniones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reuniones', error: error.message });
  }
};

exports.crearReunion = async (req, res) => {
  try {
    const {
      grupo_id,
      fecha,
      tema_compartido,
      asistentes_regulares,
      nuevos_asistentes,
      observaciones
    } = req.body;

    const reunion = await ReunionesGrupo.create({
      grupo_id,
      fecha,
      tema_compartido,
      asistentes_regulares,
      nuevos_asistentes,
      observaciones,
      creado_por: req.user.id
    });

    res.status(201).json(reunion);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear reunión', error: error.message });
  }
};

exports.obtenerReunion = async (req, res) => {
  try {
    const { id } = req.params;
    const reunion = await ReunionesGrupo.findByPk(id, {
      include: [
        { model: GrupoActivo, as: 'grupo' },
        { model: Usuario, as: 'creador' }
      ]
    });

    if (!reunion) return res.status(404).json({ message: 'Reunión no encontrada' });
    res.json(reunion);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reunión', error: error.message });
  }
};

exports.actualizarReunion = async (req, res) => {
  try {
    const { id } = req.params;
    const reunion = await ReunionesGrupo.findByPk(id);
    if (!reunion) return res.status(404).json({ message: 'Reunión no encontrada' });

    await reunion.update(req.body);
    res.json(reunion);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar reunión', error: error.message });
  }
};

exports.eliminarReunion = async (req, res) => {
  try {
    const { id } = req.params;
    const reunion = await ReunionesGrupo.findByPk(id);
    if (!reunion) return res.status(404).json({ message: 'Reunión no encontrada' });

    await reunion.destroy();
    res.json({ message: 'Reunión eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar reunión', error: error.message });
  }
};
