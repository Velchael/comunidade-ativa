const { GrupoActivo } = require('./src/models');

async function testColiderAnfitrion() {
  try {
    console.log('🧪 Probando campos colider_id y anfitrion_id...');

    // Test 1: Crear grupo con colider_id y anfitrion_id
    const grupoTest = await GrupoActivo.create({
      comunidad_id: 1,
      lider_id: 1,
      colider_id: "usuario123",  // String value
      anfitrion_id: "anfitrion456",  // String value
      direccion_grupo: 'Test - Dirección con colider y anfitrion'
    });

    console.log('✅ Grupo creado con éxito:');
    console.log(`  - ID: ${grupoTest.id}`);
    console.log(`  - colider_id: ${grupoTest.colider_id}`);
    console.log(`  - anfitrion_id: ${grupoTest.anfitrion_id}`);
    console.log(`  - direccion_grupo: ${grupoTest.direccion_grupo}`);

    // Test 2: Verificar que se guardó correctamente
    const grupoVerificado = await GrupoActivo.findByPk(grupoTest.id);
    
    console.log('\n🔍 Verificación desde base de datos:');
    console.log(`  - colider_id guardado: ${grupoVerificado.colider_id}`);
    console.log(`  - anfitrion_id guardado: ${grupoVerificado.anfitrion_id}`);

    if (grupoVerificado.colider_id && grupoVerificado.anfitrion_id) {
      console.log('\n✅ ¡ÉXITO! Los campos se están guardando correctamente');
    } else {
      console.log('\n❌ PROBLEMA: Los campos siguen siendo NULL');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  }
}

testColiderAnfitrion();
