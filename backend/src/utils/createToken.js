// backend/utils/createToken.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function createToken(userPayload, expiresIn = '120m') {
  // userPayload: objeto plano con id, email, rol, username, googleId, comunidad_id
  return jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn });
}

module.exports = createToken;
