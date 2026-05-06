const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signDeviceToken(device, actor) {
  return jwt.sign(
    {
      sub: device.device_id,
      deviceId: device.device_id,
      deviceUuid: device.id,
      actor,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: 'romers-vendo-iot-api', audience: 'romers-vendo-devices' },
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    issuer: 'romers-vendo-iot-api',
    audience: 'romers-vendo-devices',
  });
}

module.exports = { signDeviceToken, verifyToken };
