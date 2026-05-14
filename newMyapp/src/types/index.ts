export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  RomersVendo: undefined;
  VendoControl: { deviceId: string; ipAddress?: string };
  Settings: undefined;
  WifiSetup: { deviceId: string; ipAddress: string };
  Analytics: undefined;
};

export type Device = {
  id: string;
  uid: string;
  name?: string;
  ipAddress?: string;
  isOnline?: boolean;
  status?: string;
  heartbeatAt?: number;
  minCreditsToStart?: number;
  secondsForMinCredits?: number;
  salesToday?: number;
  money?: number;
};
