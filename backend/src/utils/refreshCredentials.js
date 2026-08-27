const crypto = require('crypto');

const REFRESH_SECRET_BYTES = 32;
const REFRESH_SECRET_LENGTH = 43;
const CREDENTIAL_LENGTH = 80;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const encodeSecret = (secret) => {
  if (!Buffer.isBuffer(secret) || secret.length !== REFRESH_SECRET_BYTES) {
    throw new TypeError('Refresh secret must be a 32-byte Buffer');
  }
  return secret.toString('base64url');
};

const generateRefreshSecret = () => crypto.randomBytes(REFRESH_SECRET_BYTES);

const buildRefreshCredential = (sessionId, secret) => {
  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) {
    throw new TypeError('Session id must be a canonical UUID');
  }
  return `${sessionId}.${encodeSecret(secret)}`;
};

const parseRefreshCredential = (credential) => {
  if (typeof credential !== 'string' || credential.length !== CREDENTIAL_LENGTH) return null;
  const separator = credential.indexOf('.');
  if (separator !== 36 || separator !== credential.lastIndexOf('.')) return null;

  const sessionId = credential.slice(0, separator);
  const encodedSecret = credential.slice(separator + 1);
  if (!UUID_PATTERN.test(sessionId) || !BASE64URL_PATTERN.test(encodedSecret)) return null;

  const secret = Buffer.from(encodedSecret, 'base64url');
  if (secret.length !== REFRESH_SECRET_BYTES || encodeSecret(secret) !== encodedSecret) return null;
  return { sessionId, secret };
};

const hashRefreshSecret = (secret) => {
  if (!Buffer.isBuffer(secret) || secret.length !== REFRESH_SECRET_BYTES) {
    throw new TypeError('Refresh secret must be a 32-byte Buffer');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const safeHashEqual = (left, right) => (
  Buffer.isBuffer(left) &&
  Buffer.isBuffer(right) &&
  left.length === 32 &&
  right.length === 32 &&
  crypto.timingSafeEqual(left, right)
);

module.exports = {
  REFRESH_SECRET_BYTES,
  REFRESH_SECRET_LENGTH,
  generateRefreshSecret,
  encodeSecret,
  buildRefreshCredential,
  parseRefreshCredential,
  hashRefreshSecret,
  safeHashEqual,
};
