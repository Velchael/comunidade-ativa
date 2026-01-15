const { GrupoActivo } = require('./src/models');

async function testGruposSimple() {
  try {
    console.log('🧪 Test simple de grupos...');

    // Listar grupos sin asociaciones
    const grupos = await GrupoActivo.findAll();
    console.log('📋 Grupos encontrados:', grupos.length);

    // Crear grupo de prueba
    const nuevoGrupo = await GrupoActivo.create({
      comunidad_id: 1,
      lider_id: 1,
      direccion_grupo: 'Test - Dirección de prueba'
    });

    console.log('✅ Grupo creado exitosamente:', {
      id: nuevoGrupo.id,
      comunidad_id: nuevoGrupo.comunidad_id,
      lider_id: nuevoGrupo.lider_id,
      direccion_grupo: nuevoGrupo.direccion_grupo
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testGruposSimple();
