const { Client } = require('pg');
const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  DB_PORT
} = require('./config');

const client = new Client({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: DB_PORT,
});

const migrationQuery = `
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('semanal', 'mensual', 'anual')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;

async function migrate() {
  try {
    await client.connect();
    await client.query(migrationQuery);
    console.log("✅ Tablas 'tasks' creadas/migradas correctamente.");
  } catch (err) {
    console.error("❌ Error al migrar tablas:", err);
  } finally {
    await client.end();
  }
}

migrate();
