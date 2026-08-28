import axios from 'axios';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3000') + '/api';
const REFRESH_MARGIN_MS = 2 * 60 * 1000;
const REFRESH_RACE_DELAY_MS = 200;
const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;

const DEFINITIVE_REFRESH_CODES = new Set([
  'AUTH_REFRESH_MISSING',
  'AUTH_REFRESH_MALFORMED',
  'AUTH_SESSION_NOT_FOUND',
  'AUTH_SESSION_REVOKED',
  'AUTH_SESSION_EXPIRED',
  'AUTH_REFRESH_REUSED',
  'AUTH_USER_NOT_FOUND'
]);

const DEFINITIVE_LEGACY_CODES = new Set([
  'AUTH_LEGACY_MISSING',
  'AUTH_LEGACY_INVALID',
  'AUTH_LEGACY_TOO_OLD',
  'AUTH_LEGACY_NOT_ALLOWED',
  'AUTH_LEGACY_USER_NOT_FOUND'
]);

let accessToken = null;
let expiresAt = 0;
let refreshInFlight = null;
let migrateInFlight = null;
let handlers = {};
let sessionRecoverable = true;
let logoutPending = false;
let authEpoch = 0;

const AXIOS_INTERCEPTORS_KEY = '__comuvaAuthInterceptorIds';

const errorCode = (error) => error?.response?.data?.error?.code || null;
const errorStatus = (error) => error?.response?.status || null;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const isTemporaryError = (error) => {
  const status = errorStatus(error);
  return !error?.response || [500, 502, 503, 504].includes(status);
};

const notify = (name, payload) => {
  if (typeof handlers[name] === 'function') handlers[name](payload);
};

class AuthClientError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AuthClientError';
    this.code = code;
  }
}

const isOperationCurrent = (operationEpoch) => (
  operationEpoch === authEpoch && !logoutPending
);

const requireCurrentOperation = (operationEpoch) => {
  if (operationEpoch !== authEpoch) throw new AuthClientError('AUTH_OPERATION_STALE');
  if (logoutPending) throw new AuthClientError('AUTH_LOGOUT_PENDING');
};

const requireProtectedAccess = (operationEpoch = authEpoch) => {
  requireCurrentOperation(operationEpoch);
  if (!accessToken) throw new AuthClientError('AUTH_ACCESS_MISSING');
};

const clearMemoryAccess = () => {
  accessToken = null;
  expiresAt = 0;
};

const storeAuthResponse = (
  data = {},
  operationEpoch = authEpoch,
  establishesNewSession = false
) => {
  requireCurrentOperation(operationEpoch);
  if (!data.access_token || !data.user) {
    const error = new Error('AUTH_RESPONSE_INVALID');
    error.code = 'AUTH_RESPONSE_INVALID';
    throw error;
  }

  if (establishesNewSession) authEpoch += 1;

  accessToken = data.access_token;
  const ttlSeconds = Number(data.expires_in) || DEFAULT_ACCESS_TTL_SECONDS;
  expiresAt = Date.now() + (ttlSeconds * 1000);
  sessionRecoverable = true;
  logoutPending = false;
  notify('onAuthenticated', { user: data.user, accessToken, expiresAt });
  return data.user;
};

const markUnauthenticated = () => {
  clearMemoryAccess();
  sessionRecoverable = false;
  notify('onUnauthenticated');
};

const markTemporarilyUnavailable = (error) => {
  clearMemoryAccess();
  sessionRecoverable = true;
  notify('onTemporarilyUnavailable', error);
};

const rawRefresh = () => axios.post(`${API_BASE}/auth/refresh`, null, {
  withCredentials: true,
  __skipAuthLifecycle: true
});

const performRefresh = async (operationEpoch) => {
  let response;
  try {
    response = await rawRefresh();
  } catch (error) {
    if (errorStatus(error) === 409 && errorCode(error) === 'AUTH_REFRESH_RACE') {
      await wait(REFRESH_RACE_DELAY_MS);
      requireCurrentOperation(operationEpoch);
      response = await rawRefresh();
    } else {
      throw error;
    }
  }
  return storeAuthResponse(response.data, operationEpoch);
};

const refresh = () => {
  if (logoutPending) {
    return Promise.reject(new AuthClientError('AUTH_LOGOUT_PENDING'));
  }
  const operationEpoch = authEpoch;
  if (refreshInFlight?.epoch === operationEpoch) return refreshInFlight.promise;

  const inFlight = { epoch: operationEpoch, promise: null };
  refreshInFlight = inFlight;
  inFlight.promise = performRefresh(operationEpoch)
    .catch((error) => {
      if (!isOperationCurrent(operationEpoch)) {
        throw error?.code === 'AUTH_OPERATION_STALE'
          ? error
          : new AuthClientError('AUTH_OPERATION_STALE');
      }
      const code = errorCode(error);
      if (errorStatus(error) === 401 && DEFINITIVE_REFRESH_CODES.has(code)) {
        markUnauthenticated();
      } else {
        markTemporarilyUnavailable(error);
      }
      throw error;
    })
    .finally(() => {
      if (refreshInFlight === inFlight) refreshInFlight = null;
    });

  return inFlight.promise;
};

const performLegacyMigration = async (
  legacyToken,
  operationEpoch,
  getEstablishesNewSession = () => false
) => {
  requireCurrentOperation(operationEpoch);

  try {
    const response = await axios.post(`${API_BASE}/auth/session/migrate`, null, {
      withCredentials: true,
      __skipAuthLifecycle: true,
      headers: { Authorization: `Bearer ${legacyToken}` }
    });
    const user = storeAuthResponse(
      response.data,
      operationEpoch,
      getEstablishesNewSession()
    );
    if (localStorage.getItem('token') === legacyToken) localStorage.removeItem('token');
    return user;
  } catch (error) {
    if (!isOperationCurrent(operationEpoch)) {
      throw error?.code === 'AUTH_OPERATION_STALE'
        ? error
        : new AuthClientError('AUTH_OPERATION_STALE');
    }
    const code = errorCode(error);
    if (errorStatus(error) === 401 && DEFINITIVE_LEGACY_CODES.has(code)) {
      if (localStorage.getItem('token') === legacyToken) localStorage.removeItem('token');
      markUnauthenticated();
    } else {
      markTemporarilyUnavailable(error);
    }
    throw error;
  }
};

const migrateLegacy = (
  legacyToken = localStorage.getItem('token'),
  operationEpoch = authEpoch,
  establishesNewSession = false
) => {
  try {
    requireCurrentOperation(operationEpoch);
  } catch (error) {
    return Promise.reject(error);
  }
  if (!legacyToken) {
    markUnauthenticated();
    return Promise.resolve(null);
  }

  if (migrateInFlight) {
    if (
      migrateInFlight.legacyToken === legacyToken &&
      migrateInFlight.epoch === operationEpoch
    ) {
      migrateInFlight.establishesNewSession ||= establishesNewSession;
      return migrateInFlight.promise;
    }
    return Promise.reject(new AuthClientError('AUTH_LEGACY_MIGRATE_CONFLICT'));
  }

  const inFlight = {
    legacyToken,
    epoch: operationEpoch,
    establishesNewSession,
    promise: null
  };
  migrateInFlight = inFlight;
  inFlight.promise = performLegacyMigration(
    legacyToken,
    operationEpoch,
    () => inFlight.establishesNewSession
  )
    .finally(() => {
      if (migrateInFlight === inFlight) migrateInFlight = null;
    });
  return inFlight.promise;
};

const bootstrap = async () => {
  if (logoutPending) return null;
  const operationEpoch = authEpoch;
  sessionRecoverable = true;
  notify('onHydrating');
  try {
    const user = await refresh();
    requireCurrentOperation(operationEpoch);
    return user;
  } catch (refreshError) {
    requireCurrentOperation(operationEpoch);
    const code = errorCode(refreshError);
    const noUsableCookie = errorStatus(refreshError) === 401 && DEFINITIVE_REFRESH_CODES.has(code);
    if (!noUsableCookie) throw refreshError;

    const legacyToken = localStorage.getItem('token');
    if (!legacyToken) return null;
    return migrateLegacy(legacyToken, operationEpoch);
  }
};

const setLegacyTokenAndMigrate = (legacyToken) => {
  const operationEpoch = authEpoch;
  try {
    requireCurrentOperation(operationEpoch);
  } catch (error) {
    return Promise.reject(error);
  }
  localStorage.setItem('token', legacyToken);
  notify('onHydrating');
  return migrateLegacy(legacyToken, operationEpoch, true);
};

const shouldRefreshBeforeRequest = () => (
  Boolean(accessToken) && expiresAt - Date.now() <= REFRESH_MARGIN_MS
);

const request = async (config = {}) => {
  requireProtectedAccess();
  return axios.request({
    ...config,
    withCredentials: config.withCredentials ?? true,
    __authProtected: true
  });
};

const logout = async () => {
  // TODO(auth-next): desvincular PushSubscription antes del rollout final.
  authEpoch += 1;
  logoutPending = true;
  clearMemoryAccess();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  notify('onUnauthenticated', { logoutPending: true });

  try {
    await axios.post(`${API_BASE}/auth/logout`, null, {
      withCredentials: true,
      __skipAuthLifecycle: true
    });
    logoutPending = false;
    sessionRecoverable = false;
    notify('onUnauthenticated', { logoutPending: false });
    return true;
  } catch (error) {
    notify('onLogoutPending', error);
    return false;
  }
};

const retryPendingLogout = () => logout();

const shouldRefreshOnResume = (authStatus) => {
  if (logoutPending || !sessionRecoverable) return false;
  if (authStatus === 'temporarilyUnavailable') return true;
  if (!accessToken) return true;
  return expiresAt - Date.now() <= REFRESH_MARGIN_MS;
};

const setAuthHandlers = (nextHandlers = {}) => {
  handlers = nextHandlers;
  return () => {
    if (handlers === nextHandlers) handlers = {};
  };
};

const getAccessToken = () => accessToken;
const getExpiresAt = () => expiresAt;
const isLogoutPending = () => logoutPending;

// Test-only reset: module reloads also clear the in-memory credential naturally.
const __resetForTests = () => {
  clearMemoryAccess();
  refreshInFlight = null;
  migrateInFlight = null;
  handlers = {};
  sessionRecoverable = true;
  logoutPending = false;
  authEpoch = 0;
};

const getRequestPath = (config = {}) => {
  try {
    return new URL(config.url || '', window.location.origin).pathname;
  } catch (_) {
    return '';
  }
};

const isPublicRequest = (config = {}) => {
  if (config.__authPublic === true) return true;
  const method = String(config.method || 'get').toLowerCase();
  const path = getRequestPath(config);

  if (method === 'get' && path.startsWith('/api/invitaciones/validar/')) return true;
  if (method === 'get' && /^\/api\/comunidades(?:\/\d+)?\/?$/.test(path)) return true;
  if (method === 'get' && path === '/api/push/vapid-public-key') return true;
  if (method === 'post' && ['/api/auth/login', '/api/users/register', '/api/users/login'].includes(path)) {
    return true;
  }
  return false;
};

const requestInterceptor = async (config) => {
  if (config.__skipAuthLifecycle) return config;
  const isProtected = config.__authProtected === true || !isPublicRequest(config);
  if (!isProtected) {
    config.withCredentials = config.withCredentials ?? true;
    return config;
  }

  const operationEpoch = config.__authEpoch ?? authEpoch;
  config.__authEpoch = operationEpoch;
  requireProtectedAccess(operationEpoch);
  if (shouldRefreshBeforeRequest()) await refresh();
  requireProtectedAccess(operationEpoch);
  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${accessToken}`;
  config.withCredentials = config.withCredentials ?? true;
  return config;
};

const responseErrorInterceptor = async (error) => {
  const config = error?.config;
  if (
    !config ||
    config.__skipAuthLifecycle ||
    config.__authRetry ||
    errorStatus(error) !== 401 ||
    errorCode(error) !== 'AUTH_ACCESS_EXPIRED'
  ) {
    throw error;
  }

  const operationEpoch = config.__authEpoch ?? authEpoch;
  requireProtectedAccess(operationEpoch);
  config.__authRetry = true;
  await refresh();
  requireProtectedAccess(operationEpoch);
  return axios.request(config);
};

const installAuthInterceptors = () => {
  const previous = axios[AXIOS_INTERCEPTORS_KEY];
  if (previous) {
    axios.interceptors.request.eject(previous.requestId);
    axios.interceptors.response.eject(previous.responseId);
  }

  const ids = {
    requestId: axios.interceptors.request.use(requestInterceptor),
    responseId: axios.interceptors.response.use(
      (response) => response,
      responseErrorInterceptor
    )
  };
  axios[AXIOS_INTERCEPTORS_KEY] = ids;
  return ids;
};

installAuthInterceptors();

const authClient = {
  bootstrap,
  refresh,
  migrateLegacy,
  setLegacyTokenAndMigrate,
  request,
  logout,
  retryPendingLogout,
  shouldRefreshOnResume,
  setAuthHandlers,
  getAccessToken,
  getExpiresAt,
  isLogoutPending,
  isTemporaryError,
  installAuthInterceptors,
  __resetForTests
};

export {
  AuthClientError,
  authClient,
  DEFINITIVE_LEGACY_CODES,
  DEFINITIVE_REFRESH_CODES
};
export default authClient;
