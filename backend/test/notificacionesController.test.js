process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, DataTypes } = require('sequelize');
const {
  createNotificacionesController
} = require('../src/controllers/notificacionesController');

const createResponse = () => {
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    }
  };

  return { response, res };
};

const createHarness = ({
  findAllError = null,
  countError = null,
  updateError = null,
  updateAffectedRows = 1,
  query = {}
} = {}) => {
  const calls = [];
  const logger = { error: (...args) => calls.push(['logger:error', ...args]) };
  const User = { name: 'User' };
  const rows = [
    {
      id: 20,
      tipo: 'respuesta_interaccion',
      interaccion_id: 7,
      respuesta_id: 70,
      leida: false,
      created_at: '2026-08-19T10:00:00.000Z',
      actor: {
        id: 42,
        username: 'Efraim',
        email: 'efraim@example.test',
        telefono: '+555199999999'
      },
      user_id: 88,
      token: 'secret'
    }
  ];

  const Notificacion = {
    findAll: async (options) => {
      calls.push(['notificacion:findAll', options]);
      if (findAllError) throw findAllError;
      return rows;
    },
    count: async (options) => {
      calls.push(['notificacion:count', options]);
      if (countError) throw countError;
      return 3;
    },
    update: async (values, options) => {
      calls.push(['notificacion:update', values, options]);
      if (updateError) throw updateError;
      return [updateAffectedRows];
    }
  };

  const controller = createNotificacionesController({
    Notificacion,
    User,
    logger
  });
  const req = {
    user: { id: 88 },
    query,
    params: { id: '20' }
  };

  return { calls, controller, req, User };
};

test('associação actor funciona no modelo Notificacion', () => {
  const sequelize = new Sequelize('postgresql://test:test@127.0.0.1:5432/test', {
    logging: false
  });
  const Notificacion = require('../src/models/Notificacion')(sequelize, DataTypes);
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    username: DataTypes.STRING
  }, {
    tableName: 'users',
    timestamps: false
  });

  Notificacion.associate({ User });

  assert.equal(Notificacion.associations.actor.as, 'actor');
  assert.equal(Notificacion.associations.actor.foreignKey, 'actor_user_id');
  assert.equal(Notificacion.associations.actor.target, User);
});

test('GET usa req.user.id e ignora query user_id', async () => {
  const harness = createHarness({ query: { user_id: '999' } });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(harness.calls.find(([name]) => name === 'notificacion:findAll')[1].where, {
    user_id: 88
  });
  assert.deepEqual(harness.calls.find(([name]) => name === 'notificacion:count')[1].where, {
    user_id: 88,
    leida: false
  });
});

test('GET usa default limit 10', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(harness.calls.find(([name]) => name === 'notificacion:findAll')[1].limit, 10);
});

test('GET limita máximo a 50', async () => {
  const harness = createHarness({ query: { limit: '500' } });
  const { res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(harness.calls.find(([name]) => name === 'notificacion:findAll')[1].limit, 50);
});

test('GET con limit inválido vuelve a 10', async () => {
  const harness = createHarness({ query: { limit: 'abc' } });
  const { res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(harness.calls.find(([name]) => name === 'notificacion:findAll')[1].limit, 10);
});

test('GET ordena por created_at DESC e id DESC', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.deepEqual(harness.calls.find(([name]) => name === 'notificacion:findAll')[1].order, [
    ['created_at', 'DESC'],
    ['id', 'DESC']
  ]);
});

test('GET devuelve items y unread_count', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(response.body.items), true);
  assert.equal(response.body.unread_count, 3);
});

test('GET incluye actor solo con id y username', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.deepEqual(
    harness.calls.find(([name]) => name === 'notificacion:findAll')[1].include,
    [{
      model: harness.User,
      as: 'actor',
      attributes: ['id', 'username']
    }]
  );
  assert.deepEqual(response.body.items[0].actor, {
    id: 42,
    username: 'Efraim'
  });
});

test('GET no expone email ni teléfono', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(Object.hasOwn(response.body.items[0], 'user_id'), false);
  assert.equal(Object.hasOwn(response.body.items[0], 'token'), false);
  assert.equal(Object.hasOwn(response.body.items[0].actor, 'email'), false);
  assert.equal(Object.hasOwn(response.body.items[0].actor, 'telefono'), false);
});

test('PATCH marca notificación propia como leída', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.marcarLeida(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(harness.calls.find(([name]) => name === 'notificacion:update'), [
    'notificacion:update',
    { leida: true },
    { where: { id: 20, user_id: 88 } }
  ]);
  assert.deepEqual(response.body, { id: 20, leida: true });
});

test('PATCH ajena responde 404', async () => {
  const harness = createHarness({ updateAffectedRows: 0 });
  const { response, res } = createResponse();

  await harness.controller.marcarLeida(harness.req, res);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: 'Notificação não encontrada' });
});

test('PATCH inexistente responde 404', async () => {
  const harness = createHarness({ updateAffectedRows: 0 });
  const { response, res } = createResponse();
  harness.req.params.id = '9999';

  await harness.controller.marcarLeida(harness.req, res);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(harness.calls.find(([name]) => name === 'notificacion:update')[2].where, {
    id: 9999,
    user_id: 88
  });
});

test('PATCH ya leída mantiene comportamiento idempotente', async () => {
  const harness = createHarness({ updateAffectedRows: 1 });
  const { response, res } = createResponse();

  await harness.controller.marcarLeida(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { id: 20, leida: true });
});

test('PATCH con id inválido responde 400', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();
  harness.req.params.id = 'abc';

  await harness.controller.marcarLeida(harness.req, res);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'id de notificação inválido' });
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:update'), false);
});

test('errores internos responden 500 con mensaje seguro', async () => {
  const harness = createHarness({ findAllError: new Error('database host leaked') });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: 'Erro ao listar notificações' });
  assert.equal(JSON.stringify(response.body).includes('database host leaked'), false);
});
