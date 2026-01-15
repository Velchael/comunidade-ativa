const { Usuario } = require('./src/models');

async function updateAdminEmail() {
  try {
    console.log('🔄 Actualizando email del usuario administrador...');

    // Buscar el usuario Stalin Mendez
    const usuario = await Usuario.findOne({
      where: { username: 'Stalin Mendez' }
    });

    if (!usuario) {
      console.log('❌ Usuario Stalin Mendez no encontrado');
      process.exit(1);
    }

    console.log('📧 Email actual:', usuario.email);

    // Actualizar el email
    await usuario.update({
      email: 'stalinmendez69@gmail.com'
    });

    console.log('✅ Email actualizado a:', usuario.email);
    console.log('🎉 Actualización completada exitosamente!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error al actualizar email:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error('  -', err.message));
    }
    process.exit(1);
  }
}

updateAdminEmail();
