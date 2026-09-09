process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');

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

const modelPath = require.resolve('../src/models');
const modulesToReload = [
  '../src/utils/comunidadRoles',
  '../src/middleware/verificarRolComunidad',
  '../src/middleware/resolveTaskContext',
  '../src/controllers/tasksController',
  '../src/routes/tasks'
].map((path) => require.resolve(path));

const loadWithModels = (models) => {
  for (const modulePath of modulesToReload) {
    delete require.cache[modulePath];
  }

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: models
  };

  return {
    comunidadRoles: require('../src/utils/comunidadRoles'),
    verificarRolComunidad: require('../src/middleware/verificarRolComunidad'),
    resolveTaskContext: require('../src/middleware/resolveTaskContext'),
    tasksController: require('../src/controllers/tasksController'),
    taskRoutes: require('../src/routes/tasks')
  };
};

const createTaskInstance = (state) => ({
  ...state,
  async save() {
    this.saved = true;
  },
  async destroy() {
    this.destroyed = true;
  }
});

const createModels = ({
  users = [],
  memberships = [],
  communities = [],
  tasks = []
} = {}) => {
  const calls = [];
  const User = {
    findByPk: async (id, options) => {
      calls.push(['User.findByPk', Number(id), options]);
      return users.find((user) => Number(user.id) === Number(id)) || null;
    }
  };
  const Comunidad = {
    findByPk: async (id, options) => {
      calls.push(['Comunidad.findByPk', Number(id), options]);
      return communities.find((community) => Number(community.id) === Number(id)) || null;
    },
    findAll: async (options) => {
      calls.push(['Comunidad.findAll', options]);
      return communities.filter((community) => (
        Number(community.owner_user_id) === Number(options.where.owner_user_id) &&
        community.activa === options.where.activa
      ));
    }
  };
  const ComunidadMiembro = {
    findOne: async (options) => {
      calls.push(['ComunidadMiembro.findOne', options]);
      return memberships.find((membership) => (
        Number(membership.user_id) === Number(options.where.user_id) &&
        Number(membership.comunidad_id) === Number(options.where.comunidad_id) &&
        membership.estado === options.where.estado
      )) || null;
    },
    findAll: async (options) => {
      calls.push(['ComunidadMiembro.findAll', options]);
      return memberships.filter((membership) => {
        const community = communities.find((item) => Number(item.id) === Number(membership.comunidad_id));
        return (
          Number(membership.user_id) === Number(options.where.user_id) &&
          membership.estado === options.where.estado &&
          community?.activa === true
        );
      });
    }
  };
  const Task = {
    findByPk: async (id, options) => {
      calls.push(['Task.findByPk', Number(id), options]);
      const task = tasks.find((item) => Number(item.id) === Number(id));
      return task ? createTaskInstance(task) : null;
    },
    findOne: async (options) => {
      calls.push(['Task.findOne', options]);
      const task = tasks.find((item) => (
        Number(item.id) === Number(options.where.id) &&
        Number(item.comunidad_id) === Number(options.where.comunidad_id)
      ));
      return task ? createTaskInstance(task) : null;
    },
    findAll: async (options) => {
      calls.push(['Task.findAll', options]);
      return tasks.filter((task) => (
        Number(task.comunidad_id) === Number(options.where.comunidad_id) &&
        (!options.where.frequency || task.frequency === options.where.frequency)
      ));
    },
    create: async (values) => {
      calls.push(['Task.create', values]);
      const task = createTaskInstance({ id: values.id || tasks.length + 1, ...values });
      tasks.push(task);
      return task;
    }
  };

  return { calls, models: { User, Comunidad, ComunidadMiembro, Task } };
};

const runMiddlewares = async (middlewares, req) => {
  const { response, res } = createResponse();
  let index = 0;
  const next = async () => {
    const middleware = middlewares[index];
    index += 1;
    if (middleware) {
      await middleware(req, res, next);
    }
  };

  await next();
  return { response, called: index };
};

const createAgendaMiddlewares = (verificarRolComunidad, resolveTaskContext, roles, existing = false) => [
  resolveTaskContext,
  verificarRolComunidad({
    rolesPermitidos: roles,
    getComunidadId: (req) => req.comunidadContext?.comunidad_id,
    rehidratarUsuario: true,
    permitirLegacyGlobal: false,
    ...(existing ? {
      forbiddenStatus: 404,
      forbiddenMessage: 'Tarefa não encontrada'
    } : {})
  }),
  (req, res) => res.json({ ok: true, comunidad_id: req.comunidadAuth.comunidad_id })
];

const readRoles = ['admin_total', 'admin_basic', 'moderador', 'miembro'];
const writeRoles = ['admin_total', 'admin_basic'];

test('miembro LIST propria comunidade recebe 200', async () => {
  const { models } = createModels({
    users: [{ id: 1, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 1, user_id: 1, comunidad_id: 7, rol_comunidad: 'miembro', estado: 'activo', es_principal: true }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, readRoles),
    { user: { id: 1 }, params: {}, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.comunidad_id, 7);
});

test('miembro GET propria comunidade recebe 200', async () => {
  const { models } = createModels({
    users: [{ id: 1, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 1, user_id: 1, comunidad_id: 7, rol_comunidad: 'miembro', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, readRoles, true),
    { user: { id: 1 }, params: { id: 10 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 200);
});

test('moderador LIST e GET propria comunidade recebem 200', async () => {
  const base = {
    users: [{ id: 11, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 11, user_id: 11, comunidad_id: 7, rol_comunidad: 'moderador', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  };

  for (const params of [{}, { id: 10 }]) {
    const { models } = createModels(base);
    const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);
    const result = await runMiddlewares(
      createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, readRoles, Boolean(params.id)),
      { user: { id: 11 }, params, body: {}, query: {} }
    );

    assert.equal(result.response.statusCode, 200);
  }
});

test('task de outra comunidade em GET retorna 404', async () => {
  const { models } = createModels({
    users: [{ id: 1, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 8, activa: true }],
    tasks: [{ id: 10, comunidad_id: 8 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, readRoles, true),
    { user: { id: 1 }, params: { id: 10 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { message: 'Tarefa não encontrada' });
});

test('miembro POST PUT DELETE recebem 403 quando pertence a comunidade', async () => {
  const base = {
    users: [{ id: 1, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 1, user_id: 1, comunidad_id: 7, rol_comunidad: 'miembro', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  };

  for (const params of [{}, { id: 10 }, { id: 10 }]) {
    const { models } = createModels(base);
    const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);
    const middlewares = params.id
      ? [
          resolveTaskContext,
          verificarRolComunidad({
            rolesPermitidos: readRoles,
            getComunidadId: (req) => req.comunidadContext?.comunidad_id,
            rehidratarUsuario: true,
            permitirLegacyGlobal: false,
            forbiddenStatus: 404,
            forbiddenMessage: 'Tarefa não encontrada'
          }),
          verificarRolComunidad({
            rolesPermitidos: writeRoles,
            getComunidadId: (req) => req.comunidadContext?.comunidad_id,
            rehidratarUsuario: true,
            permitirLegacyGlobal: false
          }),
          (req, res) => res.json({ ok: true })
        ]
      : createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles);
    const result = await runMiddlewares(
      middlewares,
      { user: { id: 1 }, params, body: {}, query: {} }
    );
    assert.equal(result.response.statusCode, 403);
  }
});

test('moderador POST PUT DELETE recebem 403 quando pertence a comunidade', async () => {
  const base = {
    users: [{ id: 11, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 11, user_id: 11, comunidad_id: 7, rol_comunidad: 'moderador', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  };

  for (const params of [{}, { id: 10 }, { id: 10 }]) {
    const { models } = createModels(base);
    const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);
    const middlewares = params.id
      ? [
          resolveTaskContext,
          verificarRolComunidad({
            rolesPermitidos: readRoles,
            getComunidadId: (req) => req.comunidadContext?.comunidad_id,
            rehidratarUsuario: true,
            permitirLegacyGlobal: false,
            forbiddenStatus: 404,
            forbiddenMessage: 'Tarefa não encontrada'
          }),
          verificarRolComunidad({
            rolesPermitidos: writeRoles,
            getComunidadId: (req) => req.comunidadContext?.comunidad_id,
            rehidratarUsuario: true,
            permitirLegacyGlobal: false
          }),
          (req, res) => res.json({ ok: true })
        ]
      : createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles);
    const result = await runMiddlewares(
      middlewares,
      { user: { id: 11 }, params, body: {}, query: {} }
    );

    assert.equal(result.response.statusCode, 403);
  }
});

test('admin_basic CRUD propria comunidade', async () => {
  const { models } = createModels({
    users: [{ id: 2, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 2, user_id: 2, comunidad_id: 7, rol_comunidad: 'admin_basic', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  for (const params of [{}, { id: 10 }, { id: 10 }]) {
    const result = await runMiddlewares(
      createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, Boolean(params.id)),
      { user: { id: 2 }, params, body: {}, query: {} }
    );
    assert.equal(result.response.statusCode, 200);
  }
});

test('admin_basic nao acessa task de outra comunidade', async () => {
  const { models } = createModels({
    users: [{ id: 2, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }, { id: 8, activa: true }],
    memberships: [{ id: 2, user_id: 2, comunidad_id: 7, rol_comunidad: 'admin_basic', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 8 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, true),
    { user: { id: 2 }, params: { id: 10 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 404);
});

test('task de outra comunidade em PUT e DELETE retorna 404', async () => {
  const base = {
    users: [{ id: 2, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }],
    communities: [{ id: 7, activa: true }, { id: 8, activa: true }],
    memberships: [{ id: 2, user_id: 2, comunidad_id: 7, rol_comunidad: 'admin_basic', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 8 }]
  };

  for (const method of ['PUT', 'DELETE']) {
    const { models } = createModels(base);
    const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);
    const result = await runMiddlewares([
      resolveTaskContext,
      verificarRolComunidad({
        rolesPermitidos: readRoles,
        getComunidadId: (req) => req.comunidadContext?.comunidad_id,
        rehidratarUsuario: true,
        permitirLegacyGlobal: false,
        forbiddenStatus: 404,
        forbiddenMessage: 'Tarefa não encontrada'
      }),
      verificarRolComunidad({
        rolesPermitidos: writeRoles,
        getComunidadId: (req) => req.comunidadContext?.comunidad_id,
        rehidratarUsuario: true,
        permitirLegacyGlobal: false
      }),
      (req, res) => res.json({ ok: true, method })
    ], { user: { id: 2 }, params: { id: 10 }, body: {}, query: {} });

    assert.equal(result.response.statusCode, 404);
    assert.deepEqual(result.response.body, { message: 'Tarefa não encontrada' });
  }
});

test('owner tem CRUD por owner_user_id sem depender de req.user.rol legacy', async () => {
  const { models } = createModels({
    users: [{ id: 3, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 9, owner_user_id: 3, activa: true }],
    tasks: [{ id: 10, comunidad_id: 9 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  for (const params of [{}, { id: 10 }, { id: 10 }]) {
    const result = await runMiddlewares(
      createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, Boolean(params.id)),
      { user: { id: 3, rol: 'admin_total', comunidad_id: 1 }, params, body: {}, query: {} }
    );
    assert.equal(result.response.statusCode, 200);
  }
});

test('admin_total local tem CRUD por membership', async () => {
  const { models } = createModels({
    users: [{ id: 4, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 7, activa: true }],
    memberships: [{ id: 4, user_id: 4, comunidad_id: 7, rol_comunidad: 'admin_total', estado: 'activo', es_principal: true }],
    tasks: [{ id: 10, comunidad_id: 7 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  for (const params of [{}, { id: 10 }, { id: 10 }]) {
    const result = await runMiddlewares(
      createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, Boolean(params.id)),
      { user: { id: 4 }, params, body: {}, query: {} }
    );
    assert.equal(result.response.statusCode, 200);
  }
});

test('admin_total global canonico por rol_global recebe permissao', async () => {
  const { models } = createModels({
    users: [{ id: 5, rol: 'miembro', rol_global: 'admin_total', comunidad_id: null }],
    tasks: [{ id: 10, comunidad_id: 8 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, true),
    { user: { id: 5, rol: 'miembro' }, params: { id: 10 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 200);
});

test('rol legacy admin_total com rol_global membro nao escala global', async () => {
  const { models } = createModels({
    users: [{ id: 6, rol: 'admin_total', rol_global: 'miembro', comunidad_id: null }],
    tasks: [{ id: 10, comunidad_id: 8 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, true),
    { user: { id: 6, rol: 'admin_total' }, params: { id: 10 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { message: 'Tarefa não encontrada' });
});

test('uma principal resolve contexto, duas principais retornam 403', async () => {
  const ok = createModels({
    users: [{ id: 7, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 1, activa: true }, { id: 2, activa: true }],
    memberships: [{ id: 1, user_id: 7, comunidad_id: 1, rol_comunidad: 'miembro', estado: 'activo', es_principal: true }]
  });
  let loaded = loadWithModels(ok.models);
  let result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, readRoles),
    { user: { id: 7 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.comunidad_id, 1);

  const ambiguous = createModels({
    users: [{ id: 7, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 1, activa: true }, { id: 2, activa: true }],
    memberships: [
      { id: 1, user_id: 7, comunidad_id: 1, rol_comunidad: 'miembro', estado: 'activo', es_principal: true },
      { id: 2, user_id: 7, comunidad_id: 2, rol_comunidad: 'miembro', estado: 'activo', es_principal: true }
    ]
  });
  loaded = loadWithModels(ambiguous.models);
  result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, readRoles),
    { user: { id: 7 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { message: 'Contexto de comunidade não definido para Agenda' });
});

test('uma membership sem principal resolve, duas sem principal retornam 403', async () => {
  const ok = createModels({
    users: [{ id: 8, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 1, activa: true }],
    memberships: [{ id: 1, user_id: 8, comunidad_id: 1, rol_comunidad: 'miembro', estado: 'activo', es_principal: false }]
  });
  let loaded = loadWithModels(ok.models);
  let result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, readRoles),
    { user: { id: 8 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 200);

  const ambiguous = createModels({
    users: [{ id: 8, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 1, activa: true }, { id: 2, activa: true }],
    memberships: [
      { id: 1, user_id: 8, comunidad_id: 1, rol_comunidad: 'miembro', estado: 'activo', es_principal: false },
      { id: 2, user_id: 8, comunidad_id: 2, rol_comunidad: 'miembro', estado: 'activo', es_principal: false }
    ]
  });
  loaded = loadWithModels(ambiguous.models);
  result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, readRoles),
    { user: { id: 8 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 403);
});

test('uma comunidade owned resolve, multiplas owned retornam 403', async () => {
  const ok = createModels({
    users: [{ id: 9, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [{ id: 1, owner_user_id: 9, activa: true }]
  });
  let loaded = loadWithModels(ok.models);
  let result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, writeRoles),
    { user: { id: 9 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 200);

  const ambiguous = createModels({
    users: [{ id: 9, rol: 'miembro', rol_global: 'miembro', comunidad_id: null }],
    communities: [
      { id: 1, owner_user_id: 9, activa: true },
      { id: 2, owner_user_id: 9, activa: true }
    ]
  });
  loaded = loadWithModels(ambiguous.models);
  result = await runMiddlewares(
    createAgendaMiddlewares(loaded.verificarRolComunidad, loaded.resolveTaskContext, writeRoles),
    { user: { id: 9 }, params: {}, body: {}, query: {} }
  );
  assert.equal(result.response.statusCode, 403);
});

test('JWT stale nao prevalece sobre User RDS', async () => {
  const { models } = createModels({
    users: [{ id: 10, rol: 'miembro', rol_global: 'miembro', comunidad_id: 8 }],
    communities: [{ id: 8, activa: true }],
    tasks: [{ id: 30, comunidad_id: 7 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, writeRoles, true),
    { user: { id: 10, rol: 'admin_total', comunidad_id: 7 }, params: { id: 30 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 404);
});

test('task inexistente retorna 404', async () => {
  const { models } = createModels({
    users: [{ id: 1, rol: 'miembro', rol_global: 'miembro', comunidad_id: 7 }]
  });
  const { verificarRolComunidad, resolveTaskContext } = loadWithModels(models);

  const result = await runMiddlewares(
    createAgendaMiddlewares(verificarRolComunidad, resolveTaskContext, readRoles, true),
    { user: { id: 1 }, params: { id: 999 }, body: {}, query: {} }
  );

  assert.equal(result.response.statusCode, 404);
  assert.deepEqual(result.response.body, { message: 'Tarefa não encontrada' });
});

test('controller ignora id created_by comunidad_id e creator vindos do body', async () => {
  const { calls, models } = createModels();
  const { tasksController } = loadWithModels(models);
  const { response, res } = createResponse();

  await tasksController.createTask({
    user: { id: 44 },
    comunidadAuth: { comunidad_id: 7 },
    body: {
      id: 99,
      title: '  Tarefa  ',
      description: null,
      frequency: 'semanal',
      dueDate: '2026-09-08',
      status: 'pendiente',
      priority: 'media',
      created_by: 99,
      comunidad_id: 99,
      creator: { id: 99 }
    }
  }, res);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls.find(([name]) => name === 'Task.create')[1], {
    title: 'Tarefa',
    description: null,
    frequency: 'semanal',
    due_date: '2026-09-08',
    status: 'pendiente',
    priority: 'media',
    created_by: 44,
    comunidad_id: 7
  });
});

test('validacoes rejeitam title, datas, description, frequency, status e priority invalidos', async () => {
  const { models } = createModels();
  const { tasksController } = loadWithModels(models);
  assert.equal(tasksController.normalizeDateOnly('2026-09-08'), '2026-09-08');

  const invalidCases = [
    [{ title: '   ', description: null, frequency: 'semanal', dueDate: '2026-09-08' }, 'Título inválido'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-02-30' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-13-01' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-00-10' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-12-32' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-99-99' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-1-1' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: 'abcd' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: 'abcd-01-01' }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: null }, 'Data de vencimento inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: undefined }, 'Data de vencimento inválida'],
    [{ title: 'A', description: {}, frequency: 'semanal', dueDate: '2026-09-08' }, 'Descrição inválida'],
    [{ title: 'A', description: [], frequency: 'semanal', dueDate: '2026-09-08' }, 'Descrição inválida'],
    [{ title: 'A', description: 123, frequency: 'semanal', dueDate: '2026-09-08' }, 'Descrição inválida'],
    [{ title: 'A', description: null, frequency: 'diaria', dueDate: '2026-09-08' }, 'Frequência inválida'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-09-08', status: 'x' }, 'Status inválido'],
    [{ title: 'A', description: null, frequency: 'semanal', dueDate: '2026-09-08', priority: 'x' }, 'Prioridade inválida']
  ];

  for (const [body, message] of invalidCases) {
    const { response, res } = createResponse();
    await tasksController.createTask({
      user: { id: 44 },
      comunidadAuth: { comunidad_id: 7 },
      body
    }, res);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { message });
  }
});

test('query frequencia invalida retorna 400 sem chamar Sequelize', async () => {
  const { calls, models } = createModels();
  const { tasksController } = loadWithModels(models);
  const { response, res } = createResponse();

  await tasksController.getAllTasks({
    query: { frecuencia: 'diaria' },
    comunidadAuth: { comunidad_id: 7 }
  }, res);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'Frequência inválida' });
  assert.equal(calls.some(([name]) => name === 'Task.findAll'), false);
});

test('PUT parcial conserva campos nao enviados', async () => {
  const original = {
    id: 11,
    title: 'Original',
    description: 'Texto',
    frequency: 'semanal',
    due_date: '2026-09-08',
    status: 'pendiente',
    priority: 'media',
    comunidad_id: 7
  };
  const { models } = createModels({ tasks: [original] });
  const { tasksController } = loadWithModels(models);
  const { response, res } = createResponse();

  await tasksController.updateTask({
    params: { id: 11 },
    comunidadAuth: { comunidad_id: 7 },
    body: { status: 'completada' }
  }, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'completada');
  assert.equal(response.body.title, 'Original');
  assert.equal(response.body.description, 'Texto');
  assert.equal(response.body.frequency, 'semanal');
  assert.equal(response.body.due_date, '2026-09-08');
  assert.equal(response.body.priority, 'media');
});

test('include creator preserva id email username', async () => {
  const { calls, models } = createModels();
  const { tasksController } = loadWithModels(models);
  const { response, res } = createResponse();

  await tasksController.getAllTasks({
    query: {},
    comunidadAuth: { comunidad_id: 7 }
  }, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls.find(([name]) => name === 'Task.findAll')[1].include.attributes, ['id', 'email', 'username']);
});

test('router mantiene orden verificarToken resolveTaskContext verificarRolComunidad controller', () => {
  const { models } = createModels();
  const { taskRoutes } = loadWithModels(models);
  const route = taskRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);
  const names = route.route.stack.map((layer) => layer.handle.name);

  assert.equal(names[0], 'verificarToken');
  assert.equal(names[1], 'resolveTaskContext');
  assert.equal(names[2], '');
  assert.equal(names[3], 'getAllTasks');
});

test('defaults historicos permitem legacy global quando nao se especificam opcoes novas', async () => {
  const { models } = createModels({
    users: [{ id: 20, rol: 'admin_total', rol_global: 'miembro', comunidad_id: null }]
  });
  const { verificarRolComunidad } = loadWithModels(models);
  const middleware = verificarRolComunidad({
    rolesPermitidos: ['admin_total'],
    getComunidadId: () => 123
  });

  const result = await runMiddlewares([
    middleware,
    (req, res) => res.json({ ok: true, source: req.comunidadAuth.source })
  ], { user: { id: 20, rol: 'admin_total' }, params: {}, body: {}, query: {} });

  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.source, 'admin_total_context');
});
