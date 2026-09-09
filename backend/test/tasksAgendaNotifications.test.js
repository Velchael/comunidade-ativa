process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTasksController } = require('../src/controllers/tasksController');

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

const createTaskInstance = (state) => ({
  ...state,
  saved: false,
  destroyed: false,
  async save() {
    this.saved = true;
  },
  async destroy() {
    this.destroyed = true;
  },
});

const createHarness = ({ tasks = [], notifyError = null } = {}) => {
  const calls = [];
  const Task = {
    create: async (values) => {
      calls.push(['Task.create', values]);
      return createTaskInstance({ id: 100, ...values });
    },
    findOne: async (options) => {
      calls.push(['Task.findOne', options]);
      const task = tasks.find((item) => (
        Number(item.id) === Number(options.where.id) &&
        Number(item.comunidad_id) === Number(options.where.comunidad_id)
      ));
      return task ? createTaskInstance(task) : null;
    },
  };
  const agendaNotifications = {
    notifyTaskCreated: async (...args) => {
      calls.push(['notifyTaskCreated', ...args]);
      if (notifyError) throw notifyError;
    },
    notifyTaskUpdated: async (...args) => {
      calls.push(['notifyTaskUpdated', ...args]);
      if (notifyError) throw notifyError;
    },
    notifyTaskDeleted: async (...args) => {
      calls.push(['notifyTaskDeleted', ...args]);
      if (notifyError) throw notifyError;
    },
  };
  const logger = {
    error: (...args) => calls.push(['logger:error', ...args]),
  };
  const controller = createTasksController({
    Task,
    User: {},
    agendaNotifications,
    logger,
  });

  return { calls, controller };
};

const TASK_BODY = {
  title: 'Culto de oração',
  description: null,
  frequency: 'semanal',
  dueDate: '2026-09-15',
  status: 'pendiente',
  priority: 'media',
};

test('CREATE envia notificação depois de Task.create com actor excluível pelo serviço', async () => {
  const { calls, controller } = createHarness();
  const { response, res } = createResponse();

  await controller.createTask({
    user: { id: 44 },
    comunidadAuth: { comunidad_id: 7 },
    body: TASK_BODY,
  }, res);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls[0], ['Task.create', {
    title: 'Culto de oração',
    description: null,
    frequency: 'semanal',
    due_date: '2026-09-15',
    status: 'pendiente',
    priority: 'media',
    created_by: 44,
    comunidad_id: 7,
  }]);
  assert.equal(calls[1][0], 'notifyTaskCreated');
  assert.equal(calls[1][1].id, 100);
  assert.equal(calls[1][1].comunidad_id, 7);
  assert.equal(calls[1][2], 44);
});

test('UPDATE captura valores previos y notifica después de save', async () => {
  const { calls, controller } = createHarness({
    tasks: [{
      id: 11,
      title: 'Culto de oração',
      description: null,
      frequency: 'semanal',
      due_date: '2026-09-15',
      status: 'pendiente',
      priority: 'media',
      comunidad_id: 7,
    }],
  });
  const { response, res } = createResponse();

  await controller.updateTask({
    user: { id: 44 },
    params: { id: 11 },
    comunidadAuth: { comunidad_id: 7 },
    body: { dueDate: '2026-09-16' },
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(calls[1][0], 'notifyTaskUpdated');
  assert.deepEqual(calls[1][1], {
    id: 11,
    title: 'Culto de oração',
    due_date: '2026-09-15',
    status: 'pendiente',
    comunidad_id: 7,
  });
  assert.equal(calls[1][2].due_date, '2026-09-16');
  assert.equal(calls[1][3], 44);
});

test('UPDATE não relevante delega ao serviço sem quebrar sucesso HTTP', async () => {
  const { calls, controller } = createHarness({
    tasks: [{
      id: 11,
      title: 'Culto de oração',
      description: null,
      frequency: 'semanal',
      due_date: '2026-09-15',
      status: 'pendiente',
      priority: 'media',
      comunidad_id: 7,
    }],
  });
  const { response, res } = createResponse();

  await controller.updateTask({
    user: { id: 44 },
    params: { id: 11 },
    comunidadAuth: { comunidad_id: 7 },
    body: { priority: 'alta' },
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.some(([name]) => name === 'notifyTaskUpdated'), true);
});

test('DELETE guarda datos antes de destroy y notifica con snapshot previo', async () => {
  const { calls, controller } = createHarness({
    tasks: [{
      id: 11,
      title: 'Culto de oração',
      due_date: '2026-09-15',
      status: 'pendiente',
      comunidad_id: 7,
    }],
  });
  const { response, res } = createResponse();

  await controller.deleteTask({
    user: { id: 44 },
    params: { id: 11 },
    comunidadAuth: { comunidad_id: 7 },
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(calls[1][0], 'notifyTaskDeleted');
  assert.deepEqual(calls[1][1], {
    id: 11,
    title: 'Culto de oração',
    due_date: '2026-09-15',
    status: 'pendiente',
    comunidad_id: 7,
  });
  assert.equal(calls[1][2], 44);
});

test('erro de push não transforma operação Agenda exitosa em 500', async () => {
  const { calls, controller } = createHarness({
    notifyError: new Error('push failed'),
  });
  const { response, res } = createResponse();

  await controller.createTask({
    user: { id: 44 },
    comunidadAuth: { comunidad_id: 7 },
    body: TASK_BODY,
  }, res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.id, 100);
  assert.equal(calls.some(([name]) => name === 'logger:error'), true);
});
