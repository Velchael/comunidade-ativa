process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAgendaNotificationService,
  buildCreatedPayload,
  buildDeletedPayload,
  getRelevantChanges,
  buildUpdatedNotification,
} = require('../src/services/agendaNotificationService');

const TASK = {
  id: 99,
  title: 'Culto de oração',
  due_date: '2026-09-15',
  status: 'pendiente',
  comunidad_id: 7,
};

const ZERO_SUMMARY = {
  recipients: 0,
  notifications: 0,
  attempted: 0,
  delivered: 0,
  expired: 0,
  failed: 0,
};

const createHarness = ({
  memberships = [
    { user_id: 1, comunidad_id: 7, estado: 'activo' },
    { user_id: 2, comunidad_id: 7, estado: 'activo' },
    { user_id: 3, comunidad_id: 7, estado: 'activo' },
    { user_id: 4, comunidad_id: 8, estado: 'activo' },
    { user_id: 5, comunidad_id: 7, estado: 'inactivo' },
    { user_id: 6, comunidad_id: 7, estado: 'activo' },
  ],
  membershipsError = null,
  bulkCreateError = null,
  deliverySummary = { attempted: 4, delivered: 4, expired: 0, failed: 0 },
  deliveryError = null,
} = {}) => {
  const calls = [];
  const logger = {
    info: (...args) => calls.push(['logger:info', ...args]),
    warn: (...args) => calls.push(['logger:warn', ...args]),
    error: (...args) => calls.push(['logger:error', ...args]),
  };
  const ComunidadMiembro = {
    findAll: async (options) => {
      calls.push(['membership:findAll', options]);
      if (membershipsError) throw membershipsError;
      return memberships.filter((membership) => (
        Number(membership.comunidad_id) === Number(options.where.comunidad_id) &&
        membership.estado === options.where.estado
      ));
    },
  };
  const Notificacion = {
    bulkCreate: async (rows, options) => {
      calls.push(['notificacion:bulkCreate', rows, options]);
      if (bulkCreateError) throw bulkCreateError;
      return rows.map((row, index) => ({ id: 1000 + index, ...row }));
    },
  };
  const deliveryService = {
    deliverMany: async (notifications) => {
      calls.push(['delivery:deliverMany', notifications]);
      if (deliveryError) throw deliveryError;
      return deliverySummary;
    },
  };
  const service = createAgendaNotificationService({
    ComunidadMiembro,
    Notificacion,
    deliveryService,
    logger,
  });

  return { calls, service };
};

test('payload de criação usa contrato Agenda sem dados privados', () => {
  assert.deepEqual(buildCreatedPayload(TASK), {
    type: 'agenda_task_created',
    title: 'Nova atividade na Agenda',
    body: 'Culto de oração — 15/09',
    url: '/TaskList',
    taskId: 99,
    comunidadId: 7,
  });
});

test('payload de exclusão conserva dados prévios da tarefa', () => {
  assert.deepEqual(buildDeletedPayload(TASK), {
    type: 'agenda_task_deleted',
    title: 'Atividade removida',
    body: 'Culto de oração foi removida da Agenda',
    url: '/TaskList',
    taskId: 99,
    comunidadId: 7,
  });
});

test('detecta mudanças relevantes mas só notifica title, due_date ou transição cancelada', () => {
  assert.deepEqual(getRelevantChanges(TASK, { ...TASK, description: 'Interno' }), []);
  assert.deepEqual(getRelevantChanges(TASK, { ...TASK, title: 'Novo título' }), ['title']);
  assert.deepEqual(getRelevantChanges(TASK, { ...TASK, due_date: '2026-09-16' }), ['due_date']);
  assert.deepEqual(getRelevantChanges(TASK, { ...TASK, status: 'completada' }), ['status']);
  assert.equal(buildUpdatedNotification(TASK, { ...TASK, status: 'en_progreso' }), null);
  assert.equal(buildUpdatedNotification({ ...TASK, status: 'en_progreso' }, {
    ...TASK,
    status: 'completada',
  }), null);
});

test('UPDATE cancelada tem prioridade e gera uma única notificação resumida', () => {
  assert.deepEqual(buildUpdatedNotification(TASK, {
    ...TASK,
    title: 'Novo título',
    due_date: '2026-09-16',
    status: 'cancelada',
  }), {
    tipo: 'agenda_task_cancelled',
    titulo: 'Atividade cancelada',
    corpo: 'Novo título foi cancelada',
    url: '/TaskList',
    task_id: 99,
    comunidad_id: 7,
  });
});

test('destinatarios usam membros ativos da mesma comunidade, excluem actor e persistem uma por usuário', async () => {
  const harness = createHarness();
  const summary = await harness.service.notifyTaskCreated(TASK, 1);

  assert.deepEqual(summary, {
    recipients: 3,
    notifications: 3,
    attempted: 4,
    delivered: 4,
    expired: 0,
    failed: 0,
  });

  const bulkCreate = harness.calls.find(([name]) => name === 'notificacion:bulkCreate');
  assert.deepEqual(bulkCreate[1].map((row) => row.user_id), [2, 3, 6]);
  assert.equal(bulkCreate[2].returning, true);
  assert.equal(harness.calls.find(([name]) => name === 'delivery:deliverMany')[1].length, 3);
  assert.equal(bulkCreate[1].some((row) => row.user_id === 1), false);
  assert.equal(bulkCreate[1].some((row) => row.user_id === 4), false);
  assert.equal(bulkCreate[1].some((row) => row.user_id === 5), false);
});

test('persistência inclui campos genéricos de Agenda e nenhuma interação/resposta', async () => {
  const harness = createHarness();
  await harness.service.notifyTaskCreated(TASK, 1);

  const rows = harness.calls.find(([name]) => name === 'notificacion:bulkCreate')[1];
  assert.deepEqual(rows[0], {
    user_id: 2,
    actor_user_id: 1,
    tipo: 'agenda_task_created',
    interaccion_id: null,
    respuesta_id: null,
    comunidad_id: 7,
    task_id: 99,
    titulo: 'Nova atividade na Agenda',
    corpo: 'Culto de oração — 15/09',
    url: '/TaskList',
    leida: false,
  });
});

test('UPDATE sem mudança notificável não consulta membros nem cria notificação', async () => {
  const harness = createHarness();
  const summary = await harness.service.notifyTaskUpdated(TASK, {
    ...TASK,
    description: 'Campo interno atualizado',
    priority: 'alta',
  }, 1);

  assert.deepEqual(summary, ZERO_SUMMARY);
  assert.equal(harness.calls.some(([name]) => name === 'membership:findAll'), false);
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:bulkCreate'), false);
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliverMany'), false);
});

test('summary preserva falhas de delivery sem apagar notificação persistida', async () => {
  const harness = createHarness({
    deliverySummary: { attempted: 4, delivered: 2, expired: 1, failed: 1 },
  });
  const summary = await harness.service.notifyTaskCreated(TASK, 1);

  assert.deepEqual(summary, {
    recipients: 3,
    notifications: 3,
    attempted: 4,
    delivered: 2,
    expired: 1,
    failed: 1,
  });
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:bulkCreate'), true);
});

test('falha de delivery não propaga exceção nem remove registros persistidos', async () => {
  const harness = createHarness({ deliveryError: new Error('raw endpoint must not leak') });

  await assert.doesNotReject(() => harness.service.notifyTaskCreated(TASK, 1));
  const logs = JSON.stringify(harness.calls.filter(([name]) => name.startsWith('logger:')));

  assert.equal(harness.calls.some(([name]) => name === 'notificacion:bulkCreate'), true);
  assert.equal(logs.includes('raw endpoint must not leak'), false);
});

test('erro na consulta de membros fica contido e não cria notificações', async () => {
  const harness = createHarness({ membershipsError: new Error('RDS failed') });
  const summary = await harness.service.notifyTaskCreated(TASK, 1);

  assert.deepEqual(summary, ZERO_SUMMARY);
  assert.equal(harness.calls.some(([name]) => name === 'notificacion:bulkCreate'), false);
});

test('falha ao persistir Notificacion fica contida e não dispara delivery', async () => {
  const harness = createHarness({ bulkCreateError: new Error('RDS failed') });

  assert.deepEqual(await harness.service.notifyTaskCreated(TASK, 1), {
    recipients: 3,
    notifications: 0,
    attempted: 0,
    delivered: 0,
    expired: 0,
    failed: 0,
  });
  assert.equal(harness.calls.some(([name]) => name === 'delivery:deliverMany'), false);
});
