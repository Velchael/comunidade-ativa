process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  createConversasController,
  MAX_CORPO_LENGTH,
  MAX_LIMIT,
} = require('../src/controllers/conversasController');

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
    },
  };

  return { response, res };
};

const row = (value) => ({
  ...value,
  async update(values, options = {}) {
    if (options.transaction?.stageUpdate) {
      return options.transaction.stageUpdate(this, values);
    }
    Object.assign(this, values);
    return this;
  },
  toJSON() {
    return Object.fromEntries(
      Object.entries(this).filter(([, currentValue]) => typeof currentValue !== 'function')
    );
  },
});

const normalizeId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const opValue = (where, op) => where && Object.getOwnPropertySymbols(where).find((symbol) => symbol === op);

const includesId = (candidate, id) => {
  if (candidate && typeof candidate === 'object') {
    const inValues = candidate[Op.in];
    if (Array.isArray(inValues)) return inValues.map(Number).includes(Number(id));
    const neValue = candidate[Op.ne];
    if (neValue !== undefined) return Number(id) !== Number(neValue);
  }
  return Number(candidate) === Number(id);
};

const matchesIdCondition = (id, condition) => {
  if (!condition || typeof condition !== 'object') return Number(id) === Number(condition);
  if (condition[Op.gt] !== undefined) return Number(id) > Number(condition[Op.gt]);
  if (condition[Op.lt] !== undefined) return Number(id) < Number(condition[Op.lt]);
  if (Array.isArray(condition[Op.in])) return condition[Op.in].map(Number).includes(Number(id));
  if (condition[Op.ne] !== undefined) return Number(id) !== Number(condition[Op.ne]);
  return true;
};

const createHarness = ({
  actorUserId = 1,
  users = [
    { id: 1, username: 'Ana', foto_perfil: null },
    { id: 2, username: 'Beto', foto_perfil: null },
    { id: 3, username: 'Carla', foto_perfil: null },
    { id: 4, username: 'Davi', foto_perfil: null },
  ],
  comunidades = [
    { id: 10, nombre_comunidad: 'Centro', activa: true },
    { id: 20, nombre_comunidad: 'Norte', activa: true },
  ],
  memberships = [
    { user_id: 1, comunidad_id: 10, estado: 'activo' },
    { user_id: 2, comunidad_id: 10, estado: 'activo' },
    { user_id: 3, comunidad_id: 10, estado: 'activo' },
    { user_id: 4, comunidad_id: 20, estado: 'activo' },
  ],
  interacciones = [
    { id: 50, user_id: 2, comunidad_id: 10 },
    { id: 51, user_id: 4, comunidad_id: 20 },
  ],
  respuestas = [
    { id: 60, interaccion_id: 50, user_id: 2 },
  ],
  conversas = [],
  mensagens = [],
  notificaciones = [],
  concurrentCreate = false,
  forceUnexpectedUnique = false,
  notificacionError = null,
  deliveryError = null,
  deliveryResult = { attempted: 1, delivered: 1, expired: 0, failed: 0 },
} = {}) => {
  const calls = [];
  const state = {
    users: users.map(row),
    comunidades: comunidades.map(row),
    memberships: memberships.map(row),
    interacciones: interacciones.map(row),
    respostas: respuestas.map(row),
    conversas: conversas.map((item) => row({
      last_message_at: null,
      ...item,
    })),
    mensagens: mensagens.map(row),
    notificaciones: notificaciones.map(row),
    nextConversaId: 100,
    nextMensagemId: 1000,
    nextNotificacionId: 5000,
  };

  const findConversaByPair = ({ comunidad_id, participante_1_id, participante_2_id }) => (
    state.conversas.find((conversa) => (
      Number(conversa.comunidad_id) === Number(comunidad_id) &&
      Number(conversa.participante_1_id) === Number(participante_1_id) &&
      Number(conversa.participante_2_id) === Number(participante_2_id)
    )) || null
  );

  const hydrateConversa = (conversa) => {
    if (!conversa) return null;
    conversa.comunidad = state.comunidades.find((comunidad) => comunidad.id === conversa.comunidad_id) || null;
    conversa.participante1 = state.users.find((user) => user.id === conversa.participante_1_id) || null;
    conversa.participante2 = state.users.find((user) => user.id === conversa.participante_2_id) || null;
    return conversa;
  };

  const ConversaPrivada = {
    findOne: async (options) => {
      calls.push(['ConversaPrivada.findOne', options]);
      const where = options?.where || {};
      if (where.id) {
        const orSymbol = opValue(where, Op.or);
        const orClauses = orSymbol ? where[orSymbol] : [];
        const conversa = state.conversas.find((item) => (
          Number(item.id) === Number(where.id) &&
          orClauses.some((clause) => (
            Number(clause.participante_1_id) === Number(item.participante_1_id) ||
            Number(clause.participante_2_id) === Number(item.participante_2_id)
          ))
        ));
        return hydrateConversa(conversa || null);
      }

      return hydrateConversa(findConversaByPair(where));
    },
    findAll: async (options) => {
      calls.push(['ConversaPrivada.findAll', options]);
      const orSymbol = opValue(options?.where, Op.or);
      const orClauses = orSymbol ? options.where[orSymbol] : [];
      const items = state.conversas
        .filter((conversa) => orClauses.some((clause) => (
          Number(clause.participante_1_id) === Number(conversa.participante_1_id) ||
          Number(clause.participante_2_id) === Number(conversa.participante_2_id)
        )))
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, options?.limit || 50)
        .map(hydrateConversa);
      return items;
    },
    create: async (values) => {
      calls.push(['ConversaPrivada.create', values]);
      if (concurrentCreate) await new Promise((resolve) => setTimeout(resolve, 10));
      if (forceUnexpectedUnique) {
        const error = new Error('duplicate email');
        error.name = 'SequelizeUniqueConstraintError';
        error.constraint = 'users_email_key';
        error.fields = { email: 'ana@example.test' };
        throw error;
      }
      const existing = findConversaByPair(values);
      if (existing) {
        const error = new Error('duplicate key value violates unique constraint');
        error.name = 'SequelizeUniqueConstraintError';
        error.constraint = 'conversas_privadas_comunidad_participantes_key';
        error.fields = {
          comunidad_id: values.comunidad_id,
          participante_1_id: values.participante_1_id,
          participante_2_id: values.participante_2_id,
        };
        throw error;
      }
      const created = row({ id: state.nextConversaId, ...values });
      state.nextConversaId += 1;
      state.conversas.push(created);
      return hydrateConversa(created);
    },
  };

  const ConversaMensagem = {
    findAll: async (options) => {
      calls.push(['ConversaMensagem.findAll', options]);
      const where = options?.where || {};
      let items = state.mensagens.filter((mensagem) => {
        if (where.conversa_id && !matchesIdCondition(mensagem.conversa_id, where.conversa_id)) return false;
        if (where.id && !matchesIdCondition(mensagem.id, where.id)) return false;
        if (where.sender_user_id && !includesId(where.sender_user_id, mensagem.sender_user_id)) return false;
        if (where.read_at === null && mensagem.read_at !== null && mensagem.read_at !== undefined) return false;
        return true;
      });

      if (options?.group) {
        const grouped = new Map();
        for (const mensagem of items) {
          grouped.set(mensagem.conversa_id, (grouped.get(mensagem.conversa_id) || 0) + 1);
        }
        return [...grouped.entries()].map(([conversa_id, unread_count]) => row({ conversa_id, unread_count }));
      }

      const order = options?.order || [['id', 'ASC']];
      const direction = order.some(([field, dir]) => field === 'id' && dir === 'DESC') ? 'DESC' : 'ASC';
      items = items.sort((a, b) => direction === 'DESC' ? b.id - a.id : a.id - b.id);
      return items.slice(0, options?.limit || 50);
    },
    create: async (values, options = {}) => {
      calls.push(['ConversaMensagem.create', values, options]);
      const created = row({
        id: state.nextMensagemId,
        created_at: new Date('2026-09-15T10:00:00.000Z'),
        ...values,
      });
      state.nextMensagemId += 1;
      if (options.transaction?.pendingMensagens) {
        options.transaction.pendingMensagens.push(created);
      } else {
        state.mensagens.push(created);
      }
      return created;
    },
    update: async (values, options) => {
      calls.push(['ConversaMensagem.update', values, options]);
      let updated = 0;
      for (const mensagem of state.mensagens) {
        const where = options?.where || {};
        if (Number(mensagem.conversa_id) !== Number(where.conversa_id)) continue;
        if (!includesId(where.sender_user_id, mensagem.sender_user_id)) continue;
        if (where.read_at === null && mensagem.read_at !== null && mensagem.read_at !== undefined) continue;
        Object.assign(mensagem, values);
        updated += 1;
      }
      return [updated];
    },
  };

  const User = {
    findByPk: async (id) => {
      calls.push(['User.findByPk', id]);
      return state.users.find((user) => user.id === Number(id)) || null;
    },
  };

  const Comunidad = {
    findByPk: async (id) => {
      calls.push(['Comunidad.findByPk', id]);
      return state.comunidades.find((comunidad) => comunidad.id === Number(id)) || null;
    },
  };

  const ComunidadMiembro = {
    findAll: async (options) => {
      calls.push(['ComunidadMiembro.findAll', options]);
      const where = options?.where || {};
      return state.memberships.filter((membership) => {
        if (where.user_id && !includesId(where.user_id, membership.user_id)) return false;
        if (where.comunidad_id && !includesId(where.comunidad_id, membership.comunidad_id)) return false;
        if (where.estado && where.estado !== membership.estado) return false;
        return true;
      });
    },
  };

  const Interaccion = {
    findByPk: async (id) => {
      calls.push(['Interaccion.findByPk', id]);
      return state.interacciones.find((interaccion) => interaccion.id === Number(id)) || null;
    },
  };

  const Respuesta = {
    findByPk: async (id) => {
      calls.push(['Respuesta.findByPk', id]);
      const resposta = state.respostas.find((item) => item.id === Number(id));
      if (!resposta) return null;
      resposta.interaccion = state.interacciones.find((interaccion) => interaccion.id === resposta.interaccion_id) || null;
      return resposta;
    },
  };

  const Notificacion = {
    create: async (values, options = {}) => {
      calls.push(['Notificacion.create', values, options]);
      if (notificacionError) throw notificacionError;
      const created = row({ id: state.nextNotificacionId, ...values });
      state.nextNotificacionId += 1;
      if (options.transaction?.pendingNotificaciones) {
        options.transaction.pendingNotificaciones.push(created);
      } else {
        state.notificaciones.push(created);
      }
      return created;
    },
  };

  const deliveryService = {
    deliver: async (notificacion) => {
      calls.push(['delivery.deliver', notificacion]);
      if (deliveryError) throw deliveryError;
      return deliveryResult;
    },
  };

  const sequelize = {
    transaction: async () => {
      calls.push(['transaction.start']);
      return {
        pendingMensagens: [],
        pendingNotificaciones: [],
        pendingUpdates: [],
        stageUpdate(target, values) {
          this.pendingUpdates.push([target, values]);
          return target;
        },
        async commit() {
          calls.push(['transaction.commit']);
          state.mensagens.push(...this.pendingMensagens);
          state.notificaciones.push(...this.pendingNotificaciones);
          for (const [target, values] of this.pendingUpdates) {
            Object.assign(target, values);
          }
        },
        async rollback() {
          calls.push(['transaction.rollback']);
          this.pendingMensagens = [];
          this.pendingNotificaciones = [];
          this.pendingUpdates = [];
        },
      };
    },
    query: async (sql, options) => {
      calls.push(['sequelize.query', sql, options]);
      const ids = options?.replacements?.conversaIds || [];
      const latestByConversaId = new Map();
      for (const mensagem of [...state.mensagens].sort((a, b) => b.id - a.id)) {
        if (!ids.includes(mensagem.conversa_id)) continue;
        if (!latestByConversaId.has(mensagem.conversa_id)) {
          latestByConversaId.set(mensagem.conversa_id, mensagem);
        }
      }
      return [...latestByConversaId.values()];
    },
  };

  const controller = createConversasController({
    ConversaPrivada,
    ConversaMensagem,
    Comunidad,
    ComunidadMiembro,
    User,
    Interaccion,
    Respuesta,
    Notificacion,
    sequelize,
    deliveryService,
    logger: { error: (...args) => calls.push(['logger.error', ...args]) },
  });

  const req = {
    user: { id: actorUserId, username: users.find((user) => user.id === actorUserId)?.username },
    body: { target_user_id: 2, comunidad_id: 10 },
    query: {},
    params: {},
  };

  return { calls, controller, req, state };
};

test('A e B ativos na mesma comunidade permitem conversa', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.id, 100);
  assert.equal(harness.state.conversas.length, 1);
  assert.equal(harness.state.conversas[0].participante_1_id, 1);
  assert.equal(harness.state.conversas[0].participante_2_id, 2);
});

test('A igual a B é rejeitado', async () => {
  const harness = createHarness();
  harness.req.body.target_user_id = 1;
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 400);
});

test('B inexistente é rejeitado', async () => {
  const harness = createHarness();
  harness.req.body.target_user_id = 999;
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 404);
});

test('B não membro é rejeitado', async () => {
  const harness = createHarness({ memberships: [{ user_id: 1, comunidad_id: 10, estado: 'activo' }] });
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 403);
});

test('B membro inativo é rejeitado', async () => {
  const harness = createHarness({
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
  });
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 403);
});

test('A membro inativo é rejeitado', async () => {
  const harness = createHarness({
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'inactivo' },
      { user_id: 2, comunidad_id: 10, estado: 'activo' },
    ],
  });
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 403);
});

test('comunidade incorreta é rejeitada', async () => {
  const harness = createHarness();
  harness.req.body.comunidad_id = 20;
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 403);
});

test('origem de interação resolve destinatário e comunidade no backend', async () => {
  const harness = createHarness();
  harness.req.body = { origin_interaccion_id: 50 };
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.state.conversas[0].origin_interaccion_id, 50);
  assert.equal(harness.state.conversas[0].participante_2_id, 2);
});

test('origem de resposta resolve destinatário e interação no backend', async () => {
  const harness = createHarness();
  harness.req.body = { origin_respuesta_id: 60 };
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.state.conversas[0].origin_interaccion_id, 50);
  assert.equal(harness.state.conversas[0].participante_2_id, 2);
});

test('conversa A/B reutiliza conversa existente', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.body.id, 77);
  assert.equal(harness.state.conversas.length, 1);
});

test('conversa B/A reutiliza exatamente a mesma conversa', async () => {
  const harness = createHarness({
    actorUserId: 2,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.user.id = 2;
  harness.req.body.target_user_id = 1;
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.body.id, 77);
  assert.equal(harness.state.conversas.length, 1);
});

test('tentativa concorrente não produz duplicados', async () => {
  const harness = createHarness({ concurrentCreate: true });
  const first = createResponse();
  const second = createResponse();

  await Promise.all([
    harness.controller.criarOuObter(harness.req, first.res),
    harness.controller.criarOuObter(harness.req, second.res),
  ]);

  assert.equal(first.response.statusCode, 200);
  assert.equal(second.response.statusCode, 200);
  assert.equal(first.response.body.id, second.response.body.id);
  assert.equal(harness.state.conversas.length, 1);
});

test('conflito unique esperado recupera conversa existente', async () => {
  const harness = createHarness({ concurrentCreate: true });
  const first = createResponse();
  const second = createResponse();

  await harness.controller.criarOuObter(harness.req, first.res);
  await harness.controller.criarOuObter(harness.req, second.res);

  assert.equal(first.response.statusCode, 200);
  assert.equal(second.response.statusCode, 200);
  assert.equal(second.response.body.id, first.response.body.id);
  assert.equal(harness.state.conversas.length, 1);
});

test('UniqueConstraintError alheio não é tratado como corrida válida', async () => {
  const harness = createHarness({ forceUnexpectedUnique: true });
  const { response, res } = createResponse();

  await harness.controller.criarOuObter(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.equal(harness.state.conversas.length, 0);
});

test('participante pode listar conversa', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 90, conversa_id: 77, sender_user_id: 2, corpo: 'Oi', read_at: null, created_at: 'x' }],
  });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].id, 77);
  assert.equal(response.body.items[0].unread_count, 1);
  assert.equal(response.body.items[0].ultimo_mensagem.id, 90);
  assert.equal(response.body.items[0].can_send, true);
});

test('conversa histórica segue listada com can_send false quando membro está inativo', async () => {
  const harness = createHarness({
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].can_send, false);
});

test('conversa histórica segue listada com can_send false quando comunidade está inativa', async () => {
  const harness = createHarness({
    comunidades: [
      { id: 10, nombre_comunidad: 'Centro', activa: false },
      { id: 20, nombre_comunidad: 'Norte', activa: true },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.items[0].can_send, false);
});

test('terceiro não pode ler mensagens', async () => {
  const harness = createHarness({
    actorUserId: 3,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.listarMensagens(harness.req, res);

  assert.equal(response.statusCode, 403);
});

test('terceiro não pode enviar mensagem', async () => {
  const harness = createHarness({
    actorUserId: 3,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 403);
  assert.equal(harness.state.mensagens.length, 0);
  assert.equal(harness.state.notificaciones.length, 0);
});

test('participantes históricos seguem lendo mensagens quando B fica inativo', async () => {
  const base = {
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'histórico', created_at: 'x' }],
  };
  const actorA = createHarness(base);
  actorA.req.params.id = '77';
  const first = createResponse();

  await actorA.controller.listarMensagens(actorA.req, first.res);

  const actorB = createHarness({ ...base, actorUserId: 2 });
  actorB.req.params.id = '77';
  const second = createResponse();

  await actorB.controller.listarMensagens(actorB.req, second.res);

  assert.equal(first.response.statusCode, 200);
  assert.equal(second.response.statusCode, 200);
  assert.equal(first.response.body.items[0].corpo, 'histórico');
  assert.equal(second.response.body.items[0].corpo, 'histórico');
});

test('envio é bloqueado quando destinatário histórico está inativo', async () => {
  const harness = createHarness({
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 403);
  assert.equal(harness.state.mensagens.length, 0);
  assert.equal(harness.state.notificaciones.length, 0);
});

test('envio é bloqueado quando remetente histórico está inativo', async () => {
  const harness = createHarness({
    actorUserId: 2,
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 403);
  assert.equal(harness.state.mensagens.length, 0);
  assert.equal(harness.state.notificaciones.length, 0);
});

test('envio é bloqueado quando comunidade histórica está inativa', async () => {
  const harness = createHarness({
    comunidades: [
      { id: 10, nombre_comunidad: 'Centro', activa: false },
      { id: 20, nombre_comunidad: 'Norte', activa: true },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 403);
  assert.equal(harness.state.mensagens.length, 0);
  assert.equal(harness.state.notificaciones.length, 0);
});

test('ambos participantes são bloqueados para enviar quando comunidade está inativa', async () => {
  const base = {
    comunidades: [
      { id: 10, nombre_comunidad: 'Centro', activa: false },
      { id: 20, nombre_comunidad: 'Norte', activa: true },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  };
  const actorA = createHarness(base);
  actorA.req.params.id = '77';
  actorA.req.body = { corpo: 'A' };
  const first = createResponse();

  await actorA.controller.enviarMensagem(actorA.req, first.res);

  const actorB = createHarness({ ...base, actorUserId: 2 });
  actorB.req.params.id = '77';
  actorB.req.body = { corpo: 'B' };
  const second = createResponse();

  await actorB.controller.enviarMensagem(actorB.req, second.res);

  assert.equal(first.response.statusCode, 403);
  assert.equal(second.response.statusCode, 403);
});

test('sender_user_id não pode ser falsificado', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi', sender_user_id: 2 };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.sender_user_id, 1);
});

test('mensagem válida cria notificação persistente para outro participante e faz delivery pós-commit', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'te espero na Rua X às 18h' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  assert.equal(harness.state.mensagens.length, 1);
  assert.equal(harness.state.conversas[0].last_message_at, harness.state.mensagens[0].created_at);
  assert.equal(harness.state.notificaciones.length, 1);
  assert.deepEqual(harness.state.notificaciones[0].toJSON(), {
    id: 5000,
    user_id: 2,
    actor_user_id: 1,
    tipo: 'mensagem_privada',
    interaccion_id: null,
    respuesta_id: null,
    comunidad_id: 10,
    task_id: null,
    titulo: 'Nova mensagem privada',
    corpo: 'Ana enviou uma mensagem.',
    url: '/conversas/77',
    leida: false,
  });
  assert.equal(harness.state.notificaciones[0].user_id, 2);
  assert.notEqual(harness.state.notificaciones[0].user_id, harness.req.user.id);

  const commitIndex = harness.calls.findIndex(([name]) => name === 'transaction.commit');
  const deliveryIndex = harness.calls.findIndex(([name]) => name === 'delivery.deliver');
  assert.ok(deliveryIndex > commitIndex);
  assert.equal(harness.calls.find(([name]) => name === 'delivery.deliver')[1], harness.state.notificaciones[0]);
});

test('sender participante_2 notifica somente participante_1', async () => {
  const harness = createHarness({
    actorUserId: 2,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  assert.equal(harness.state.notificaciones.length, 1);
  assert.equal(harness.state.notificaciones[0].user_id, 1);
  assert.equal(harness.state.notificaciones[0].actor_user_id, 2);
});

test('notificação privada nunca persiste o corpo real da mensagem', async () => {
  const secret = 'João: te espero na Rua X às 18h';
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: secret };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  const persistedNotification = JSON.stringify(harness.state.notificaciones[0]);
  assert.equal(persistedNotification.includes(secret), false);
  assert.equal(harness.state.notificaciones[0].titulo, 'Nova mensagem privada');
  assert.equal(harness.state.notificaciones[0].corpo, 'Ana enviou uma mensagem.');
});

test('falha em Notificacion.create faz rollback de mensagem e last_message_at sem delivery', async () => {
  const harness = createHarness({
    notificacionError: new Error('notificacion check failed'),
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.equal(harness.state.mensagens.length, 0);
  assert.equal(harness.state.conversas[0].last_message_at, null);
  assert.equal(harness.state.notificaciones.length, 0);
  assert.equal(harness.calls.some(([name]) => name === 'delivery.deliver'), false);
  assert.equal(harness.calls.some(([name]) => name === 'transaction.rollback'), true);
});

test('falha de delivery pós-commit mantém mensagem e notificação persistidas', async () => {
  const harness = createHarness({
    deliveryError: new Error('push endpoint secret'),
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  assert.equal(harness.state.mensagens.length, 1);
  assert.equal(harness.state.notificaciones.length, 1);
  assert.equal(harness.calls.some(([name]) => name === 'transaction.rollback'), false);
  assert.deepEqual(harness.calls.find(([name]) => name === 'logger.error'), [
    'logger.error',
    'post-commit private message notification delivery error',
  ]);
});

test('delivery com N subscriptions não duplica Notificacion persistente', async () => {
  const harness = createHarness({
    deliveryResult: { attempted: 3, delivered: 3, expired: 0, failed: 0 },
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'Oi' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 201);
  assert.equal(harness.state.notificaciones.length, 1);
  assert.equal(harness.calls.filter(([name]) => name === 'delivery.deliver').length, 1);
});

test('mensagem vazia é rejeitada', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: '   ' };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 400);
});

test('mensagem superior ao limite é rejeitada', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
  });
  harness.req.params.id = '77';
  harness.req.body = { corpo: 'a'.repeat(MAX_CORPO_LENGTH + 1) };
  const { response, res } = createResponse();

  await harness.controller.enviarMensagem(harness.req, res);

  assert.equal(response.statusCode, 400);
});

test('paginação respeita limite máximo', async () => {
  const mensagens = Array.from({ length: 130 }, (_, index) => ({
    id: index + 1,
    conversa_id: 77,
    sender_user_id: 1,
    corpo: `m${index + 1}`,
    created_at: 'x',
  }));
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens,
  });
  harness.req.params.id = '77';
  harness.req.query.limit = '999';
  const { response, res } = createResponse();

  await harness.controller.listarMensagens(harness.req, res);

  assert.equal(response.body.items.length, MAX_LIMIT);
  assert.equal(response.body.limit, MAX_LIMIT);
});

test('paginação rejeita limits inválidos', async () => {
  for (const limit of ['0', '-1', 'abc', '1.5']) {
    const harness = createHarness({
      conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    });
    harness.req.params.id = '77';
    harness.req.query.limit = limit;
    const { response, res } = createResponse();

    await harness.controller.listarMensagens(harness.req, res);

    assert.equal(response.statusCode, 400);
  }
});

test('paginação rejeita cursores inválidos e combinação after/before', async () => {
  const cases = [
    { after_id: 'abc' },
    { before_id: 'abc' },
    { after_id: '1', before_id: '2' },
  ];

  for (const query of cases) {
    const harness = createHarness({
      conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    });
    harness.req.params.id = '77';
    harness.req.query = query;
    const { response, res } = createResponse();

    await harness.controller.listarMensagens(harness.req, res);

    assert.equal(response.statusCode, 400);
  }
});

test('after_id devolve somente mensagens posteriores', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [
      { id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'a', created_at: 'x' },
      { id: 2, conversa_id: 77, sender_user_id: 2, corpo: 'b', created_at: 'x' },
      { id: 3, conversa_id: 77, sender_user_id: 1, corpo: 'c', created_at: 'x' },
    ],
  });
  harness.req.params.id = '77';
  harness.req.query.after_id = '1';
  const { response, res } = createResponse();

  await harness.controller.listarMensagens(harness.req, res);

  assert.deepEqual(response.body.items.map((item) => item.id), [2, 3]);
});

test('before_id devolve histórico anterior', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [
      { id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'a', created_at: 'x' },
      { id: 2, conversa_id: 77, sender_user_id: 2, corpo: 'b', created_at: 'x' },
      { id: 3, conversa_id: 77, sender_user_id: 1, corpo: 'c', created_at: 'x' },
    ],
  });
  harness.req.params.id = '77';
  harness.req.query.before_id = '3';
  const { response, res } = createResponse();

  await harness.controller.listarMensagens(harness.req, res);

  assert.deepEqual(response.body.items.map((item) => item.id), [1, 2]);
});

test('marcar lido afeta somente mensagens recebidas', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [
      { id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'minha', read_at: null },
      { id: 2, conversa_id: 77, sender_user_id: 2, corpo: 'outra', read_at: null },
      { id: 3, conversa_id: 77, sender_user_id: 2, corpo: 'lida', read_at: '2026-01-01' },
    ],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.marcarLida(harness.req, res);

  assert.equal(response.body.marked_read, 1);
  assert.equal(harness.state.mensagens[0].read_at, null);
  assert.ok(harness.state.mensagens[1].read_at instanceof Date);
  assert.equal(harness.state.mensagens[2].read_at, '2026-01-01');
});

test('participante histórico inativo pode marcar mensagens recebidas como lidas', async () => {
  const harness = createHarness({
    actorUserId: 2,
    memberships: [
      { user_id: 1, comunidad_id: 10, estado: 'activo' },
      { user_id: 2, comunidad_id: 10, estado: 'inactivo' },
    ],
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'recebida', read_at: null }],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.marcarLida(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.marked_read, 1);
  assert.ok(harness.state.mensagens[0].read_at instanceof Date);
});

test('terceiro não pode marcar conversa como lida', async () => {
  const harness = createHarness({
    actorUserId: 3,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'privado', read_at: null }],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.marcarLida(harness.req, res);

  assert.equal(response.statusCode, 403);
  assert.equal(harness.state.mensagens[0].read_at, null);
});

test('mensagens próprias não são marcadas read_at', async () => {
  const harness = createHarness({
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'minha', read_at: null }],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.marcarLida(harness.req, res);

  assert.equal(response.body.marked_read, 0);
  assert.equal(harness.state.mensagens[0].read_at, null);
});

test('usuário de outra comunidade não acessa conversa', async () => {
  const harness = createHarness({
    actorUserId: 4,
    conversas: [{ id: 77, comunidad_id: 10, participante_1_id: 1, participante_2_id: 2 }],
    mensagens: [{ id: 1, conversa_id: 77, sender_user_id: 1, corpo: 'privado' }],
  });
  harness.req.params.id = '77';
  const { response, res } = createResponse();

  await harness.controller.listarMensagens(harness.req, res);

  assert.equal(response.statusCode, 403);
});
