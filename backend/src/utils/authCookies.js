const REFRESH_COOKIE_NAME = 'comuva_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';

class AuthCookieError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AuthCookieError';
    this.code = code;
  }
}

const getCookieSecure = (isLocalHttp) => (
  !(process.env.NODE_ENV === 'development' && isLocalHttp === true)
);

const requireValidDateMs = (value, code) => {
  const milliseconds = value instanceof Date ? value.getTime() : NaN;
  if (!Number.isFinite(milliseconds)) throw new AuthCookieError(code);
  return milliseconds;
};

const buildRefreshCookieOptions = ({ session, now = new Date(), isLocalHttp = false } = {}) => {
  const nowMs = requireValidDateMs(now, 'AUTH_COOKIE_INVALID_NOW');
  const expiresAtMs = requireValidDateMs(session?.expires_at, 'AUTH_COOKIE_INVALID_EXPIRES_AT');
  const absoluteExpiresAtMs = requireValidDateMs(
    session?.absolute_expires_at,
    'AUTH_COOKIE_INVALID_ABSOLUTE_EXPIRES_AT'
  );
  const remainingMs = Math.min(expiresAtMs, absoluteExpiresAtMs) - nowMs;

  return {
    httpOnly: true,
    secure: getCookieSecure(isLocalHttp),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: Math.max(0, remainingMs),
  };
};

const setRefreshCookie = (res, credential, session, options = {}) => {
  const cookieOptions = buildRefreshCookieOptions({ session, ...options });
  res.cookie(REFRESH_COOKIE_NAME, credential, cookieOptions);
  return cookieOptions;
};

const clearRefreshCookie = (res, { isLocalHttp = false } = {}) => {
  const options = {
    httpOnly: true,
    secure: getCookieSecure(isLocalHttp),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
  res.clearCookie(REFRESH_COOKIE_NAME, options);
  return options;
};

module.exports = {
  AuthCookieError,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  buildRefreshCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
};
