const { QueryInterface, Sequelize } = require('sequelize');
const db = require('./src/models');

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estructura de la tabla grupos_activos...');
    
    // Consulta para obtener la estructura de la tabla
    const [results] = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'grupos_activos' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Estructura actual de la tabla:');
    results.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Verificar datos existentes
    const grupos = await db.GrupoActivo.findAll({
      attributes: ['id', 'colider_id', 'anfitrion_id', 'direccion_grupo'],
      limit: 5
    });

    console.log('\n📊 Datos existentes (últimos 5):');
    grupos.forEach(grupo => {
      console.log(`  - ID: ${grupo.id}, colider_id: ${grupo.colider_id}, anfitrion_id: ${grupo.anfitrion_id}`);
    });

    await db.sequelize.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTableStructure();
