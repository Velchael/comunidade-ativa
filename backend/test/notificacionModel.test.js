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
