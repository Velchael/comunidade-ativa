
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_DATABASE || 'comunidad',
  port: process.env.DB_PORT || 5432,
});

async function insertUserManualmente() {
  try {
    await client.connect();

    // INSERT manual
    const result = await client.query(`
      INSERT INTO users (
        username,
        apellido,
        email,
        password,
        rol,
        fecha_nacimiento,
        telefono,
        direccion,
        nivel_liderazgo,
        estado,
        foto_perfil,
        confirmation_token,
        confirmed
      ) VALUES (
        'Juan',
        'Pérez',
        'stalinmendez69@gmail.com',
        '123456', -- Este debe ser hasheado en producción
        'admin',
        '1990-01-01',
        '555123456',
        'Calle Falsa 123',
        'Coordinador',
        'activo',
        null,
        null,
        true
      )
      RETURNING *;
    `);

    console.log('✅ Usuario insertado:', result.rows[0]);
  } catch (err) {
    console.error('❌ Error al insertar usuario:', err);
  } finally {
    await client.end();
  }
}

insertUserManualmente();
