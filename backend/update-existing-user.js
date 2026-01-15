const bcrypt = require('bcryptjs');
const { Usuario } = require('./src/models');

async function updateExistingUser() {
  try {
    console.log('🔄 Actualizando usuario existente a admin_total...');

    // Buscar el usuario con el email correcto
    const usuario = await Usuario.findOne({
      where: { email: 'stalinmendez69@gmail.com' }
    });

    if (!usuario) {
      console.log('❌ Usuario con email stalinmendez69@gmail.com no encontrado');
      process.exit(1);
    }

    console.log('👤 Usuario encontrado:', {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      rol: usuario.rol
    });

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Actualizar el usuario
    await usuario.update({
      username: 'Stalin Mendez',
      password: hashedPassword,
      rol: 'admin_total',
      comunidad_id: 1, // Asociar a la comunidad Toti
      confirmed: true,
      estado: 'activo'
    });

    console.log('✅ Usuario actualizado:', {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      rol: usuario.rol,
      comunidad_id: usuario.comunidad_id
    });

    console.log('🎉 Usuario convertido a admin_total exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error('  -', err.message));
    }
    process.exit(1);
  }
}

updateExistingUser();
