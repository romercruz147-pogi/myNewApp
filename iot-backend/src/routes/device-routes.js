const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/device-controller');
const { requireJwt, requireActor } = require('../middleware/auth');

const router = express.Router();

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many authentication attempts. Try again later.', code: 'rate_limited' },
});

router.post('/devices/provision', credentialLimiter, controller.provisionDevice);
router.post('/mobile/device-login', credentialLimiter, controller.loginMobileDevice);
router.post('/devices/auth', credentialLimiter, controller.authenticateEsp32);

router.post('/device/login', credentialLimiter, controller.loginMobileDevice);
router.post('/device/connect', credentialLimiter, controller.authenticateEsp32);

router.post('/devices/heartbeat', requireJwt, requireActor('device'), controller.heartbeat);
router.get('/devices/:deviceId', requireJwt, controller.getDeviceStatus);
router.post('/devices/:deviceId/commands', requireJwt, requireActor('mobile'), controller.queueCommand);

module.exports = router;
