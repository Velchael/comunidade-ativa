const test = require('node:test');
const assert = require('node:assert/strict');

const routesPath = require.resolve('../src/routes/authRoutes');
const controllerPath = require.resolve('../src/controllers/authController');
const originPath = require.resolve('../src/middleware/authOrigin');
const middlewarePath = require.resolve('../src/middleware/authMiddleware');
const passportPath = require.resolve('passport');

const handler = (name) => Object.defineProperty((_req, _res, next) => next?.(), 'name', { value: name });
const mock = (path, exports) => { require.cache[path] = { id: path, filename: path, loaded: true, exports }; };

test('authRoutes registra backend dual y preserva GET refresh legacy', () => {
  delete require.cache[routesPath];
  mock(controllerPath, {
    login: handler('login'), googleCallback: handler('googleCallback'), getMe: handler('getMe'),
    refreshToken: handler('refreshToken'), refreshSession: handler('refreshSession'),
    logoutSession: handler('logoutSession'), migrateLegacySession: handler('migrateLegacySession'),
  });
  mock(originPath, { requireAuthOrigin: handler('requireAuthOrigin') });
  mock(middlewarePath, { verificarToken: handler('verificarToken') });
  mock(passportPath, { authenticate: () => handler('passportAuthenticate') });

  const router = require(routesPath);
  const routes = router.stack.filter(layer => layer.route).map(layer => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
    handlers: layer.route.stack.map(item => item.handle.name),
  }));
  const find = (method, path) => routes.find(route => route.path === path && route.methods.includes(method));

  assert.deepEqual(find('get', '/refresh').handlers, ['refreshToken']);
  assert.deepEqual(find('post', '/refresh').handlers, ['requireAuthOrigin', 'refreshSession']);
  assert.deepEqual(find('post', '/logout').handlers, ['requireAuthOrigin', 'logoutSession']);
  assert.deepEqual(find('post', '/session/migrate').handlers, ['requireAuthOrigin', 'migrateLegacySession']);
});
