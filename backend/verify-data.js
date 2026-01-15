const { Comunidad, Usuario } = require('./src/models');

async function verifyData() {
  try {
    console.log('🔍 Verificando datos insertados...\n');

    // Verificar comunidades
    const comunidades = await Comunidad.findAll({
      attributes: ['id', 'nombre_comunidad', 'direccion', 'telefono', 'nombre_administrador']
    });

    console.log('📋 COMUNIDADES:');
    comunidades.forEach(com => {
      console.log(`  ID: ${com.id}`);
      console.log(`  Nombre: ${com.nombre_comunidad}`);
      console.log(`  Dirección: ${com.direccion}`);
      console.log(`  Teléfono: ${com.telefono}`);
      console.log(`  Administrador: ${com.nombre_administrador}`);
      console.log('  ---');
    });

    // Verificar usuarios
    const usuarios = await Usuario.findAll({
      attributes: ['id', 'username', 'email', 'rol', 'comunidad_id'],
      include: [{
        model: Comunidad,
        as: 'comunidad',
        attributes: ['nombre_comunidad']
      }]
    });

    console.log('\n👥 USUARIOS:');
    usuarios.forEach(user => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Nombre: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Rol: ${user.rol}`);
      console.log(`  Comunidad ID: ${user.comunidad_id}`);
      console.log(`  Comunidad: ${user.comunidad?.nombre_comunidad || 'N/A'}`);
      console.log('  ---');
    });

    console.log(`\n📊 RESUMEN:`);
    console.log(`  Total comunidades: ${comunidades.length}`);
    console.log(`  Total usuarios: ${usuarios.length}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error al verificar datos:', error.message);
    process.exit(1);
  }
}

verifyData();
