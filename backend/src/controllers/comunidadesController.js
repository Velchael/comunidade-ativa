const { Comunidad, User, ComunidadMiembro, sequelize } = require('../models');
const createToken = require('../utils/createToken');
const { syncUserAndPrimaryMembershipTx } = require('../utils/comunidadRoles');
const { buildAuthUserResponse } = require('../utils/buildAuthUserResponse');

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

    await syncUserAndPrimaryMembershipTx({
      user,
      nextRol: 'admin_basic',
      nextComunidadId: comunidad.id,
      transaction,
      preserveExistingLocalRole: true,
      forceRoleSync: true,
      syncRoleFromUser: true,
      upsertMembership: true
    });

    await transaction.commit();

    const updatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    const userResponse = await buildAuthUserResponse(updatedUser);

    const token = createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      rol_global: updatedUser.rol_global || updatedUser.rol,
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

// Unirse a una comunidad existente desde onboarding social
exports.unirseComunidad = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user?.id;
    const comunidadId = Number(req.params.id);

    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (!Number.isInteger(comunidadId)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Comunidad inválida' });
    }

    const comunidad = await Comunidad.findByPk(comunidadId, { transaction });
    if (!comunidad || comunidad.activa === false) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Comunidad no encontrada' });
    }

    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.comunidad_id && user.comunidad_id !== comunidad.id) {
      await transaction.rollback();
      return res.status(409).json({ message: 'El usuario ya pertenece a otra comunidad.' });
    }

    const rol = user.rol === 'admin_total' ? user.rol : 'miembro';

    await syncUserAndPrimaryMembershipTx({
      user,
      nextRol: rol,
      nextComunidadId: comunidad.id,
      transaction,
      preserveExistingLocalRole: true,
      forceRoleSync: true,
      syncRoleFromUser: true,
      upsertMembership: true
    });

    await transaction.commit();

    const updatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'email', 'rol', 'rol_global', 'username', 'apellido', 'googleId', 'comunidad_id'],
      include: [{ model: Comunidad, as: 'comunidad', attributes: ['id', 'nombre_comunidad', 'owner_user_id'] }]
    });

    const userResponse = await buildAuthUserResponse(updatedUser);

    const token = createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      rol: updatedUser.rol,
      rol_global: updatedUser.rol_global || updatedUser.rol,
      username: updatedUser.username,
      googleId: updatedUser.googleId || null,
      comunidad_id: updatedUser.comunidad_id || null
    }, '120m');

    return res.json({
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

// ✅ Listar miembros de una comunidad
exports.listarMiembrosComunidad = async (req, res) => {
  try {
    const comunidadId = Number(req.params.id);

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidad inválida' });
    }

    const comunidad = await Comunidad.findByPk(comunidadId, {
      attributes: ['id', 'owner_user_id']
    });

    if (!comunidad) {
      return res.status(404).json({ message: 'Comunidad no encontrada' });
    }

    const membresias = await ComunidadMiembro.findAll({
      where: { comunidad_id: comunidadId },
      attributes: ['user_id', 'rol_comunidad', 'estado', 'es_principal'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'rol', 'rol_global'],
        required: true
      }],
      order: [
        ['es_principal', 'DESC'],
        ['rol_comunidad', 'ASC'],
        [{ model: User, as: 'user' }, 'username', 'ASC'],
        ['user_id', 'ASC']
      ]
    });

    const miembros = membresias.map((membresia) => {
      const isOwner = Number(comunidad.owner_user_id) === Number(membresia.user_id);
      const rolGlobal = membresia.user?.rol_global || membresia.user?.rol || 'miembro';
      const isAdminTotalGlobal = rolGlobal === 'admin_total';

      return {
        user_id: membresia.user_id,
        username: membresia.user?.username || null,
        email: membresia.user?.email || null,
        rol_comunidad: membresia.rol_comunidad,
        rol_global: rolGlobal,
        is_admin_total_global: isAdminTotalGlobal,
        estado: membresia.estado,
        es_principal: membresia.es_principal,
        is_owner: isOwner,
        can_edit_local_role: !isOwner && !isAdminTotalGlobal
      };
    });

    return res.json({
      comunidad_id: comunidadId,
      total: miembros.length,
      miembros
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error al listar miembros de la comunidad',
      error: error.message
    });
  }
};

exports.actualizarRolMiembroComunidad = async (req, res) => {
  try {
    const comunidadId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const { rol_comunidad } = req.body || {};
    const actor = req.user;
    const comunidad = req.comunidad;

    if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
      return res.status(400).json({ message: 'Comunidad inválida' });
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: 'Usuario inválido' });
    }

    if (!['admin_basic', 'moderador', 'miembro'].includes(rol_comunidad)) {
      return res.status(400).json({
        message: 'rol_comunidad inválido. Solo se permite admin_basic, moderador o miembro'
      });
    }

    if (Number(actor?.id) === Number(targetUserId)) {
      return res.status(403).json({
        message: 'No puedes cambiar tu propio rol local en esta fase'
      });
    }

    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'username', 'email', 'rol', 'rol_global']
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (Number(comunidad.owner_user_id) === Number(targetUserId)) {
      return res.status(403).json({
        message: 'No se puede modificar el rol local del owner de la comunidad'
      });
    }

    const targetMembership = await ComunidadMiembro.findOne({
      where: {
        user_id: targetUserId,
        comunidad_id: comunidadId
      },
      attributes: ['user_id', 'comunidad_id', 'rol_comunidad', 'estado', 'es_principal']
    });

    if (!targetMembership) {
      return res.status(404).json({
        message: 'Membresía no encontrada para esa comunidad'
      });
    }

    if (
      targetUser.rol === 'admin_total' ||
      targetUser.rol_global === 'admin_total'
    ) {
      return res.status(403).json({
        message: 'No puedes modificar el rol local de un admin_total'
      });
    }

    if (targetMembership.rol_comunidad !== rol_comunidad) {
      await targetMembership.update({ rol_comunidad });
    }

    return res.json({
      message: 'Rol comunitario actualizado',
      comunidad_id: comunidadId,
      miembro: {
        user_id: targetMembership.user_id,
        username: targetUser.username || null,
        email: targetUser.email || null,
        rol_comunidad,
        estado: targetMembership.estado,
        es_principal: targetMembership.es_principal,
        is_owner: false
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error al actualizar rol comunitario',
      error: error.message
    });
  }
};
