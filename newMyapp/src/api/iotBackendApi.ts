// Get backend URL from environment or use default
const BASE_URL = process.env.REACT_NATIVE_IOT_BACKEND_URL || 'http://localhost:3001';

export async function loginDevice(deviceId: string, secret: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/device/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, secret }),
    });
    if (!res.ok) {
      throw new Error(`Device login failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Device login request failed');
  }
}
