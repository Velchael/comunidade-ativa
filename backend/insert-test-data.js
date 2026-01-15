const bcrypt = require('bcryptjs');
const { Comunidad, Usuario } = require('./src/models');

async function insertTestData() {
  try {
    console.log('🚀 Iniciando inserción de datos de prueba...');

    // 1️⃣ Insertar comunidad Toti
    const comunidad = await Comunidad.create({
      nombre_comunidad: 'Toti',
      direccion: 'Salvador de Bahia',
      telefono: '+55 71 91234-5678',
      nombre_administrador: 'Stalin Mendez',
      activa: true
    });

    console.log('✅ Comunidad creada:', {
      id: comunidad.id,
      nombre: comunidad.nombre_comunidad,
      direccion: comunidad.direccion
    });

    // 2️⃣ Encriptar contraseña
    const hashedPassword = await bcrypt.hash('123456', 10);

    // 3️⃣ Insertar usuario administrador
    const usuario = await Usuario.create({
      username: 'Stalin Mendez',
      email: 'stalin.mendez@comunidad.org',
      password: hashedPassword,
      rol: 'admin_total',
      comunidad_id: comunidad.id,
      confirmed: true,
      estado: 'activo'
    });

    console.log('✅ Usuario administrador creado:', {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      rol: usuario.rol,
      comunidad_id: usuario.comunidad_id
    });

    console.log('🎉 Datos de prueba insertados exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error al insertar datos:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error('  -', err.message));
    }
    process.exit(1);
  }
}

insertTestData();
