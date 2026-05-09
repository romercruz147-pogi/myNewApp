export type UserRole = 'admin' | 'user';
export interface AppUser { uid: string; email: string | null; role: UserRole; provider: string; }
export interface DeviceRecord { deviceId: string; name: string; ip?: string; connectionStatus?: string; metadata?: Record<string, unknown>; }
