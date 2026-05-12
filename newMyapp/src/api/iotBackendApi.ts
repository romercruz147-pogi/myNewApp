const BASE_URL = 'https://example-iot-backend.com';

export async function loginDevice(deviceId: string, secret: string) {
  const res = await fetch(`${BASE_URL}/api/device/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, secret }),
  });
  if (!res.ok) throw new Error('Device login failed');
  return res.json();
}
