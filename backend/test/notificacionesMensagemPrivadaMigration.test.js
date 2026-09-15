process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '../migrations/20260915000002-add-mensagem-privada-to-notificaciones.js'
);

const readMigration = () => fs.readFileSync(migrationPath, 'utf8');

test('migration mensagem_privada altera somente CHECK de tipo', () => {
  const source = readMigration();

  assert.match(source, /notificaciones_tipo_check/);
  assert.match(source, /mensagem_privada/);
  assert.match(source, /respuesta_interaccion/);
  assert.match(source, /agenda_task_created/);
  assert.match(source, /agenda_task_updated/);
  assert.match(source, /agenda_task_cancelled/);
  assert.match(source, /agenda_task_deleted/);
  assert.doesNotMatch(source, /addColumn/);
  assert.doesNotMatch(source, /removeColumn/);
  assert.doesNotMatch(source, /DELETE FROM/);
  assert.doesNotMatch(source, /UPDATE /);
});

test('DOWN bloqueia rollback se existirem notificações mensagem_privada sem apagar dados', () => {
  const source = readMigration();
  const downStart = source.indexOf('down: async');
  assert.notEqual(downStart, -1);
  const down = source.slice(downStart);

  assert.match(down, /SELECT count\(\*\)::int AS total/);
  assert.match(down, /Rollback bloqueado/);
  assert.match(down, /Remoção automática de dados não é segura/);
  assert.doesNotMatch(down, /DELETE FROM/);
  assert.doesNotMatch(down, /destroy/);
});
