// Quick API Reference for ESP32 Vending Machine

// ============================================
// 1. CONNECT TO SETUP MODE (Initial Setup)
// ============================================
// Device broadcasts "VendoSetup" WiFi network
// Password: "12345678"
// IP: 192.168.4.1

// ============================================
// 2. SCAN AVAILABLE NETWORKS
// ============================================
const scanNetworks = async () => {
  const res = await fetch('http://192.168.4.1/api/scan-networks');
  const data = await res.json();
  // data.networks = [{ ssid, rssi, channel, secure }, ...]
  return data.networks;
};

// ============================================
// 3. CONNECT TO HOME WIFI
// ============================================
const setupWiFi = async (ssid: string, password: string) => {
  const res = await fetch('http://192.168.4.1/api/setup-wifi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid, password }),
  });
  // Device reboots and connects
  // Returns: { ok: true, message: "...", ssid }
  return res.json();
};

// ============================================
// 4. GET WIFI STATUS
// ============================================
const getWiFiStatus = async (ip: string = '192.168.4.1') => {
  const res = await fetch(`http://${ip}/api/wifi-status`);
  const data = await res.json();
  // {
  //   connected: boolean,
  //   ip: string,
  //   ssid: string,
  //   rssi?: number,
  //   mode?: "setup"
  // }
  return data;
};

// ============================================
// 5. AUTHENTICATE (Get Bearer Token)
// ============================================
const authenticate = async (ip: string, username: string, password: string) => {
  const res = await fetch(`http://${ip}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  // { token: "...", status: "authenticated" }
  // Use: Authorization: Bearer <token>
  return data.token;
};

// ============================================
// 6. GET DEVICE STATUS (Requires Auth)
// ============================================
const getStatus = async (ip: string, token: string) => {
  const res = await fetch(`http://${ip}/status`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  // {
  //   credits: number,
  //   remainingTime: number,
  //   totalTime: number,
  //   isActive: boolean,
  //   salesToday: number,
  //   totalEarnings: number,
  //   minCreditsToStart: number,
  //   secondsPerMinCredit: number,
  //   wifiConnected: boolean,
  //   wifiSignal: number
  // }
  return data;
};

// ============================================
// 7. RESET CREDITS (Requires Auth)
// ============================================
const resetMoney = async (ip: string, token: string) => {
  const res = await fetch(`http://${ip}/control/reset-money`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json(); // { ok: true, credits: 0 }
};

// ============================================
// 8. ADD TIME (Requires Auth)
// ============================================
const addTime = async (ip: string, token: string, seconds: number) => {
  const res = await fetch(`http://${ip}/control/add-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ seconds }),
  });
  return res.json();
  // { ok: true, remainingTime: number, isActive: boolean }
};

// ============================================
// 9. PAUSE/RESUME MACHINE (Requires Auth)
// ============================================
const toggleMachine = async (ip: string, token: string) => {
  const res = await fetch(`http://${ip}/control/pause-resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json(); // { ok: true, isActive: boolean }
};

// ============================================
// 10. RESET TIMER (Requires Auth)
// ============================================
const resetTime = async (ip: string, token: string) => {
  const res = await fetch(`http://${ip}/control/reset-time`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
  // { ok: true, remainingTime: 0, isActive: false }
};

// ============================================
// 11. UPDATE SETTINGS (Requires Auth)
// ============================================
const updateSettings = async (
  ip: string,
  token: string,
  minCreditsToStart?: number,
  secondsForMinCredits?: number
) => {
  const res = await fetch(`http://${ip}/control/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      minCreditsToStart,
      secondsForMinCredits,
    }),
  });
  return res.json();
};

// ============================================
// EXAMPLE: Complete Setup Flow
// ============================================
export async function completeSetup() {
  try {
    // Step 1: Connect to setup network manually (done in app UI)
    
    // Step 2: Scan networks
    const networks = await scanNetworks();
    console.log('Available networks:', networks);
    
    // Step 3: User selects network and enters password (done in UI)
    const ssid = networks[0].ssid; // example
    const password = 'mypassword';
    
    // Step 4: Send credentials and wait for reboot
    await setupWiFi(ssid, password);
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
    
    // Step 5: Check if device is now on home network
    // (You'll need to find its new IP via mDNS or network scan)
    const status = await getWiFiStatus('192.168.x.x'); // actual device IP
    console.log('WiFi Status:', status);
    
    // Step 6: Authenticate
    const token = await authenticate('192.168.x.x', 'admin', '1234');
    console.log('Auth token:', token);
    
    // Step 7: Get device status
    const deviceStatus = await getStatus('192.168.x.x', token);
    console.log('Device Status:', deviceStatus);
    
    // Step 8: Add 60 seconds
    await addTime('192.168.x.x', token, 60);
    console.log('Added 60 seconds');
    
    // Done!
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

// ============================================
// EXAMPLE: React Native Hook
// ============================================
export function useVendoAPI(ip: string, token: string | null) {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  
  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getStatus(ip, token);
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [token]);
  
  return {
    status,
    loading,
    addTime: (s) => addTime(ip, token!, s),
    resetMoney: () => resetMoney(ip, token!),
    toggleMachine: () => toggleMachine(ip, token!),
    refresh,
  };
}

// ============================================
// DEFAULT CREDENTIALS
// ============================================
// Setup WiFi SSID: "VendoSetup"
// Setup WiFi Password: "12345678"
// Setup IP: 192.168.4.1
//
// Device Username: "admin"
// Device Password: "1234"
//
// Default Settings:
// - minCreditsToStart: 50
// - secondsForMinCredits: 3000 (50 sec)
// - coinPulses: 1 = 1 credit, 5 = 5 credits, 10 = 10 credits

// ============================================
// SECURITY NOTES
// ============================================
// ⚠️  ONLY use this on private, trusted networks
// ⚠️  No encryption by default (HTTP, not HTTPS)
// ⚠️  WiFi is on 2.4GHz only (no 5GHz support)
// ⚠️  Default credentials should be changed before production
//
// For production:
// 1. Change adminUser and adminPass in firmware
// 2. Change setupApPass in firmware
// 3. Consider adding HTTPS support
// 4. Consider IP-based access control

export default {
  scanNetworks,
  setupWiFi,
  getWiFiStatus,
  authenticate,
  getStatus,
  resetMoney,
  addTime,
  toggleMachine,
  resetTime,
  updateSettings,
  useVendoAPI,
  completeSetup,
};
