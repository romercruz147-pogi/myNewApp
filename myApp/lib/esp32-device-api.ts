import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Esp32DeviceStatus = {
  deviceId?: string;
  deviceToken?: string;
  money?: number;
  moneyInserted?: number;
  credits?: number;
  remainingTime?: number;
  totalTime?: number;
  totalTimeUsed?: number;
  isActive?: boolean;
  salesToday?: number;
  totalEarnings?: number;
  minCreditsToStart?: number;
  secondsForMinCredits?: number;
  wifiConnected?: boolean;
  wifiSignal?: number;
  ip?: string;
  connectionStatus?: string;
};

export type LinkedEsp32Device = {
  id?: string;
  uid: string;
  name: string;
  type: 'esp32-vendo';
  ip: string;
  username?: string;
  authToken?: string;
  deviceId: string;
  deviceToken?: string;
  isOn?: boolean;
  online?: boolean;
  connectionStatus?: string;
  remainingTime?: number;
  totalTimeUsed?: number;
  salesToday?: number;
  totalEarnings?: number;
  minCreditsToStart?: number;
  secondsForMinCredits?: number;
  lastSeen?: unknown;
};

const normalizeBaseUrl = (ipOrUrl: string) => {
  const trimmed = ipOrUrl.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`;
};

const authHeaders = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : undefined);

const postJson = async (url: string, token: string | undefined, body?: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeaders(token) ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `ESP32 request failed (${response.status}).`);
  return data;
};

export const esp32Api = {
  normalizeBaseUrl,
  async authenticate(ipOrUrl: string, username: string, password: string) {
    const baseUrl = normalizeBaseUrl(ipOrUrl);
    const response = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Invalid ESP32 credentials or login endpoint unavailable.');
    return { baseUrl, token: String(data?.token ?? ''), deviceId: String(data?.deviceId ?? ''), deviceToken: String(data?.deviceToken ?? '') };
  },
  async getStatus(baseUrl: string, token?: string): Promise<Esp32DeviceStatus> {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/status`, { headers: authHeaders(token) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'ESP32 is offline or unreachable.');
    return data;
  },
  async getPublicDeviceInfo(ipOrUrl = '192.168.4.1') {
    const baseUrl = normalizeBaseUrl(ipOrUrl);
    const response = await fetch(`${baseUrl}/api/device-info`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Could not read ESP32 pairing information.');
    return { baseUrl, deviceId: String(data?.deviceId ?? ''), deviceToken: String(data?.deviceToken ?? ''), ip: String(data?.ip ?? '') };
  },
  addTime(baseUrl: string, token: string | undefined, seconds: number) {
    return postJson(`${normalizeBaseUrl(baseUrl)}/control/add-time`, token, { seconds });
  },
  resetMoney(baseUrl: string, token?: string) {
    return postJson(`${normalizeBaseUrl(baseUrl)}/control/reset-money`, token);
  },
  updateSettings(baseUrl: string, token: string | undefined, minCreditsToStart: number, secondsForMinCredits: number) {
    return postJson(`${normalizeBaseUrl(baseUrl)}/control/settings`, token, { minCreditsToStart, secondsForMinCredits });
  },
  setWifiEnabled(baseUrl: string, token: string | undefined, enabled: boolean) {
    return postJson(`${normalizeBaseUrl(baseUrl)}/control/wifi`, token, { enabled });
  },
};

export async function upsertEsp32Device(uid: string, device: Omit<LinkedEsp32Device, 'uid' | 'type'>) {
  const devicesRef = collection(db, 'devices');
  const existing = await getDocs(query(devicesRef, where('uid', '==', uid), where('deviceId', '==', device.deviceId)));
  const payload = {
    ...device,
    uid,
    type: 'esp32-vendo' as const,
    name: device.name || `Romers Vendo ${device.deviceId.slice(-6)}`,
    online: true,
    connectionStatus: 'Connected',
    isOn: true,
    lastSeen: serverTimestamp(),
  };
  if (!existing.empty) {
    const id = existing.docs[0].id;
    await updateDoc(doc(db, 'devices', id), payload);
    return id;
  }
  const created = await addDoc(devicesRef, { ...payload, createdAt: serverTimestamp() });
  return created.id;
}
