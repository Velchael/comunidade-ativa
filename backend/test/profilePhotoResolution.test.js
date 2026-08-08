process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfilePhotoResolver } = require('../src/utils/resolveProfilePhoto');
const { resolveInteractionPhotos } = require('../src/utils/resolveInteractionPhotos');
const { buildUserProfileResponse } = require('../src/utils/buildUserProfileResponse');
const { buildAuthUserResponse } = require('../src/utils/buildAuthUserResponse');

const KEY = 'production/profiles/users/42/11111111-2222-4333-8444-555555555555.jpg';
const SIGNED_URL = 'https://signed.example/avatar?signature=test';

const resolver = createProfilePhotoResolver({
  isManagedKey: (key) => key === KEY,
  signReadUrl: async (key) => key === KEY ? SIGNED_URL : null
});

const createUser = (fotoPerfil) => ({
  id: 42,
  username: 'Maria',
  apellido: 'Silva',
  email: 'maria@example.com',
  rol: 'miembro',
  rol_global: 'miembro',
  comunidad_id: null,
  comunidad: null,
  foto_perfil: fotoPerfil
});

test('URL HTTPS existente passa sem alteração e não chama presigner', async () => {
  let signCalls = 0;
  const googleUrl = 'https://lh3.googleusercontent.com/avatar.jpg';
  const googleResolver = createProfilePhotoResolver({
    isManagedKey: () => false,
    signReadUrl: async () => { signCalls += 1; }
  });

  assert.equal(await googleResolver(googleUrl), googleUrl);
  assert.equal(signCalls, 0);
});

test('referência nula ou vazia resolve para null', async () => {
  assert.equal(await resolver(null), null);
  assert.equal(await resolver(''), null);
  assert.equal(await resolver('   '), null);
});

test('key COMUVA válida gera URL assinada', async () => {
  assert.equal(await resolver(KEY), SIGNED_URL);
});

test('key de outro prefixo não é assinada', async () => {
  let signCalls = 0;
  const safeResolver = createProfilePhotoResolver({
    isManagedKey: () => false,
    signReadUrl: async () => { signCalls += 1; }
  });

  assert.equal(await safeResolver(`staging/${KEY}`), null);
  assert.equal(signCalls, 0);
});

test('buildUserProfileResponse devolve foto resolvida', async () => {
  const response = await buildUserProfileResponse(createUser(KEY), {
    photoResolver: resolver
  });

  assert.equal(response.foto_perfil, SIGNED_URL);
});

test('buildAuthUserResponse mantém compatibilidade e inclui foto resolvida', async () => {
  const response = await buildAuthUserResponse(createUser(KEY), {
    photoResolver: resolver
  });

  assert.equal(response.id, 42);
  assert.equal(response.username, 'Maria');
  assert.equal(response.rol_global, 'miembro');
  assert.equal(response.foto_perfil, SIGNED_URL);
});

test('Interação e Resposta recebem avatar resolvido pelo mesmo helper', async () => {
  const interaction = await resolveInteractionPhotos({
    id: 10,
    usuario: { id: 42, username: 'Maria', foto_perfil: KEY },
    respuestas: [{
      id: 20,
      usuario: { id: 42, username: 'Maria', foto_perfil: KEY }
    }]
  }, resolver);

  assert.equal(interaction.usuario.foto_perfil, SIGNED_URL);
  assert.equal(interaction.respuestas[0].usuario.foto_perfil, SIGNED_URL);
});
