const { GrupoActivo, Usuario, Comunidad } = require('./src/models');

async function testGrupos() {
  try {
    console.log('🧪 Probando funcionalidad de grupos...');

    // Listar grupos existentes
    const grupos = await GrupoActivo.findAll({
      include: [
        { model: Usuario, as: 'lider' },
        { model: Usuario, as: 'colider' },
        { model: Usuario, as: 'anfitrion' },
        { model: Comunidad, as: 'comunidad' }
      ]
    });

    console.log('📋 Grupos encontrados:', grupos.length);
    grupos.forEach(grupo => {
      console.log(`  - ID: ${grupo.id}, Dirección: ${grupo.direccion_grupo}`);
    });

    // Intentar crear un grupo de prueba
    const nuevoGrupo = await GrupoActivo.create({
      comunidad_id: 1,
      lider_id: 1,
      direccion_grupo: 'Dirección de prueba'
    });

    console.log('✅ Grupo creado:', {
      id: nuevoGrupo.id,
      comunidad_id: nuevoGrupo.comunidad_id,
      lider_id: nuevoGrupo.lider_id,
      direccion_grupo: nuevoGrupo.direccion_grupo
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  }
}

testGrupos();
