process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');

const defineNotificacion = require('../src/models/Notificacion');

test('modelo Notificacion usa tabla notificaciones sem timestamps', () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = defineNotificacion(sequelize, DataTypes);

  assert.equal(Notificacion.tableName, 'notificaciones');
  assert.equal(Notificacion.options.timestamps, false);
});

test('modelo Notificacion valida o tipo permitido', async () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = defineNotificacion(sequelize, DataTypes);

  const valid = Notificacion.build({
    user_id: 1,
    actor_user_id: 2,
    tipo: 'respuesta_interaccion',
    interaccion_id: 3,
    respuesta_id: 4
  });

  await assert.doesNotReject(() => valid.validate());

  const invalid = Notificacion.build({
    user_id: 1,
    actor_user_id: 2,
    tipo: 'otro_tipo',
    interaccion_id: 3,
    respuesta_id: 4
  });

  await assert.rejects(() => invalid.validate(), /Validation/);
});

test('modelo Notificacion aceita tipos Agenda com payload genérico nullable para interação', async () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = defineNotificacion(sequelize, DataTypes);

  const valid = Notificacion.build({
    user_id: 1,
    actor_user_id: 2,
    tipo: 'agenda_task_deleted',
    interaccion_id: null,
    respuesta_id: null,
    comunidad_id: 7,
    task_id: 99,
    titulo: 'Atividade removida',
    corpo: 'Culto de oração foi removida da Agenda',
    url: '/TaskList'
  });

  await assert.doesNotReject(() => valid.validate());
});

test('modelo Notificacion aceita mensagem_privada com payload genérico', async () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = defineNotificacion(sequelize, DataTypes);

  const valid = Notificacion.build({
    user_id: 2,
    actor_user_id: 1,
    tipo: 'mensagem_privada',
    interaccion_id: null,
    respuesta_id: null,
    comunidad_id: 7,
    task_id: null,
    titulo: 'Nova mensagem privada',
    corpo: 'Ana enviou uma mensagem.',
    url: '/conversas/77'
  });

  await assert.doesNotReject(() => valid.validate());
});

test('modelo Notificacion alinha comunidade com FK cascade e task_id sem FK', () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = defineNotificacion(sequelize, DataTypes);
  const comunidad = Notificacion.rawAttributes.comunidad_id;
  const task = Notificacion.rawAttributes.task_id;

  assert.equal(comunidad.allowNull, true);
  assert.deepEqual(comunidad.references, { model: 'comunidades', key: 'id' });
  assert.equal(comunidad.onDelete, 'CASCADE');
  assert.equal(comunidad.onUpdate, 'CASCADE');
  assert.equal(task.allowNull, true);
  assert.equal(task.references, undefined);
});
