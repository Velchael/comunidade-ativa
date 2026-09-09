process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '../migrations/20260909000001-generalize-notificaciones-for-agenda.js'
);

const readMigration = () => fs.readFileSync(migrationPath, 'utf8');

const getAddColumnBlock = (source, field) => {
  const start = source.indexOf(`addColumn(TABLE, '${field}'`);
  assert.notEqual(start, -1, `campo ${field} não encontrado`);

  const nextAddColumn = source.indexOf('addColumn(TABLE,', start + 1);
  const end = nextAddColumn === -1 ? source.length : nextAddColumn;
  return source.slice(start, end);
};

test('migration Agenda generaliza notificaciones sem executar SQL contra RDS', () => {
  const source = readMigration();

  for (const field of ['comunidad_id', 'task_id', 'titulo', 'corpo', 'url']) {
    assert.match(source, new RegExp(`addColumn\\(TABLE, '${field}'`));
  }

  assert.match(source, /changeColumn\(TABLE, 'interaccion_id'/);
  assert.match(source, /changeColumn\(TABLE, 'respuesta_id'/);
  assert.match(source, /allowNull: true/);
  assert.match(source, /respuesta_interaccion/);
  assert.match(source, /agenda_task_created/);
  assert.match(source, /agenda_task_updated/);
  assert.match(source, /agenda_task_cancelled/);
  assert.match(source, /agenda_task_deleted/);
  assert.match(source, /notificaciones_respuesta_interaccion_payload_check/);
  assert.match(source, /notificaciones_agenda_payload_check/);
});

test('migration define estrategia coherente para comunidad_id y task_id histórico', () => {
  const source = readMigration();
  const comunidadBlock = getAddColumnBlock(source, 'comunidad_id');
  const taskBlock = getAddColumnBlock(source, 'task_id');

  assert.match(comunidadBlock, /references:\s*{\s*model: 'comunidades'/);
  assert.match(comunidadBlock, /onDelete: 'CASCADE'/);
  assert.doesNotMatch(comunidadBlock, /onDelete: 'SET NULL'/);

  assert.match(taskBlock, /allowNull: true/);
  assert.doesNotMatch(taskBlock, /references:/);
  assert.doesNotMatch(taskBlock, /onDelete:/);
});

test('migration mantém CHECK legacy e CHECK Agenda sem contradizer delete de comunidade', () => {
  const source = readMigration();

  assert.match(source, /tipo <> 'respuesta_interaccion'/);
  assert.match(source, /OR \(interaccion_id IS NOT NULL AND respuesta_id IS NOT NULL\)/);
  assert.match(source, /tipo NOT IN \(\$\{buildAgendaTiposSql\(queryInterface\)\}\)/);
  assert.match(source, /comunidad_id IS NOT NULL/);
  assert.match(source, /titulo IS NOT NULL/);
  assert.match(source, /corpo IS NOT NULL/);
  assert.match(source, /url IS NOT NULL/);
  assert.doesNotMatch(source, /onDelete: 'SET NULL'[\s\S]*comunidad_id IS NOT NULL/);
});

test('DOWN declara pérdida explícita de filas Agenda antes de restaurar schema legacy', () => {
  const source = readMigration();
  const downStart = source.indexOf('down: async');
  assert.notEqual(downStart, -1);
  const down = source.slice(downStart);
  const deleteIndex = down.indexOf('DELETE FROM ${TABLE}');
  const removeAgendaCheckIndex = down.indexOf("removeConstraint(\n        TABLE,\n        'notificaciones_agenda_payload_check'");
  const changeInteraccionIndex = down.indexOf("changeColumn(TABLE, 'interaccion_id'");

  assert.ok(deleteIndex >= 0, 'DOWN deve remover notificações Agenda explicitamente');
  assert.ok(removeAgendaCheckIndex > deleteIndex);
  assert.ok(changeInteraccionIndex > removeAgendaCheckIndex);
  assert.match(down, /WHERE tipo IN \(\$\{buildAgendaTiposSql\(queryInterface\)\}\)/);
  assert.match(down, /where: Sequelize\.literal\("tipo IN \('respuesta_interaccion'\)"\)/);
});
