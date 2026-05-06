# 🔧 ESP32 Vending Machine - Complete Refactoring Summary

## What Was Changed ✅

### 1. **ESP32 Firmware (`esp32_custom.ino`)**

**Removed:**
- ❌ All hardcoded WiFi networks (SSID/password arrays removed)
- ❌ Blynk integration (`#include <BlynkSimpleEsp32.h>`, `Blynk.begin()`, `Blynk.run()`, virtual pins)
- ❌ `BLYNK_WRITE()` handlers for V0-V9 pins

**Added:**
- ✅ **Setup Mode WiFi (AP)** - Device creates "VendoSetup" network on 192.168.4.1
- ✅ **WiFi Scanning** - `/api/scan-networks` endpoint returns list of available networks
- ✅ **WiFi Configuration** - `/api/setup-wifi` endpoint accepts SSID + password, saves to NVS
- ✅ **WiFi Status** - `/api/wifi-status` endpoint shows current connection state
- ✅ **Persistent Storage** - Credentials saved to ESP32 NVS (survives reboots)
- ✅ **Fallback Mode** - If WiFi fails 6+ times, automatically goes back to setup AP
- ✅ **Enhanced HTTP API** - All endpoints include proper CORS, error handling, JSON responses

**Preserved (100% Identical):**
- ✅ Coin detection logic (1, 5, 10 pulse counts)
- ✅ Button → Time conversion formula
- ✅ Timer countdown (every 1 second)
- ✅ SSR relay control
- ✅ LCD display with rotating screens
- ✅ NVS persistence (`saveState()`)
- ✅ All variable names and data types

---

### 2. **React Native App**

**New Files Created:**

#### A. `app/wifi-setup.tsx` - WiFi Configuration Screen
- User connects to "VendoSetup" AP
- App scans available networks
- User selects network and enters password
- Auto-detects secured vs open networks
- Shows signal strength (RSSI)
- Beautiful UI with status indicators
- Auto-redirects to dashboard after connection

#### B. `lib/vendo-api.ts` - API Helper Functions
Ready-to-use functions for:
- `scanNetworks()` - Get list of WiFi networks
- `setupWiFi()` - Configure device to connect to home WiFi
- `getWiFiStatus()` - Check current connection
- `authenticate()` - Get bearer token
- `getStatus()` - Get device state (credits, time, etc.)
- `addTime()` - Add seconds to timer
- `resetMoney()` - Clear credits
- `toggleMachine()` - Pause/resume
- `useVendoAPI()` - React hook for real-time polling

#### C. `WIFI_SETUP_GUIDE.md` - Complete Documentation
Comprehensive guide covering:
- System architecture
- How the WiFi setup works
- All HTTP endpoints with examples
- Troubleshooting guide
- Initial setup instructions
- Optional enhancements

---

## How It Works (Step by Step)

### 🔌 **Initial Setup (First Time)**

```
1. Flash esp32_custom.ino to device
   ↓
2. Device boots → Scans for saved WiFi → Not found → Starts "VendoSetup" AP
   ↓
3. User opens React Native app on phone
   ↓
4. Phone connects to "VendoSetup" network (password: "12345678")
   ↓
5. App navigates to /wifi-setup screen
   ↓
6. App calls GET /api/scan-networks on 192.168.4.1
   ↓
7. Device responds with list of available networks
   ↓
8. User taps network, enters password
   ↓
9. App calls POST /api/setup-wifi with credentials
   ↓
10. Device saves to NVS and reboots
    ↓
11. Device boots → Finds saved WiFi → Connects successfully
    ↓
12. Device now on home network (e.g., 192.168.1.50)
    ↓
13. App waits and redirects to dashboard
    ↓
14. User authenticates to /auth endpoint with username/password
    ↓
15. Gets bearer token, uses for all subsequent API calls
    ↓
✅ Ready to use!
```

### 🔄 **Normal Operation (After WiFi Configured)**

```
1. Device powers on
   ↓
2. Loads WiFi credentials from NVS
   ↓
3. Attempts to connect to configured WiFi
   ↓
4. If successful → Gets IP from DHCP → Ready for app access
   ↓
5. If fails 6+ times → Reverts to setup AP mode (wait for reconfiguration)
   ↓
6. App communicates with device via HTTP (same API endpoints)
   ↓
7. All device logic works whether WiFi is up or not
   ✅ Coins, timer, relay, LCD all function offline
```

---

## Key Differences from Original

| Feature | Before (Blynk) | After (HTTP) |
|---------|---|---|
| **WiFi Setup** | Hardcoded in code | User-configurable via app |
| **Connectivity** | Cloud-based (Blynk servers) | Local network only |
| **Control** | Virtual pins (V0-V9) | REST API endpoints |
| **Offline Usage** | Requires Blynk server | Works perfectly offline |
| **Status Updates** | Periodic Blynk.virtualWrite() | Real-time GET /status |
| **Device Logic** | Same as before ✅ | **100% identical** ✅ |

---

## HTTP API Overview

### No Auth Required (Setup Mode)
```
GET  /api/scan-networks       → List available WiFi
POST /api/setup-wifi          → Configure WiFi & reboot
GET  /api/wifi-status         → Check WiFi connection
POST /auth                    → Get bearer token
```

### Auth Required (Bearer Token)
```
GET  /status                  → Device state
POST /control/reset-money     → Clear credits
POST /control/add-time        → Add seconds
POST /control/pause-resume    → Toggle machine
POST /control/reset-time      → Clear timer
POST /control/settings        → Update config
```

---

## Integration with Your App

### Option 1: Add to Navigation (Recommended)

Update `components/app-shell/index.tsx`:
```typescript
const nav = [
  { href: '/dashboard' as const, label: 'Dashboard' },
  { href: '/devices' as const, label: 'Devices' },
  { href: '/analytics' as const, label: 'Analytics' },
  { href: '/wifi-setup' as const, label: '⚙️ WiFi Setup' },  // ← ADD THIS
  { href: '/settings' as const, label: 'Settings' },
  { href: '/romers-vendo' as const, label: 'Romers Vendo' },
];
```

### Option 2: Add Button to Dashboard

```typescript
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const router = useRouter();
  
  return (
    <AppShell title="Dashboard">
      {/* ... existing code ... */}
      
      <TouchableOpacity 
        style={styles.wifiButton}
        onPress={() => router.push('/wifi-setup')}
      >
        <Text style={styles.buttonText}>Configure WiFi</Text>
      </TouchableOpacity>
    </AppShell>
  );
}
```

### Option 3: Use API Functions Directly

```typescript
import { 
  scanNetworks, 
  setupWiFi, 
  getWiFiStatus, 
  useVendoAPI 
} from '@/lib/vendo-api';

// In your component
const [networks, setNetworks] = useState([]);

useEffect(() => {
  scanNetworks().then(setNetworks);
}, []);

// Or use the hook for real-time polling
const { status, addTime, resetMoney } = useVendoAPI('192.168.1.50', token);
```

---

## Device Credentials

### WiFi Setup (Initial)
- **SSID:** `VendoSetup`
- **Password:** `12345678`
- **IP:** `192.168.4.1`

### App Authentication
- **Username:** `admin`
- **Password:** `1234`

### Default Device Settings
- **Min Credits to Start:** 50
- **Seconds per Min Credit:** 3000 (50 seconds)
- **Coin Pulses:** 1 pulse = 1 credit, 5 = 5 credits, 10 = 10 credits

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Can't find "VendoSetup" | Make sure device is powered on and close by |
| WiFi setup fails | Check SSID/password are correct, WiFi is 2.4GHz only |
| Device stuck in setup mode | WiFi failed 6+ times, reconfigure via app |
| Can't reach device IP | Device disconnected, check WiFi status via `/api/wifi-status` |
| Coins not working | Unrelated to WiFi, check COIN_PIN (should be 16) |
| Timer not running | Make sure `isActive` is true (call `/control/add-time` or press button) |

---

## Testing Checklist

### Initial Setup
- [ ] Flash firmware to ESP32
- [ ] Device boots and creates "VendoSetup" AP
- [ ] Phone connects to "VendoSetup" network
- [ ] App opens `/wifi-setup` screen
- [ ] Networks scan completes
- [ ] User selects network and enters password
- [ ] Device reboots and connects to home WiFi
- [ ] Device appears on home network with valid IP

### Authentication & Control
- [ ] App authenticates to `/auth` endpoint
- [ ] Bearer token received
- [ ] App calls `/status` with token
- [ ] Status returns correct values
- [ ] `/control/add-time` works
- [ ] `/control/reset-money` works
- [ ] `/control/pause-resume` works

### Device Logic
- [ ] Coins detected and counted correctly
- [ ] Button converts credits to time correctly
- [ ] Timer counts down every second
- [ ] Relay turns on when time > 0
- [ ] Relay turns off when time = 0
- [ ] LCD displays correct values
- [ ] State persists after reboot

### Offline Operation
- [ ] Turn off WiFi on device
- [ ] Machine logic still works (coin, button, timer)
- [ ] LCD still displays correctly
- [ ] Reconnect WiFi - previous state restored

---

## Files Modified/Created

### Modified
- ✏️ `esp32-custom/esp32_custom.ino` - Complete refactor (WiFi setup, API endpoints)

### Created
- ✨ `myApp/app/wifi-setup.tsx` - WiFi setup UI
- ✨ `myApp/lib/vendo-api.ts` - API helper functions
- 📖 `WIFI_SETUP_GUIDE.md` - Complete documentation
- 📋 `SETUP_SUMMARY.md` - This file

---

## Next Steps

1. **Test Setup** - Follow the Testing Checklist above
2. **Integrate Navigation** - Add WiFi setup to app navigation
3. **Configure Credentials** - Change default username/password before deployment
4. **Add mDNS** - Optional: Add `vendo.local` hostname support
5. **Add Logging** - Optional: Store transaction history to device
6. **Add OTA Updates** - Optional: Update firmware wirelessly

---

## Security Notes ⚠️

- ⚠️ Device uses **HTTP (unencrypted)** - only use on trusted networks
- ⚠️ Default credentials should be changed before deployment
- ⚠️ No rate limiting on API endpoints
- ⚠️ Token is simple timestamp-based, not cryptographically secure
- ⚠️ CORS is open to all origins (`*`)

**For production deployment:**
1. Change `adminUser` and `adminPass` in firmware
2. Change `setupApPass` in firmware
3. Consider implementing HTTPS/TLS
4. Consider implementing IP-based access control
5. Consider adding rate limiting
6. Consider implementing OAuth/JWT tokens

---

## Questions? 💬

All original logic is preserved and identical to `esp32.ino`. The **only** difference is the transport layer:
- **Before:** Blynk cloud service (virtual pins)
- **After:** Local HTTP API (REST endpoints)

Your coins, timer, relay, LCD, and button logic work exactly the same way.

---

**Made with ❤️ by Romer Cruz**
