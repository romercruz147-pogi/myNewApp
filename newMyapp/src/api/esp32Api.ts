export async function espGetStatus(ip: string) {
  const res = await fetch(`http://${ip}/status`);
  if (!res.ok) throw new Error('status fetch failed');
  return res.json();
}

export const espResetMoney = (ip: string) => fetch(`http://${ip}/control/reset-money`, { method: 'POST' });
export const espAddTime = (ip: string, seconds: number) => fetch(`http://${ip}/control/add-time`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds }),
});
export const espUpdateSettings = (ip: string, payload: Record<string, unknown>) => fetch(`http://${ip}/control/settings`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
export const espWifiToggle = (ip: string, enabled: boolean) => fetch(`http://${ip}/control/wifi`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
});
export const espScanNetworks = async (ip: string) => (await fetch(`http://${ip}/api/scan-networks`)).json();
export const espSetupWifi = (ip: string, ssid: string, password: string) => fetch(`http://${ip}/api/setup-wifi`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssid, password }),
});
