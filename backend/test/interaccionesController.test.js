process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createInteraccionesController } = require('../src/controllers/interaccionesController');
const { createInteractionMediaResolver } = require('../src/utils/resolveInteractionMedia');

const IMAGE_KEY = 'production/interactions/10/11111111-2222-4333-8444-555555555555.jpg';
const SIGNED_URL = 'https://signed.example/interactions/10/image.jpg';

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

const createInstance = (state, { updateError } = {}) => ({
  get id() {
    return state.id;
  },
  get comunidad_id() {
    return state.comunidad_id;
  },
  async update(values) {
    if (updateError) throw updateError;
    Object.assign(state, values);
  },
  async destroy() {
    state.destroyed = true;
  },
  toJSON() {
    return {
      ...state,
      usuario: { id: state.user_id, username: 'Maria', foto_perfil: null },
      comunidad: { id: state.comunidad_id, nombre_comunidad: 'Centro' },
      respuestas: []
    };
  }
});

const createHarness = ({
  uploadError,
  updateError,
  uploadKey = IMAGE_KEY
} = {}) => {
  const calls = [];
  const rows = new Map();
  let nextId = 10;
  const logger = { error: (...args) => calls.push(['log:error', ...args]) };
  const Interaccion = {
    create: async (values) => {
      calls.push(['create', values]);
      const state = { id: nextId, ...values, destroyed: false };
      nextId += 1;
      rows.set(state.id, state);
      return createInstance(state, { updateError });
    },
    findByPk: async (id, options) => {
      calls.push(['findByPk', id, options]);
      const state = rows.get(id);
      return state && !state.destroyed ? createInstance(state, { updateError }) : null;
    },
    findAll: async (options) => {
      calls.push(['findAll', options]);
      return [...rows.values()]
        .filter((state) => !state.destroyed)
        .map((state) => createInstance(state, { updateError }));
    }
  };
  const mediaService = {
    uploadInteractionImage: async (params) => {
      calls.push(['uploadInteractionImage', params]);
      if (uploadError) throw uploadError;
      return { key: uploadKey, ETag: '"etag"', Bucket: 'private-bucket' };
    },
    deleteInteractionImage: async (params) => {
      calls.push(['deleteInteractionImage', params]);
    }
  };
  const resolveMedia = createInteractionMediaResolver({
    isManagedKey: ({ key, interactionId }) => (
      key === uploadKey && Number(interactionId) === 10
    ),
    signReadUrl: async ({ key, interactionId }) => {
      calls.push(['signReadUrl', { key, interactionId }]);
      return SIGNED_URL;
    },
    logger
  });
  const controller = createInteraccionesController({
    Interaccion,
    Respuesta: {},
    User: {},
    Comunidad: {},
    resolvePhotos: async (interaction) => interaction,
    resolveMedia,
    mediaService,
    logger
  });
  const req = {
    user: { id: 42, comunidad_id: 7 },
    comunidadAuth: { comunidad_id: 7, rol_comunidad: 'miembro' },
    body: {
      user_id: 999,
      comunidad_id: 7,
      tipo: 'ayuda',
      categoria: 'serviço',
      descripcion: 'Preciso de apoio',
      visibilidad: 'global',
      urgencia: 'alta'
    },
    params: {}
  };

  return { calls, controller, req, rows };
};

const validImage = (extension, contentType) => ({
  buffer: Buffer.from([1, 2, 3]),
  size: 3,
  contentType,
  extension
});

test('cria publicação sem imagem sem usar S3 e responde imagen_url null', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();
  delete harness.req.body.urgencia;

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.some(([name]) => name === 'uploadInteractionImage'), false);
  assert.equal(harness.calls[0][1].user_id, 42);
  assert.equal(harness.calls[0][1].imagen_key, null);
  assert.equal(harness.calls[0][1].urgencia, 'normal');
  assert.equal(response.body.imagen_url, null);
  assert.equal(Object.hasOwn(response.body, 'imagen_key'), false);
});

test('ignora urgencia enviada pelo cliente e persiste normal', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();
  harness.req.body.tipo = 'necesidad';
  harness.req.body.urgencia = 'critica';

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls[0][1].urgencia, 'normal');
  assert.equal([...harness.rows.values()][0].urgencia, 'normal');
});

test('texto com palavras críticas não altera urgência automaticamente', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();
  harness.req.body.tipo = 'necesidad';
  harness.req.body.descripcion = 'Tenho fome, preciso de comida, é uma emergência';

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls[0][1].urgencia, 'normal');
});

test('cria publicação com JPEG válido, salva imagen_key e devolve URL assinada', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();
  harness.req.interactionImage = validImage('jpg', 'image/jpeg');

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.find(([name]) => name === 'uploadInteractionImage')[1].interactionId, 10);
  assert.equal([...harness.rows.values()][0].imagen_key, IMAGE_KEY);
  assert.equal(response.body.imagen_url, SIGNED_URL);
  assert.equal(Object.hasOwn(response.body, 'ETag'), false);
  assert.equal(Object.hasOwn(response.body, 'Bucket'), false);
  assert.equal(Object.hasOwn(response.body, 'imagen_key'), false);
});

test('cria publicação com PNG válido', async () => {
  const harness = createHarness({
    uploadKey: 'production/interactions/10/11111111-2222-4333-8444-555555555555.png'
  });
  const { response, res } = createResponse();
  harness.req.interactionImage = validImage('png', 'image/png');

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.find(([name]) => name === 'uploadInteractionImage')[1].extension, 'png');
});

test('cria publicação com WebP válido', async () => {
  const harness = createHarness({
    uploadKey: 'production/interactions/10/11111111-2222-4333-8444-555555555555.webp'
  });
  const { response, res } = createResponse();
  harness.req.interactionImage = validImage('webp', 'image/webp');

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(harness.calls.find(([name]) => name === 'uploadInteractionImage')[1].extension, 'webp');
});

test('falha S3 compensa a publicação recém-criada', async () => {
  const harness = createHarness({ uploadError: new Error('S3 unavailable') });
  const { response, res } = createResponse();
  harness.req.interactionImage = validImage('jpg', 'image/jpeg');

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 502);
  assert.equal([...harness.rows.values()][0].destroyed, true);
});

test('falha ao salvar imagen_key tenta DeleteObject e compensa publicação', async () => {
  const harness = createHarness({ updateError: new Error('RDS unavailable') });
  const { response, res } = createResponse();
  harness.req.interactionImage = validImage('jpg', 'image/jpeg');

  await harness.controller.crear(harness.req, res);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(
    harness.calls.find(([name]) => name === 'deleteInteractionImage')[1],
    { key: IMAGE_KEY, interactionId: 10 }
  );
  assert.equal([...harness.rows.values()][0].destroyed, true);
});

test('GET/listado transforma imagen_key em imagen_url assinada', async () => {
  const harness = createHarness();
  const state = {
    id: 10,
    user_id: 42,
    comunidad_id: 7,
    tipo: 'ayuda',
    descripcion: 'Com imagem',
    visibilidad: 'global',
    estado: 'abierto',
    urgencia: 'normal',
    imagen_key: IMAGE_KEY,
    imagen_url: null,
    destroyed: false
  };
  harness.rows.set(10, state);
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items[0].imagen_url, SIGNED_URL);
  assert.equal(Object.hasOwn(response.body.items[0], 'imagen_key'), false);
});

test('GET/listado ordena somente por created_at DESC', async () => {
  const harness = createHarness();
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    harness.calls.find(([name]) => name === 'findAll')[1].order,
    [['created_at', 'DESC']]
  );
});

test('publicação antiga com imagen_key null continua com imagen_url null', async () => {
  const harness = createHarness();
  harness.rows.set(10, {
    id: 10,
    user_id: 42,
    comunidad_id: 7,
    tipo: 'ayuda',
    descripcion: 'Sem imagem',
    visibilidad: 'global',
    estado: 'abierto',
    urgencia: 'normal',
    imagen_key: null,
    imagen_url: null,
    destroyed: false
  });
  const { response, res } = createResponse();

  await harness.controller.listar(harness.req, res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items[0].imagen_url, null);
});
