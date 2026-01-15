const app = require('./app');
const sequelize = require('./src/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  let retries = 5;
  while (retries) {
    try {
      await sequelize.authenticate();
      console.log('✅ Conectado a la base de datos');
      break;
    } catch (err) {
      console.error('⏳ Esperando base de datos... Retries left:', retries - 1);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000)); // Espera 5s
    }
  }

  if (!retries) {
    console.error('❌ Error al conectar con la base de datos después de varios intentos');
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor escuchando e npuerto ${PORT}`);
  });
};

startServer();

