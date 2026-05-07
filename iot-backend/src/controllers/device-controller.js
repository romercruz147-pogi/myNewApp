const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { supabase } = require('../config/supabase');
const { ApiError } = require('../utils/errors');
const { signDeviceToken } = require('../utils/jwt');

function cleanCredential(value) {
  return String(value || '').trim();
}

function publicDevice(device) {
  return {
    id: device.id,
    device_id: device.device_id,
    owner: device.owner,
    status: device.status,
    name: device.name || device.device_name || null,
    last_ip: device.last_ip,
    last_seen: device.last_seen,
    metadata: device.metadata || {},
    created_at: device.created_at,
    updated_at: device.updated_at,
  };
}

async function fetchDeviceByDeviceId(deviceId, includeSecret = false) {
  const fields = includeSecret
    ? 'id, device_id, device_secret_hash, owner, status, name, device_name, last_ip, last_seen, metadata, created_at, updated_at'
    : 'id, device_id, owner, status, name, device_name, last_ip, last_seen, metadata, created_at, updated_at';
  const { data, error } = await supabase.from('devices').select(fields).eq('device_id', deviceId).maybeSingle();
  if (error) throw new ApiError(500, 'Database query failed', 'database_error');
  return data;
}

async function provisionDevice(req, res, next) {
  try {
    if (req.headers['x-provisioning-key'] !== env.provisioningKey) {
      throw new ApiError(401, 'Invalid provisioning key', 'invalid_provisioning_key');
    }

    const deviceId = cleanCredential(req.body.device_id || req.body.deviceId);
    const deviceSecret = cleanCredential(req.body.device_secret || req.body.deviceSecret);
    const owner = req.body.owner || null;
    const name = req.body.name || null;
    const deviceName = req.body.device_name || name || null;

    if (!deviceId || deviceSecret.length < 32) {
      throw new ApiError(400, 'device_id and a device_secret with at least 32 characters are required', 'invalid_credentials');
    }

    const existing = await fetchDeviceByDeviceId(deviceId);
    if (existing) throw new ApiError(409, 'Device ID already exists', 'duplicate_device');

    const deviceSecretHash = await bcrypt.hash(deviceSecret, env.bcryptRounds);
    const { data, error } = await supabase
      .from('devices')
      .insert({ device_id: deviceId, device_secret_hash: deviceSecretHash, owner, name, device_name: deviceName, status: 'active' })
      .select('id, device_id, owner, status, name, device_name, last_ip, last_seen, metadata, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'Device ID already exists', 'duplicate_device');
      throw new ApiError(500, 'Could not create device', 'database_error');
    }

    res.status(201).json({ ok: true, device: publicDevice(data) });
  } catch (error) {
    next(error);
  }
}

async function verifyDeviceCredentials(deviceId, deviceSecret) {
  const device = await fetchDeviceByDeviceId(deviceId, true);
  if (!device) throw new ApiError(401, 'Invalid Device ID or Device Secret', 'invalid_device_credentials');
  if (device.status !== 'active') throw new ApiError(403, 'Device is not active', 'device_inactive');

  const validSecret = await bcrypt.compare(deviceSecret, device.device_secret_hash);
  if (!validSecret) throw new ApiError(401, 'Invalid Device ID or Device Secret', 'invalid_device_credentials');
  return device;
}

async function loginMobileDevice(req, res, next) {
  try {
    const deviceId = cleanCredential(req.body.device_id || req.body.deviceId);
    const deviceSecret = cleanCredential(req.body.device_secret || req.body.deviceSecret);
    if (!deviceId || !deviceSecret) throw new ApiError(400, 'Device ID and Device Secret are required', 'missing_credentials');

    const device = await verifyDeviceCredentials(deviceId, deviceSecret);
    const token = signDeviceToken(device, 'mobile');
    res.json({ success: true, ok: true, token, device: publicDevice(device) });
  } catch (error) {
    next(error);
  }
}

async function authenticateEsp32(req, res, next) {
  try {
    const deviceId = cleanCredential(req.body.device_id || req.body.deviceId || req.headers['x-device-id']);
    const deviceSecret = cleanCredential(req.body.device_secret || req.body.deviceSecret || req.headers['x-device-secret']);
    if (!deviceId || !deviceSecret) throw new ApiError(400, 'Device ID and Device Secret are required', 'missing_credentials');

    const device = await verifyDeviceCredentials(deviceId, deviceSecret);
    const token = signDeviceToken(device, 'device');
    await supabase
      .from('devices')
      .update({ last_ip: req.ip, last_seen: new Date().toISOString() })
      .eq('device_id', device.device_id);

    res.json({ success: true, ok: true, token, device: publicDevice(device) });
  } catch (error) {
    next(error);
  }
}

async function heartbeat(req, res, next) {
  try {
    const payload = req.body || {};
    const transactionId = cleanCredential(payload.transactionId || payload.transaction_id);

    if (transactionId) {
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          device_id: req.auth.device.device_id,
          transaction_id: transactionId,
          credits_added: Number(payload.creditsAdded ?? payload.credits ?? payload.moneyInserted ?? 0),
          pulse_count: Number(payload.pulseCount ?? 0),
          amount: Number(payload.amount ?? payload.moneyInserted ?? payload.creditsAdded ?? 0),
          source: String(payload.source || 'coin'),
          metadata: payload,
        });
      if (txError && txError.code !== '23505') throw new ApiError(500, 'Could not store transaction', 'database_error');
    }
    const metadata = {
      money: payload.money ?? payload.credits ?? 0,
      moneyInserted: payload.moneyInserted ?? payload.money ?? payload.credits ?? 0,
      credits: payload.credits ?? payload.money ?? 0,
      remainingTime: payload.remainingTime ?? 0,
      totalTimeUsed: payload.totalTimeUsed ?? payload.totalTime ?? 0,
      salesToday: payload.salesToday ?? 0,
      totalEarnings: payload.totalEarnings ?? 0,
      isActive: Boolean(payload.isActive),
      wifiConnected: Boolean(payload.wifiConnected),
      wifiSignal: payload.wifiSignal ?? null,
      localIp: payload.ip ?? null,
      connectionStatus: 'Connected',
      pricingSettings: payload.pricingSettings ?? null,
      minCreditsToStart: payload.minCreditsToStart ?? null,
      secondsForMinCredits: payload.secondsForMinCredits ?? null,
    };

    const { data, error } = await supabase
      .from('devices')
      .update({
        last_ip: req.ip,
        last_seen: new Date().toISOString(),
        metadata,
      })
      .eq('device_id', req.auth.device.device_id)
      .select('id, device_id, owner, status, name, device_name, last_ip, last_seen, metadata, created_at, updated_at')
      .single();

    if (error) throw new ApiError(500, 'Could not save heartbeat', 'database_error');

    await supabase.from('timer_logs').insert({
      device_id: req.auth.device.device_id,
      event_type: payload.eventType || 'heartbeat',
      remaining_time: Number(metadata.remainingTime || 0),
      total_time_used: Number(metadata.totalTimeUsed || 0),
      metadata,
    });

    await supabase.from('sales_logs').insert({
      device_id: req.auth.device.device_id,
      sales_today: Number(metadata.salesToday || 0),
      total_earnings: Number(metadata.totalEarnings || 0),
      metadata,
    });

    res.json({ ok: true, device: publicDevice(data) });
  } catch (error) {
    next(error);
  }
}

async function getDeviceStatus(req, res, next) {
  try {
    const requestedDeviceId = req.params.deviceId;
    if (requestedDeviceId !== req.auth.device.device_id) {
      throw new ApiError(403, 'Token cannot access this device', 'device_scope_mismatch');
    }
    res.json({ ok: true, device: publicDevice(req.auth.device) });
  } catch (error) {
    next(error);
  }
}

async function queueCommand(req, res, next) {
  try {
    const requestedDeviceId = req.params.deviceId;
    if (requestedDeviceId !== req.auth.device.device_id) {
      throw new ApiError(403, 'Token cannot access this device', 'device_scope_mismatch');
    }

    const { command, payload = {} } = req.body || {};
    if (!command) throw new ApiError(400, 'command is required', 'missing_command');

    const { error } = await supabase
      .from('device_events')
      .insert({ device_id: requestedDeviceId, event_type: `command:${command}`, payload });

    if (error) throw new ApiError(500, 'Could not queue command', 'database_error');
    res.status(202).json({ ok: true, message: 'Command accepted. Add MQTT/WebSocket polling later for real-time delivery.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  provisionDevice,
  loginMobileDevice,
  authenticateEsp32,
  heartbeat,
  getDeviceStatus,
  queueCommand,
};
