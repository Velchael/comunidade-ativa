const crypto = require('crypto');

const TOKEN_BYTES = 32;
const TOKEN_BASE64URL_LENGTH = 43;
const TOKEN_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const normalizeInviteToken = (token) => {
  if (typeof token !== 'string') return null;
  if (token.length !== TOKEN_BASE64URL_LENGTH) return null;
  if (!TOKEN_BASE64URL_PATTERN.test(token)) return null;

  return token;
};

const generateInviteToken = () => {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
};

const hashInviteToken = (token) => {
  const normalized = normalizeInviteToken(token);
  if (!normalized) return null;

  return crypto
    .createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex');
};

module.exports = {
  TOKEN_BYTES,
  TOKEN_BASE64URL_LENGTH,
  normalizeInviteToken,
  generateInviteToken,
  hashInviteToken,
};
