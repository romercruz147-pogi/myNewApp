import { Device } from '../types';

export function isDeviceConnected(device: Device): boolean {
  const now = Date.now();
  const heartbeatFresh = !!device.heartbeatAt && now - device.heartbeatAt < 45000;
  const onlineFlag = device.isOnline || device.status === 'Online';
  const explicitDisconnected = device.status === 'Disconnected';
  return (heartbeatFresh || !!onlineFlag) && !explicitDisconnected;
}
