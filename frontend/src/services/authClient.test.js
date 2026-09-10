import axios from 'axios';
import authClient from './authClient';
import { cleanupDevicePushSubscription } from './pushNotifications';

jest.mock('axios', () => {
  let nextInterceptorId = 0;
  const requestHandlers = new Map();
  const responseHandlers = new Map();
  const installRequest = (fulfilled, rejected) => {
    const id = nextInterceptorId += 1;
    requestHandlers.set(id, { fulfilled, rejected });
    return id;
  };
  const installResponse = (fulfilled, rejected) => {
    const id = nextInterceptorId += 1;
    responseHandlers.set(id, { fulfilled, rejected });
    return id;
  };
  const client = {
    defaults: { headers: { common: {} } },
    post: jest.fn(),
    delete: jest.fn(),
    __adapter: jest.fn(),
    __installRequest: installRequest,
    __installResponse: installResponse,
    __ejectRequest: (id) => requestHandlers.delete(id),
    __ejectResponse: (id) => responseHandlers.delete(id),
    __activeInterceptors: () => ({
      request: requestHandlers.size,
      response: responseHandlers.size
    }),
    interceptors: {
      request: {
        use: jest.fn(installRequest),
        eject: jest.fn((id) => requestHandlers.delete(id))
      },
      response: {
        use: jest.fn(installResponse),
        eject: jest.fn((id) => responseHandlers.delete(id))
      }
    }
  };

  client.__requestImplementation = async (initialConfig) => {
    let config = initialConfig;
    for (const handler of requestHandlers.values()) config = await handler.fulfilled(config);
    try {
      let response = await client.__adapter(config);
      for (const handler of responseHandlers.values()) {
        if (typeof handler.fulfilled === 'function') response = await handler.fulfilled(response);
      }
      return response;
    } catch (error) {
      error.config = error.config || config;
      const activeHandlers = [...responseHandlers.values()];
      const handler = activeHandlers[activeHandlers.length - 1];
      if (typeof handler?.rejected === 'function') return handler.rejected(error);
      throw error;
    }
  };
  client.request = jest.fn(client.__requestImplementation);

  return { __esModule: true, default: client };
});

jest.mock('./pushNotifications', () => ({
  cleanupDevicePushSubscription: jest.fn(() => Promise.resolve({
    status: 'default',
    backendDeleted: true,
    unsubscribed: true
  }))
}));

const USER = { id: 7, email: 'lab@example.test', rol_global: 'miembro' };
const authResponse = (token = 'access-1', expiresIn = 900) => ({
  data: { access_token: token, expires_in: expiresIn, user: USER }
});
const apiError = (status, code) => Object.assign(new Error(code || `HTTP_${status}`), {
  response: { status, data: { error: { code } } }
});

const handlers = () => {
  const state = { status: null, user: null, pending: false };
  authClient.setAuthHandlers({
    onHydrating: () => { state.status = 'hydrating'; },
    onAuthenticated: ({ user }) => { state.status = 'authenticated'; state.user = user; },
    onUnauthenticated: ({ logoutPending = false } = {}) => {
      state.status = 'unauthenticated'; state.user = null; state.pending = logoutPending;
    },
    onTemporarilyUnavailable: () => { state.status = 'temporarilyUnavailable'; state.user = null; },
    onLogoutPending: () => { state.pending = true; }
  });
  return state;
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  authClient.__resetForTests();
  axios.post.mockReset();
  axios.delete.mockReset();
  cleanupDevicePushSubscription.mockResolvedValue({
    status: 'default',
    backendDeleted: true,
    unsubscribed: true
  });
  axios.request.mockReset().mockImplementation(axios.__requestImplementation);
  axios.__adapter.mockReset();
  axios.interceptors.request.use.mockImplementation(axios.__installRequest);
  axios.interceptors.request.eject.mockImplementation(axios.__ejectRequest);
  axios.interceptors.response.use.mockImplementation(axios.__installResponse);
  axios.interceptors.response.eject.mockImplementation(axios.__ejectResponse);
});

test('bootstrap con cookie válida autentica con respuesta autoritativa', async () => {
  const state = handlers();
  axios.post.mockResolvedValueOnce(authResponse());
  await authClient.bootstrap();
  expect(state).toMatchObject({ status: 'authenticated', user: USER });
  expect(authClient.getAccessToken()).toBe('access-1');
});

test('bootstrap sin cookie migra token legacy y lo elimina solo tras 200', async () => {
  const state = handlers();
  localStorage.setItem('token', 'legacy');
  axios.post
    .mockRejectedValueOnce(apiError(401, 'AUTH_REFRESH_MISSING'))
    .mockResolvedValueOnce(authResponse('migrated'));
  await authClient.bootstrap();
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(state.status).toBe('authenticated');
  expect(localStorage.getItem('token')).toBeNull();
});

test('bootstrap sin cookie ni token legacy queda unauthenticated', async () => {
  const state = handlers();
  axios.post.mockRejectedValueOnce(apiError(401, 'AUTH_REFRESH_MISSING'));
  await expect(authClient.bootstrap()).resolves.toBeNull();
  expect(state.status).toBe('unauthenticated');
});

test.each([
  ['503', apiError(503, 'AUTH_REFRESH_UNAVAILABLE')],
  ['offline', new Error('Network Error')]
])('bootstrap %s queda temporarilyUnavailable', async (_label, error) => {
  const state = handlers();
  axios.post.mockRejectedValueOnce(error);
  await expect(authClient.bootstrap()).rejects.toBe(error);
  expect(state.status).toBe('temporarilyUnavailable');
});

test('refresh 503 con legacy presente no intenta migrate y conserva legacy', async () => {
  const state = handlers();
  localStorage.setItem('token', 'recoverable-legacy');
  axios.post.mockRejectedValueOnce(apiError(503, 'AUTH_REFRESH_UNAVAILABLE'));

  await expect(authClient.bootstrap()).rejects.toBeTruthy();

  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toContain('/auth/refresh');
  expect(localStorage.getItem('token')).toBe('recoverable-legacy');
  expect(state.status).toBe('temporarilyUnavailable');
});

test('migrate definitivo borra legacy; 503 lo conserva y localStorage.user nunca autentica', async () => {
  const state = handlers();
  localStorage.setItem('user', JSON.stringify(USER));
  localStorage.setItem('token', 'invalid');
  axios.post.mockRejectedValueOnce(apiError(401, 'AUTH_LEGACY_INVALID'));
  await expect(authClient.migrateLegacy()).rejects.toBeTruthy();
  expect(localStorage.getItem('token')).toBeNull();
  expect(state.status).toBe('unauthenticated');

  localStorage.setItem('token', 'recoverable');
  axios.post.mockRejectedValueOnce(apiError(503, 'AUTH_MIGRATION_UNAVAILABLE'));
  await expect(authClient.migrateLegacy()).rejects.toBeTruthy();
  expect(localStorage.getItem('token')).toBe('recoverable');
  expect(state.status).toBe('temporarilyUnavailable');
});

test('migrate 503 conserva legacy y pendingInvitationPath', async () => {
  const state = handlers();
  localStorage.setItem('token', 'recoverable');
  sessionStorage.setItem('comuva.pendingInvitationPath', '/convite/lab-token');
  axios.post.mockRejectedValueOnce(apiError(503, 'AUTH_MIGRATION_UNAVAILABLE'));

  await expect(authClient.migrateLegacy()).rejects.toBeTruthy();

  expect(localStorage.getItem('token')).toBe('recoverable');
  expect(sessionStorage.getItem('comuva.pendingInvitationPath')).toBe('/convite/lab-token');
  expect(state.status).toBe('temporarilyUnavailable');
});

test('migrate 200 elimina legacy solamente después de aplicar el éxito', async () => {
  handlers();
  localStorage.setItem('token', 'legacy-until-success');
  let release;
  axios.post.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));

  const migration = authClient.migrateLegacy();
  expect(localStorage.getItem('token')).toBe('legacy-until-success');
  release(authResponse('migrated-success'));
  await migration;

  expect(authClient.getAccessToken()).toBe('migrated-success');
  expect(localStorage.getItem('token')).toBeNull();
});

test('dos migrates concurrentes del mismo legacy comparten exactamente una Promise y un POST', async () => {
  const onAuthenticated = jest.fn();
  authClient.setAuthHandlers({ onAuthenticated });
  localStorage.setItem('token', 'same-legacy');
  let releaseMigration;
  axios.post.mockReturnValueOnce(new Promise((resolve) => { releaseMigration = resolve; }));

  const first = authClient.migrateLegacy('same-legacy');
  const second = authClient.migrateLegacy('same-legacy');

  expect(second).toBe(first);
  expect(axios.post).toHaveBeenCalledTimes(1);
  releaseMigration(authResponse('single-flight-access'));
  await expect(Promise.all([first, second])).resolves.toEqual([USER, USER]);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBeNull();
});

test('Seinscrever y bootstrap convergen en el mismo migrate después del refresh 401', async () => {
  const state = handlers();
  let rejectRefresh;
  let releaseMigration;
  axios.post
    .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRefresh = reject; }))
    .mockReturnValueOnce(new Promise((resolve) => { releaseMigration = resolve; }));

  const bootstrapping = authClient.bootstrap();
  const fromSeinscrever = authClient.setLegacyTokenAndMigrate('callback-legacy');
  rejectRefresh(apiError(401, 'AUTH_REFRESH_MISSING'));
  for (let index = 0; index < 10; index += 1) await Promise.resolve();

  const migrateCalls = axios.post.mock.calls.filter(([url]) => url.includes('/session/migrate'));
  expect(migrateCalls).toHaveLength(1);
  releaseMigration(authResponse('shared-access'));
  await expect(Promise.all([bootstrapping, fromSeinscrever])).resolves.toEqual([USER, USER]);
  expect(state.status).toBe('authenticated');
  expect(localStorage.getItem('token')).toBeNull();
});

test('migrate temporal concurrente libera single-flight y permite un POST futuro', async () => {
  const state = handlers();
  localStorage.setItem('token', 'retryable-legacy');
  let rejectMigration;
  axios.post.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectMigration = reject; }));

  const first = authClient.migrateLegacy('retryable-legacy');
  const second = authClient.migrateLegacy('retryable-legacy');
  const temporaryError = apiError(503, 'AUTH_MIGRATION_UNAVAILABLE');
  rejectMigration(temporaryError);

  await expect(first).rejects.toBe(temporaryError);
  await expect(second).rejects.toBe(temporaryError);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBe('retryable-legacy');
  expect(state.status).toBe('temporarilyUnavailable');

  axios.post.mockResolvedValueOnce(authResponse('retry-success'));
  await expect(authClient.migrateLegacy('retryable-legacy')).resolves.toEqual(USER);
  expect(axios.post).toHaveBeenCalledTimes(2);
});

test('un legacy distinto no comparte resultado ni es eliminado por el migrate activo', async () => {
  handlers();
  let releaseFirst;
  axios.post.mockReturnValueOnce(new Promise((resolve) => { releaseFirst = resolve; }));

  const first = authClient.setLegacyTokenAndMigrate('legacy-a');
  const conflicting = authClient.setLegacyTokenAndMigrate('legacy-b');

  await expect(conflicting).rejects.toMatchObject({ code: 'AUTH_LEGACY_MIGRATE_CONFLICT' });
  expect(axios.post).toHaveBeenCalledTimes(1);
  releaseFirst(authResponse('access-a'));
  await expect(first).resolves.toEqual(USER);
  expect(localStorage.getItem('token')).toBe('legacy-b');

  axios.post.mockResolvedValueOnce(authResponse('access-b'));
  await expect(authClient.migrateLegacy('legacy-b')).resolves.toEqual(USER);
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('token')).toBeNull();
});

test('access token existe solo en memoria, reset simula reload y refresh lo repone', async () => {
  handlers();
  localStorage.setItem('token', 'legacy');
  axios.post.mockResolvedValueOnce(authResponse('memory-only'));
  await authClient.migrateLegacy();
  expect(authClient.getAccessToken()).toBe('memory-only');
  expect(localStorage.getItem('token')).toBeNull();
  expect(Object.values(localStorage)).not.toContain('memory-only');

  authClient.__resetForTests();
  expect(authClient.getAccessToken()).toBeNull();
  axios.post.mockResolvedValueOnce(authResponse('after-reload'));
  await authClient.refresh();
  expect(authClient.getAccessToken()).toBe('after-reload');
});

test('requests concurrentes próximas a expirar comparten un solo refresh', async () => {
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('short', 1));
  await authClient.migrateLegacy('legacy');
  axios.post.mockReset();
  let release;
  axios.post.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
  axios.__adapter.mockResolvedValue({ data: 'ok' });

  const requests = [1, 2, 3].map(() => authClient.request({ url: '/protected' }));
  for (let index = 0; index < 10 && axios.post.mock.calls.length === 0; index += 1) {
    await Promise.resolve();
  }
  expect(axios.post).toHaveBeenCalledTimes(1);
  release(authResponse('fresh'));
  await expect(Promise.all(requests)).resolves.toHaveLength(3);
});

test('AUTH_REFRESH_RACE espera y reintenta refresh exactamente una vez', async () => {
  handlers();
  axios.post
    .mockRejectedValueOnce(apiError(409, 'AUTH_REFRESH_RACE'))
    .mockResolvedValueOnce(authResponse('race-winner'));
  await authClient.refresh();
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(authClient.getAccessToken()).toBe('race-winner');
});

test('AUTH_REFRESH_RACE no emite segundo refresh si cambia authEpoch durante la espera', async () => {
  jest.useFakeTimers();
  try {
    const state = handlers();
    axios.post
      .mockRejectedValueOnce(apiError(409, 'AUTH_REFRESH_RACE'))
      .mockResolvedValueOnce(authResponse('migrated-during-wait'));

    const racingRefresh = authClient.refresh();
    for (let index = 0; index < 10 && axios.post.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
    await expect(authClient.setLegacyTokenAndMigrate('new-session')).resolves.toEqual(USER);
    expect(axios.post).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(200);
    await expect(racingRefresh).rejects.toMatchObject({ code: 'AUTH_OPERATION_STALE' });
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(authClient.getAccessToken()).toBe('migrated-during-wait');
    expect(state.status).toBe('authenticated');
  } finally {
    jest.useRealTimers();
  }
});

test('segundo race y 503 dejan estado temporal sin retries adicionales', async () => {
  const state = handlers();
  axios.post
    .mockRejectedValueOnce(apiError(409, 'AUTH_REFRESH_RACE'))
    .mockRejectedValueOnce(apiError(409, 'AUTH_REFRESH_RACE'));
  await expect(authClient.refresh()).rejects.toBeTruthy();
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(state.status).toBe('temporarilyUnavailable');

  axios.post.mockReset();
  axios.post.mockRejectedValueOnce(apiError(503, 'AUTH_REFRESH_UNAVAILABLE'));
  await expect(authClient.refresh()).rejects.toBeTruthy();
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('refresh 200 tardío después de logout queda obsoleto y no autentica', async () => {
  const state = handlers();
  let releaseRefresh;
  axios.post
    .mockReturnValueOnce(new Promise((resolve) => { releaseRefresh = resolve; }))
    .mockResolvedValueOnce({ status: 204 });

  const pendingRefresh = authClient.refresh();
  await authClient.logout();
  releaseRefresh(authResponse('late-refresh'));

  await expect(pendingRefresh).rejects.toMatchObject({ code: 'AUTH_OPERATION_STALE' });
  expect(authClient.getAccessToken()).toBeNull();
  expect(state.status).toBe('unauthenticated');
});

test('migrate 200 tardío después de logout queda obsoleto y no autentica', async () => {
  const state = handlers();
  let releaseMigrate;
  axios.post
    .mockReturnValueOnce(new Promise((resolve) => { releaseMigrate = resolve; }))
    .mockResolvedValueOnce({ status: 204 });

  const pendingMigrate = authClient.setLegacyTokenAndMigrate('late-legacy');
  await authClient.logout();
  releaseMigrate(authResponse('late-migrate'));

  await expect(pendingMigrate).rejects.toMatchObject({ code: 'AUTH_OPERATION_STALE' });
  expect(authClient.getAccessToken()).toBeNull();
  expect(state.status).toBe('unauthenticated');
});

test('refresh antiguo 401 no sobrescribe una nueva sesión establecida por migrate', async () => {
  const state = handlers();
  let rejectRefresh;
  axios.post
    .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRefresh = reject; }))
    .mockResolvedValueOnce(authResponse('migrated-access'));

  const oldRefresh = authClient.refresh();
  await expect(authClient.setLegacyTokenAndMigrate('new-legacy')).resolves.toEqual(USER);
  rejectRefresh(apiError(401, 'AUTH_REFRESH_MISSING'));

  await expect(oldRefresh).rejects.toMatchObject({ code: 'AUTH_OPERATION_STALE' });
  expect(authClient.getAccessToken()).toBe('migrated-access');
  expect(state.status).toBe('authenticated');
});

test('bootstrap antiguo queda stale tras migrate de Seinscrever sin destruir autenticación', async () => {
  const state = handlers();
  let rejectRefresh;
  axios.post
    .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectRefresh = reject; }))
    .mockResolvedValueOnce(authResponse('seinscrever-access'));

  const bootstrapping = authClient.bootstrap();
  await expect(authClient.setLegacyTokenAndMigrate('seinscrever-legacy')).resolves.toEqual(USER);
  rejectRefresh(apiError(401, 'AUTH_REFRESH_MISSING'));

  await expect(bootstrapping).rejects.toMatchObject({ code: 'AUTH_OPERATION_STALE' });
  expect(authClient.getAccessToken()).toBe('seinscrever-access');
  expect(state.status).toBe('authenticated');
});

test('refresh 401 definitivo sin autenticación posterior queda unauthenticated', async () => {
  const state = handlers();
  axios.post.mockRejectedValueOnce(apiError(401, 'AUTH_SESSION_REVOKED'));

  await expect(authClient.refresh()).rejects.toBeTruthy();

  expect(authClient.getAccessToken()).toBeNull();
  expect(state.status).toBe('unauthenticated');
});

test('401 expired refresca y reintenta request una vez', async () => {
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('old'));
  await authClient.migrateLegacy('legacy');
  axios.post.mockReset();
  axios.post.mockResolvedValueOnce(authResponse('new'));
  axios.__adapter
    .mockRejectedValueOnce(apiError(401, 'AUTH_ACCESS_EXPIRED'))
    .mockResolvedValueOnce({ data: 'ok' });
  await expect(authClient.request({ url: '/protected' })).resolves.toEqual({ data: 'ok' });
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.request).toHaveBeenCalledTimes(2);
});

test.each([
  [401, 'AUTH_ACCESS_INVALID'],
  [401, 'AUTH_ACCESS_MISSING'],
  [403, 'FORBIDDEN'],
  [401, 'BUSINESS_RULE']
])('HTTP %s %s no activa refresh', async (status, code) => {
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('valid'));
  await authClient.migrateLegacy('legacy');
  axios.post.mockReset();
  axios.__adapter.mockRejectedValueOnce(apiError(status, code));
  await expect(authClient.request({ url: '/protected' })).rejects.toBeTruthy();
  expect(axios.post).not.toHaveBeenCalled();
});

test('retry de request está limitado a uno', async () => {
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('valid'));
  await authClient.migrateLegacy('legacy');
  axios.post.mockReset();
  axios.post.mockResolvedValueOnce(authResponse('new'));
  axios.__adapter.mockRejectedValue(apiError(401, 'AUTH_ACCESS_EXPIRED'));
  await expect(authClient.request({ url: '/protected' })).rejects.toBeTruthy();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.request).toHaveBeenCalledTimes(2);
});

test('request protegida nueva queda bloqueada localmente durante logoutPending', async () => {
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('valid'));
  await authClient.migrateLegacy('legacy');
  axios.post.mockReset();
  let releaseLogout;
  axios.post.mockReturnValueOnce(new Promise((resolve) => { releaseLogout = resolve; }));

  const pendingLogout = authClient.logout();
  await expect(authClient.request({ url: '/api/tasks' })).rejects.toMatchObject({
    code: 'AUTH_LOGOUT_PENDING'
  });
  expect(axios.request).not.toHaveBeenCalled();
  releaseLogout({ status: 204 });
  await pendingLogout;
});

test('401 del endpoint refresh omitido no entra en recursión del interceptor', async () => {
  handlers();
  axios.post.mockRejectedValueOnce(apiError(401, 'AUTH_REFRESH_MISSING'));

  await expect(authClient.refresh()).rejects.toBeTruthy();

  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][2]).toMatchObject({ __skipAuthLifecycle: true });
  expect(axios.request).not.toHaveBeenCalled();
});

test('instalación repetida mantiene una sola pareja de interceptores', () => {
  axios.interceptors.request.eject.mockClear();
  axios.interceptors.response.eject.mockClear();

  authClient.installAuthInterceptors();
  authClient.installAuthInterceptors();

  expect(axios.__activeInterceptors()).toEqual({ request: 1, response: 1 });
  expect(axios.interceptors.request.eject).toHaveBeenCalledTimes(2);
  expect(axios.interceptors.response.eject).toHaveBeenCalledTimes(2);
});

test('logout 204 limpia memoria y legacy sin localStorage.clear', async () => {
  const state = handlers();
  const clearSpy = jest.spyOn(Storage.prototype, 'clear');
  localStorage.setItem('token', 'legacy');
  axios.post.mockResolvedValueOnce({ status: 204 });
  await expect(authClient.logout()).resolves.toBe(true);
  expect(authClient.getAccessToken()).toBeNull();
  expect(axios.defaults.headers.common.Authorization).toBeUndefined();
  expect(localStorage.getItem('token')).toBeNull();
  expect(state).toMatchObject({ status: 'unauthenticated', pending: false });
  expect(clearSpy).not.toHaveBeenCalled();
  clearSpy.mockRestore();
});

test('logout intenta limpiar PushSubscription con access token saliente antes de limpiar memoria', async () => {
  const state = handlers();
  localStorage.setItem('token', 'legacy');
  axios.post.mockResolvedValueOnce(authResponse('logout-token'));
  await authClient.migrateLegacy('legacy');
  axios.post.mockResolvedValueOnce({ status: 204 });

  await expect(authClient.logout()).resolves.toBe(true);

  expect(cleanupDevicePushSubscription).toHaveBeenCalledWith({ token: 'logout-token' });
  expect(authClient.getAccessToken()).toBeNull();
  expect(state).toMatchObject({ status: 'unauthenticated', pending: false });
});

test('logout continúa si cleanup Push falla', async () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  handlers();
  axios.post.mockResolvedValueOnce(authResponse('logout-token'));
  await authClient.migrateLegacy('legacy');
  cleanupDevicePushSubscription.mockRejectedValueOnce(new Error('push cleanup failed'));
  axios.post.mockResolvedValueOnce({ status: 204 });

  await expect(authClient.logout()).resolves.toBe(true);

  expect(cleanupDevicePushSubscription).toHaveBeenCalledWith({ token: 'logout-token' });
  expect(authClient.getAccessToken()).toBeNull();
  expect(warnSpy).toHaveBeenCalledWith('push subscription cleanup failed during logout');
  warnSpy.mockRestore();
});

test('logout sin access token no intenta cleanup Push', async () => {
  handlers();
  axios.post.mockResolvedValueOnce({ status: 204 });

  await expect(authClient.logout()).resolves.toBe(true);

  expect(cleanupDevicePushSubscription).not.toHaveBeenCalled();
});

test('logout 503 mantiene salida local y permite retry remoto', async () => {
  const state = handlers();
  axios.post.mockRejectedValueOnce(apiError(503, 'AUTH_LOGOUT_UNAVAILABLE'));
  await expect(authClient.logout()).resolves.toBe(false);
  expect(authClient.getAccessToken()).toBeNull();
  expect(authClient.isLogoutPending()).toBe(true);
  expect(state).toMatchObject({ status: 'unauthenticated', pending: true });

  axios.post.mockResolvedValueOnce({ status: 204 });
  await expect(authClient.retryPendingLogout()).resolves.toBe(true);
  expect(authClient.isLogoutPending()).toBe(false);
});

test('retry de logout pendiente no deja lifecycle bloqueado permanentemente', async () => {
  const state = handlers();
  axios.post
    .mockRejectedValueOnce(apiError(503, 'AUTH_LOGOUT_UNAVAILABLE'))
    .mockResolvedValueOnce({ status: 204 });

  await expect(authClient.logout()).resolves.toBe(false);
  expect(authClient.isLogoutPending()).toBe(true);

  await expect(authClient.retryPendingLogout()).resolves.toBe(true);
  expect(authClient.isLogoutPending()).toBe(false);
  expect(state).toMatchObject({ status: 'unauthenticated', pending: false });

  axios.post.mockResolvedValueOnce(authResponse('after-retry'));
  await expect(authClient.setLegacyTokenAndMigrate('new-login')).resolves.toEqual(USER);
  expect(state).toMatchObject({ status: 'authenticated', user: USER });
});
