process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRespuestasController } = require('../src/controllers/respuestasController');

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
  interaccion = { id: 15, user_id: 88 },
  actorUserId = 42,
  respuestaError = null,
  notificacionError = null,
  deliveryResult = { attempted: 1, delivered: 1, expired: 0, failed: 0 },
  deliveryError = null
} = {}) => {
  const calls = [];
  const committedRespuestas = [];
  const committedNotificaciones = [];
  const logger = { error: (...args) => calls.push(['logger:error', ...args]) };

  const sequelize = {
    transaction: async () => {
      const transaction = {
        pendingRespuestas: [],
        pendingNotificaciones: [],
        async commit() {
          calls.push(['transaction:commit']);
          committedRespuestas.push(...this.pendingRespuestas);
          committedNotificaciones.push(...this.pendingNotificaciones);
        },
        async rollback() {
          calls.push(['transaction:rollback']);
          this.pendingRespuestas = [];
          this.pendingNotificaciones = [];
        }
      };
      calls.push(['transaction:start', transaction]);
      return transaction;
    }
  };

  const Interaccion = {
    findByPk: async (id, options) => {
      calls.push(['interaccion:findByPk', id, options]);
      return interaccion;
    }
  };

  const Respuesta = {
    create: async (values, options) => {
      calls.push(['respuesta:create', values, options]);
      if (respuestaError) throw respuestaError;
      const respuesta = { id: 30, ...values };
      options.transaction.pendingRespuestas.push(respuesta);
      return respuesta;
    }
  };

  const Notificacion = {
    create: async (values, options) => {
      calls.push(['notificacion:create', values, options]);
      if (notificacionError) throw notificacionError;
      const notificacion = { id: 40, ...values };
      options.transaction.pendingNotificaciones.push(notificacion);
      return notificacion;
    }
  };

  const deliveryService = {
    deliver: async (notificacion) => {
      calls.push(['delivery:deliver', notificacion]);
      if (deliveryError) throw deliveryError;
      return deliveryResult;
    }
  };

  const controller = createRespuestasController({
    Respuesta,
    Interaccion,
    Notificacion,
    sequelize,
    deliveryService,
    logger
  });
  const req = {
    user: { id: actorUserId },
    body: {
      interaccion_id: 15,
      user_id: 999,
      recipient_user_id: 777,
      mensaje: 'Respuesta normal',
      imagen_url: 'https://example.test/image.jpg'
    }
  };

  return {
    calls,
    committedNotificaciones,
    committedRespuestas,
    controller,
    req
  };
};

test('actor usa req.user.id aunque body.user_id seja distinto', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.find(([name]) => name === 'respuesta:create')[1].user_id, 42);
  assert.equal(response.body.user_id, 42);
});

test('interação inexistente não cria resposta nem notificação', async () => {
  const harness = createHarness({ interaccion: null });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: 'Interação não encontrada' });
  assert.equal(harness.calls.some(([name]) => name === 'respuesta:create'), false);
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:create'), false);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), true);
});

test('resposta de usuário B a publicação de A cria resposta e notificação', async () => {
  const harness = createHarness({ interaccion: { id: 15, user_id: 88 }, actorUserId: 42 });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(harness.committedRespuestas, [{
    id: 30,
    interaccion_id: 15,
    user_id: 42,
    mensaje: 'Respuesta normal',
    imagen_url: 'https://example.test/image.jpg',
    estado: undefined
  }]);
  assert.deepEqual(harness.committedNotificaciones, [{
    id: 40,
    user_id: 88,
    actor_user_id: 42,
    tipo: 'respuesta_interaccion',
    interaccion_id: 15,
    respuesta_id: 30,
    leida: false
  }]);
});

test('autor responde a própria publicação sem criar notificação', async () => {
  const harness = createHarness({ interaccion: { id: 15, user_id: 42 }, actorUserId: 42 });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.committedRespuestas.length, 1);
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:create'), false);
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliver'), false);
  assert.deepEqual(harness.committedNotificaciones, []);
});

test('falha em Respuesta.create faz rollback e não cria Notificacion', async () => {
  const harness = createHarness({ respuestaError: new Error('RDS respuesta failed') });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: 'Erro ao criar resposta' });
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:create'), false);
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliver'), false);
  assert.deepEqual(harness.committedRespuestas, []);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), true);
});

test('falha em Notificacion.create faz rollback completo da resposta', async () => {
  const harness = createHarness({ notificacionError: new Error('RDS notificacion failed') });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: 'Erro ao criar resposta' });
  assert.deepEqual(harness.committedRespuestas, []);
  assert.deepEqual(harness.committedNotificaciones, []);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), true);
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliver'), false);
});

test('transaction.commit ocorre no fluxo exitoso', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(harness.calls.some(([name]) => name === 'transaction:commit'), true);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), false);
});

test('transaction.rollback ocorre em falho', async () => {
  const harness = createHarness({ notificacionError: new Error('RDS notificacion failed') });
  const { res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), true);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:commit'), false);
});

test('não aceita recipient_user_id vindo do body', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(
    Object.hasOwn(harness.calls.find(([name]) => name === 'respuesta:create')[1], 'recipient_user_id'),
    false
  );
  assert.equal(
    harness.calls.find(([name]) => name === 'notificacion:create')[1].user_id,
    88
  );
});

test('conserva contrato HTTP esperado retornando a resposta criada', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    id: 30,
    interaccion_id: 15,
    user_id: 42,
    mensaje: 'Respuesta normal',
    imagen_url: 'https://example.test/image.jpg',
    estado: undefined
  });
});

test('busca interação oficial dentro da transação', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.crear(harness.req, res);

  const transaction = harness.calls.find(([name]) => name === 'transaction:start')[1];
  assert.deepEqual(harness.calls.find(([name]) => name === 'interaccion:findByPk'), [
    'interaccion:findByPk',
    15,
    { attributes: ['id', 'user_id'], transaction }
  ]);
});

test('delivery ocorre somente depois do commit e recebe a Notificacion comprometida', async () => {
  const harness = createHarness();
  const { res } = createResponse();

  await harness.controller.crear(harness.req, res);

  const commitIndex = harness.calls.findIndex(([name]) => name === 'transaction:commit');
  const deliveryIndex = harness.calls.findIndex(([name]) => name === 'delivery:deliver');
  assert.ok(commitIndex >= 0);
  assert.ok(deliveryIndex > commitIndex);
  assert.equal(harness.committedNotificaciones.length, 1);
  assert.equal(
    harness.calls.find(([name]) => name === 'delivery:deliver')[1],
    harness.committedNotificaciones[0]
  );
});

test('delivery sem subscriptions não altera o sucesso HTTP', async () => {
  const harness = createHarness({
    deliveryResult: { attempted: 0, delivered: 0, expired: 0, failed: 0 }
  });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliver'), true);
  assert.equal(response.body.id, 30);
});

test('push fallido no altera la respuesta HTTP exitosa', async () => {
  const harness = createHarness({
    deliveryResult: { attempted: 1, delivered: 0, expired: 0, failed: 1 }
  });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id, 30);
  assert.equal(harness.committedRespuestas.length, 1);
  assert.equal(harness.committedNotificaciones.length, 1);
});

test('excepción interna de delivery no rompe POST ni intenta rollback post-commit', async () => {
  const harness = createHarness({ deliveryError: new Error('push internal secret') });
  const { response, res } = createResponse();

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id, 30);
  assert.equal(harness.calls.some(([name]) => name === 'transaction:rollback'), false);
  assert.deepEqual(
    harness.calls.find(([name]) => name === 'logger:error'),
    ['logger:error', 'post-commit notification delivery error']
  );
});
