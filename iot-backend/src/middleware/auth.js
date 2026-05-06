const { supabase } = require('../config/supabase');
const { ApiError } = require('../utils/errors');
const { verifyToken } = require('../utils/jwt');

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

async function requireJwt(req, _res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) throw new ApiError(401, 'Missing bearer token', 'missing_token');

    const claims = verifyToken(token);
    const { data: device, error } = await supabase
      .from('devices')
      .select('id, device_id, owner, status, name, last_seen, metadata, created_at, updated_at')
      .eq('device_id', claims.deviceId)
      .single();

    if (error || !device) throw new ApiError(401, 'Device no longer exists', 'device_not_found');
    if (device.status !== 'active') throw new ApiError(403, 'Device is not active', 'device_inactive');

    req.auth = { claims, device };
    next();
  } catch (error) {
    next(error.name === 'JsonWebTokenError' ? new ApiError(401, 'Invalid token', 'invalid_token') : error);
  }
}

function requireActor(...allowedActors) {
  return (req, _res, next) => {
    if (!req.auth?.claims?.actor || !allowedActors.includes(req.auth.claims.actor)) {
      next(new ApiError(403, 'This token is not allowed to access this route', 'wrong_token_actor'));
      return;
    }
    next();
  };
}

module.exports = { requireJwt, requireActor };
