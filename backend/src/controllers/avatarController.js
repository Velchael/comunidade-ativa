const s3Service = require('../services/s3Service');
const { User, Comunidad, sequelize } = require('../models');
const { buildUserProfileResponse } = require('../utils/buildUserProfileResponse');
const { createAvatarController } = require('./createAvatarController');

const PROFILE_QUERY = {
  attributes: [
    'id',
    'username',
    'apellido',
    'email',
    'fecha_nacimiento',
    'telefono',
    'direccion',
    'foto_perfil',
    'rol',
    'rol_global',
    'comunidad_id'
  ],
  include: [{
    model: Comunidad,
    as: 'comunidad',
    attributes: ['id', 'nombre_comunidad', 'owner_user_id']
  }]
};

module.exports = createAvatarController({
  User,
  sequelize,
  s3Service,
  buildUserProfileResponse,
  profileQuery: PROFILE_QUERY
});
