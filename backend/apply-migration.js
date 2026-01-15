const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Aplicando migración pendiente...');

// Ejecutar migración de Sequelize
exec('npx sequelize-cli db:migrate', { cwd: __dirname }, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error ejecutando migración:', error);
    return;
  }
  
  if (stderr) {
    console.error('⚠️ Advertencias:', stderr);
  }
  
  console.log('✅ Resultado de la migración:');
  console.log(stdout);
});
