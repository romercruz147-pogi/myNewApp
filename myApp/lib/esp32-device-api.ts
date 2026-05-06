import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Esp32DeviceStatus = {
  deviceId?: string;
  deviceSecret?: string;
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
  pricingSettings?: PricingSettings;
  wifiConnected?: boolean;
  wifiSignal?: number;
  ip?: string;
  connectionStatus?: string;
  status?: string;
  isConnected?: boolean;
  lastSeen?: unknown;
};

export type PricingSettings = {
  onePesoMinutes: number;
  tenPesoMinutes: number;
  minCreditsToStart: number;
  secondsForMinCredits: number;
};

export type LinkedEsp32Device = {
  id?: string;
  uid: string;
  name: string;
  deviceName?: string;
  type: 'esp32-vendo';
  ip: string;
  username?: string;
  authToken?: string;
  deviceId: string;
  deviceSecret?: string;
  backendUrl?: string;
  ownerUid?: string;
  status?: string;
  isConnected?: boolean;
  isOn?: boolean;
  online?: boolean;
  connectionStatus?: string;
  remainingTime?: number;
  totalTimeUsed?: number;
  money?: number;
  moneyInserted?: number;
  salesToday?: number;
  totalEarnings?: number;
  pricingSettings?: PricingSettings;
  minCreditsToStart?: number;
  secondsForMinCredits?: number;
  lastSeen?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const defaultPricingSettings: PricingSettings = {
  onePesoMinutes: 1,
  tenPesoMinutes: 10,
  minCreditsToStart: 1,
  secondsForMinCredits: 60,
};

export const DEFAULT_DEVICE_BACKEND_URL = process.env.EXPO_PUBLIC_DEVICE_BACKEND_URL ?? process.env.EXPO_PUBLIC_DEVICE_HEARTBEAT_URL ?? '';

const normalizeBaseUrl = (ipOrUrl: string) => {
  const trimmed = ipOrUrl.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`;
};

export const normalizeBackendUrl = (url = DEFAULT_DEVICE_BACKEND_URL) => url.trim().replace(/\/+$/, '');

const authHeaders = (deviceSecret?: string) => (deviceSecret ? { Authorization: `Bearer ${deviceSecret}` } : undefined);

const postJson = async (url: string, deviceSecret: string | undefined, body?: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeaders(deviceSecret) ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `ESP32 request failed (${response.status}).`);
  return data;
};

const randomCredential = (prefix: string, bytes: number) => {
  const array = new Uint8Array(bytes);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}${hex}`;
};

export const generateDeviceCredentials = () => ({
  deviceId: randomCredential('RV-', 8),
  deviceSecret: randomCredential('RVS-', 24),
});

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
    return { baseUrl, token: String(data?.token ?? ''), deviceId: String(data?.deviceId ?? ''), deviceSecret: String(data?.deviceSecret ?? '') };
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
    if (!response.ok) throw new Error(data?.error || 'Could not read ESP32 device credential information.');
    return { baseUrl, deviceId: String(data?.deviceId ?? ''), deviceSecret: String(data?.deviceSecret ?? ''), ip: String(data?.ip ?? '') };
  },
  configureDeviceCredentials(baseUrl: string, deviceId: string, deviceSecret: string, backendUrl?: string, ownerUid?: string, authSecret?: string) {
    return postJson(`${normalizeBaseUrl(baseUrl)}/api/device-credentials`, authSecret ?? deviceSecret, { deviceId, deviceSecret, backendUrl, ownerUid });
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

export function getUserDeviceRef(uid: string, deviceId: string) {
  return doc(db, 'users', uid, 'devices', deviceId);
}

export function getLegacyDeviceRef(deviceDocId: string) {
  return doc(db, 'devices', deviceDocId);
}

export async function createDeviceConnectionProfile(
  uid: string,
  deviceName: string,
  credentials = generateDeviceCredentials(),
  options: { ip?: string; backendUrl?: string } = {},
) {
  const name = deviceName.trim() || `Romers Vendo ${credentials.deviceId.slice(-6)}`;
  const payload = {
    uid,
    type: 'esp32-vendo' as const,
    name,
    deviceName: name,
    deviceId: credentials.deviceId,
    deviceSecret: credentials.deviceSecret,
    ip: options.ip ? normalizeBaseUrl(options.ip) : '',
    backendUrl: normalizeBackendUrl(options.backendUrl ?? DEFAULT_DEVICE_BACKEND_URL),
    ownerUid: uid,
    status: 'Waiting for ESP32 credentials',
    connectionStatus: 'Disconnected',
    isConnected: false,
    online: false,
    isOn: false,
    money: 0,
    moneyInserted: 0,
    remainingTime: 0,
    totalTimeUsed: 0,
    salesToday: 0,
    totalEarnings: 0,
    pricingSettings: defaultPricingSettings,
    minCreditsToStart: defaultPricingSettings.minCreditsToStart,
    secondsForMinCredits: defaultPricingSettings.secondsForMinCredits,
    lastSeen: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(getUserDeviceRef(uid, credentials.deviceId), payload);
  await setDoc(doc(db, 'devices', credentials.deviceId), payload);
  return payload;
}

export async function updateConnectedDevice(uid: string, deviceId: string, patch: Partial<LinkedEsp32Device>) {
  const payload = { ...patch, updatedAt: serverTimestamp() };
  await setDoc(getUserDeviceRef(uid, deviceId), payload, { merge: true });
  await setDoc(doc(db, 'devices', deviceId), payload, { merge: true });
}

export async function validateAndConnectDevice(uid: string, deviceId: string, deviceSecret: string, options: { deviceName?: string; backendUrl?: string } = {}) {
  const cleanDeviceId = deviceId.trim();
  const cleanDeviceSecret = deviceSecret.trim();
  if (!cleanDeviceId || !cleanDeviceSecret) throw new Error('Device ID and deviceSecret are required.');

  const globalRef = doc(db, 'devices', cleanDeviceId);
  const globalSnap = await getDoc(globalRef);
  if (!globalSnap.exists()) throw new Error('No device exists for that Device ID. Generate it in the app first.');

  const existing = globalSnap.data() as LinkedEsp32Device;
  if (existing.deviceSecret !== cleanDeviceSecret) throw new Error('Invalid deviceSecret for this Device ID.');
  if (existing.ownerUid && existing.ownerUid !== uid) throw new Error('This device is already connected to another account.');

  const name = options.deviceName?.trim() || existing.name || existing.deviceName || `Romers Vendo ${cleanDeviceId.slice(-6)}`;
  const payload = {
    ...existing,
    uid,
    ownerUid: uid,
    name,
    deviceName: name,
    deviceId: cleanDeviceId,
    deviceSecret: cleanDeviceSecret,
    backendUrl: normalizeBackendUrl(options.backendUrl ?? existing.backendUrl ?? DEFAULT_DEVICE_BACKEND_URL),
    status: existing.isConnected ? 'Connected' : 'Waiting for ESP32 heartbeat',
    connectionStatus: existing.isConnected ? 'Connected' : 'Disconnected',
    updatedAt: serverTimestamp(),
  };

  await setDoc(getUserDeviceRef(uid, cleanDeviceId), payload, { merge: true });
  await setDoc(globalRef, payload, { merge: true });
  return payload;
}

export async function upsertEsp32Device(uid: string, device: Omit<LinkedEsp32Device, 'uid' | 'type'>) {
  const devicesRef = collection(db, 'devices');
  const existing = await getDocs(query(devicesRef, where('uid', '==', uid), where('deviceId', '==', device.deviceId)));
  const name = device.name || device.deviceName || `Romers Vendo ${device.deviceId.slice(-6)}`;
  const pricingSettings = device.pricingSettings ?? {
    onePesoMinutes: Math.max(1, Math.round((device.secondsForMinCredits ?? 60) / 60)),
    tenPesoMinutes: Math.max(1, Math.round(((device.secondsForMinCredits ?? 60) * 10) / 60)),
    minCreditsToStart: device.minCreditsToStart ?? 1,
    secondsForMinCredits: device.secondsForMinCredits ?? 60,
  };
  const payload = {
    ...device,
    uid,
    type: 'esp32-vendo' as const,
    name,
    deviceName: name,
    status: device.status ?? 'Connected',
    isConnected: device.isConnected ?? true,
    online: device.online ?? true,
    connectionStatus: device.connectionStatus ?? 'Connected',
    isOn: device.isOn ?? true,
    pricingSettings,
    minCreditsToStart: pricingSettings.minCreditsToStart,
    secondsForMinCredits: pricingSettings.secondsForMinCredits,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(getUserDeviceRef(uid, device.deviceId), payload, { merge: true });

  if (!existing.empty) {
    const id = existing.docs[0].id;
    await updateDoc(doc(db, 'devices', id), payload);
    return id;
  }

  const fixedRef = doc(db, 'devices', device.deviceId);
  const fixedSnap = await getDoc(fixedRef);
  if (fixedSnap.exists()) {
    await setDoc(fixedRef, payload, { merge: true });
    return device.deviceId;
  }

  const created = await addDoc(devicesRef, { ...payload, createdAt: serverTimestamp() });
  return created.id;
}
