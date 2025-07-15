const app = require('./app');

const sequelize = require('./src/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

sequelize.sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Backend en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    process.exit(1); // Finaliza si la conexión falla
  });
