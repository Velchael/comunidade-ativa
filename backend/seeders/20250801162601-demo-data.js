'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insertar 2 comunidades
    const comunidades = await queryInterface.bulkInsert('comunidades', [
      {
        nombre_comunidad: 'Comunidad Esperanza',
        descripcion: 'Comunidad enfocada en ayuda social',
        direccion: 'Calle Fe #123',
        telefono: '123456789',
        nombre_administrador: 'Admin Esperanza',
        activa: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre_comunidad: 'Comunidad Luz',
        descripcion: 'Grupo de oración y servicio',
        direccion: 'Avenida Central #456',
        telefono: '987654321',
        nombre_administrador: 'Admin Luz',
        activa: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], { returning: ['id'] });

    // Insertar 2 usuarios (uno por comunidad)
    await queryInterface.bulkInsert('users', [
      {
        googleid: '999000111222333444',
        username: 'Carlos',
        apellido: 'Ramírez',
        email: 'carlos@gmail.com',
        password: 'oauth-google',
        rol: 'miembro',
        fecha_nacimiento: '1990-05-10',
        telefono: '3001112233',
        direccion: 'Ciudad A',
        nivel_liderazgo: 'Nivel1',
        grupo_familiar_id: 1,
        estado: 'activo',
        foto_perfil: '',
        confirmed: true,
        comunidad_id: 1, // Esperanza
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        googleid: '888777666555444333',
        username: 'Lucía',
        apellido: 'Fernández',
        email: 'lucia@gmail.com',
        password: 'oauth-google',
        rol: 'admin_total',
        fecha_nacimiento: '1985-08-22',
        telefono: '3009998877',
        direccion: 'Ciudad B',
        nivel_liderazgo: 'Nivel2',
        grupo_familiar_id: 2,
        estado: 'activo',
        foto_perfil: '',
        confirmed: true,
        comunidad_id: 2, // Luz
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('comunidades', null, {});
  }
};

