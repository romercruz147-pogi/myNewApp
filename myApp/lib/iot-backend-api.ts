export type IotBackendDevice = {
  id: string;
  device_id: string;
  owner?: string | null;
  status: 'active' | 'disabled' | 'revoked';
  name?: string | null;
  last_ip?: string | null;
  last_seen?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type IotBackendSession = {
  token: string;
  device: IotBackendDevice;
};

export type TokenStorage = {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
};

const SESSION_KEY_PREFIX = 'iot_device_session:';

const getApiBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_IOT_BACKEND_URL ?? process.env.EXPO_PUBLIC_DEVICE_BACKEND_URL ?? '';
  return url.trim().replace(/\/+$/, '');
};

async function parseJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `IoT backend request failed (${response.status}).`);
  return data;
}

function sessionKey(deviceId: string) {
  return `${SESSION_KEY_PREFIX}${deviceId.trim()}`;
}

export const iotBackendApi = {
  async authenticateDevice(deviceId: string, deviceSecret: string): Promise<IotBackendSession> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) throw new Error('Set EXPO_PUBLIC_IOT_BACKEND_URL before authenticating devices.');

    const response = await fetch(`${baseUrl}/api/mobile/device-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId.trim(), device_secret: deviceSecret.trim() }),
    });
    const data = await parseJsonResponse(response);
    return { token: String(data.token), device: data.device as IotBackendDevice };
  },

  async getDeviceStatus(deviceId: string, token: string): Promise<IotBackendDevice> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) throw new Error('Set EXPO_PUBLIC_IOT_BACKEND_URL before loading device status.');

    const response = await fetch(`${baseUrl}/api/devices/${encodeURIComponent(deviceId.trim())}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJsonResponse(response);
    return data.device as IotBackendDevice;
  },

  async saveSession(storage: TokenStorage, session: IotBackendSession) {
    await storage.setItem(sessionKey(session.device.device_id), JSON.stringify(session));
  },

  async loadSession(storage: TokenStorage, deviceId: string): Promise<IotBackendSession | null> {
    const raw = await storage.getItem(sessionKey(deviceId));
    if (!raw) return null;
    return JSON.parse(raw) as IotBackendSession;
  },

  async clearSession(storage: TokenStorage, deviceId: string) {
    await storage.removeItem(sessionKey(deviceId));
  },
};
