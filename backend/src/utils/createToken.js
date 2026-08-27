// backend/utils/createToken.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function createToken(userPayload, expiresIn = '120m') {
  // userPayload: objeto plano con id, email, rol, username, googleId, comunidad_id
  return jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn });
}

const createAccessToken = (userPayload) => createToken({
  ...userPayload,
  token_use: 'access'
}, '15m');

module.exports = createToken;
module.exports.createAccessToken = createAccessToken;
