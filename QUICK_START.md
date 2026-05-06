# 🚀 Quick Start Checklist

## Phase 1: Firmware Setup

- [ ] **Verify ArduinoJson library is installed**
  ```
  Arduino IDE → Sketch → Include Library → Manage Libraries
  Search: "ArduinoJson"
  Install version 6.x or 7.x
  ```

- [ ] **Upload `esp32_custom.ino` to device**
  ```
  Arduino IDE → Select ESP32 board
  → Port COM3 (or your device port)
  → Sketch → Upload
  ```

- [ ] **Verify device boots correctly**
  - Open Serial Monitor (Tools → Serial Monitor)
  - Should see messages like:
    ```
    Starting VendoSetup AP on 192.168.4.1
    HTTP Server started
    ```

- [ ] **Check "VendoSetup" WiFi appears**
  - On phone: Settings → WiFi
  - Look for "VendoSetup" network
  - If not visible, device may not have powered on

---

## Phase 2: App Integration

- [ ] **Copy `vendo-api.ts` to your project**
  ```
  myApp/lib/vendo-api.ts
  ```

- [ ] **Copy `wifi-setup.tsx` to your project**
  ```
  myApp/app/wifi-setup.tsx
  ```

- [ ] **Add imports to your app**
  ```typescript
  // In any screen that needs vending machine access:
  import { useVendoAPI, authenticate } from '@/lib/vendo-api';
  ```

- [ ] **Add navigation link to WiFi setup (optional)**
  ```typescript
  // In app-shell navigation:
  { href: '/wifi-setup' as const, label: '⚙️ WiFi Setup' },
  ```

---

## Phase 3: Initial Configuration

- [ ] **Power on device (first time)**
  - Device creates "VendoSetup" AP
  - Should broadcast for ~10 seconds

- [ ] **Open Expo app on phone**
  - Phone should still be on home WiFi

- [ ] **Navigate to WiFi setup screen**
  ```
  myApp → Drawer → WiFi Setup (or click button)
  ```

- [ ] **Connect phone to VendoSetup network**
  - Wait for app to detect connection
  - OR manually connect in phone WiFi settings
    ```
    SSID: VendoSetup
    Password: 12345678
    ```

- [ ] **App auto-scans networks**
  - Should see list of available networks
  - Click "Refresh" if list is empty

- [ ] **Select your home WiFi network**
  - Tap network from list
  - Screen shows "Enter Password"

- [ ] **Enter WiFi password**
  ```
  (Type your home WiFi password)
  (Leave blank if open network)
  ```

- [ ] **Tap "Connect" button**
  - Shows spinner
  - Device reboots
  - App shows: "WiFi credentials saved!"

- [ ] **Wait 5-10 seconds for device to boot**
  - Device connects to home WiFi
  - Gets IP from your router (e.g., 192.168.1.50)

- [ ] **App returns to dashboard**
  - WiFi setup complete!

---

## Phase 4: Test Basic Functionality

### Test 1: Coin Detection
- [ ] Insert a coin in slot
- [ ] Check LCD display - credits should increase
- [ ] Credits persist on screen

### Test 2: Button Operation
- [ ] Have at least 50 credits
- [ ] Press button
- [ ] Credits should clear
- [ ] Timer should start counting down
- [ ] LCD shows "RUNNING" and time remaining
- [ ] Relay should click/activate

### Test 3: Timer Countdown
- [ ] Machine is running with time > 0
- [ ] Relay is on (you hear click/hum)
- [ ] After each second, time decreases by 1
- [ ] When time reaches 0, relay turns off
- [ ] LCD shows "STOPPED" again

### Test 4: Offline Operation
- [ ] Turn off WiFi on device (disconnect power adapter)
- [ ] Machine should still work:
  - [ ] Coins are detected and counted
  - [ ] Button converts credits to time
  - [ ] Timer counts down
  - [ ] Relay controls machine
  - [ ] LCD displays correctly
- [ ] Power back on - credits restored (from NVS)

---

## Phase 5: App Integration (Advanced)

### Test 5: Authentication
- [ ] Open terminal or Postman
- [ ] Make POST request:
  ```bash
  curl -X POST http://192.168.1.50/auth \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"1234"}'
  ```
- [ ] Should receive token:
  ```json
  {"token":"12345678-123456","status":"authenticated"}
  ```
- [ ] Copy token for next tests

### Test 6: Get Device Status (With Token)
- [ ] Make GET request with token:
  ```bash
  curl -X GET http://192.168.1.50/status \
    -H "Authorization: Bearer YOUR_TOKEN_HERE"
  ```
- [ ] Should receive JSON with:
  ```json
  {
    "credits": 50,
    "remainingTime": 0,
    "isActive": false,
    "salesToday": 100,
    ...
  }
  ```

### Test 7: Add Time via App
- [ ] In your app code:
  ```typescript
  const token = await authenticate('192.168.1.50', 'admin', '1234');
  await addTime('192.168.1.50', token, 60); // Add 60 seconds
  ```
- [ ] Device should:
  - [ ] Start the machine (isActive = true)
  - [ ] Timer shows 60 seconds
  - [ ] Relay activates
  - [ ] LCD updates

### Test 8: Reset Money via App
- [ ] Insert coins (get 50+ credits)
- [ ] Call reset-money endpoint:
  ```typescript
  await resetMoney('192.168.1.50', token);
  ```
- [ ] Credits should clear on device and app

---

## Phase 6: Troubleshooting

If something doesn't work, follow these steps:

### Device Not Showing Up as AP
1. Check device is powered on
2. Check device is close to phone (1-2 meters)
3. Check phone WiFi is enabled
4. Try rebooting device
5. Check Serial Monitor for errors

### Can't Scan Networks
1. Make sure you're connected to "VendoSetup" network
2. Check phone has WiFi enabled
3. Try tapping "Refresh Networks" button
4. Check phone has internet permission in app settings

### Device Won't Connect to Home WiFi
1. Check SSID spelling matches exactly
2. Check password is correct (case-sensitive)
3. Make sure WiFi is 2.4GHz (not 5GHz)
4. Device too far from router - try moving closer
5. Router blocking 192.168.4.x subnet - try different subnet

### Can't Find Device After WiFi Setup
1. Device should show IP on LCD for 2 seconds
2. Or use `/api/wifi-status` endpoint to check:
   ```bash
   curl http://192.168.4.1/api/wifi-status
   # This will show current IP and SSID
   ```
3. Once you have IP, use it for all API calls

### Authentication Fails
1. Check username is "admin" (case-sensitive)
2. Check password is "1234" (exactly)
3. If changed, verify in esp32_custom.ino:
   ```cpp
   String adminUser = "admin";
   String adminPass = "1234";
   ```

### API Returns 401 Unauthorized
1. Make sure you have a valid token
2. Token format should be: `Authorization: Bearer <token>`
3. Make sure there's a space between "Bearer" and token
4. Token expires after device reboot

### Machine Doesn't Start When Button Pressed
1. Check credits >= 50 (check LCD)
2. Check button is connected to pin 17 (BTN_PIN)
3. Check button debounce delay:
   ```cpp
   delay(200);  // Waits 200ms for bouncing to settle
   ```
4. Check relay is connected to pin 23 (SSR_PIN)

### Coins Not Being Detected
1. Check coin detector is connected to pin 16 (COIN_PIN)
2. Check pulse count (should be 1, 5, or 10)
3. Try different pulse timing:
   ```cpp
   if (millis() - lastValidPulse > 100) // 100ms debounce
   if (pulseCount > 0 && millis() - lastPulseTime > 500) // 500ms timeout
   ```

---

## Files Checklist

Before running, make sure you have:

```
application/
├── esp32/
│   └── esp32.ino (original - unchanged)
├── esp32-custom/
│   └── esp32_custom.ino (✅ UPDATED - flashed to device)
├── myApp/
│   ├── app/
│   │   ├── index.tsx
│   │   ├── login.tsx
│   │   ├── dashboard.tsx
│   │   └── wifi-setup.tsx (✅ NEW)
│   ├── lib/
│   │   ├── auth.ts
│   │   └── vendo-api.ts (✅ NEW)
│   └── ... other files
├── SETUP_SUMMARY.md (✅ NEW - overview)
├── WIFI_SETUP_GUIDE.md (✅ NEW - detailed guide)
└── LEARNING_GUIDE.md (✅ NEW - educational)
```

---

## Expected Results

### ✅ Successful Setup

```
Device:
  - Creates "VendoSetup" AP on first boot
  - Accepts WiFi credentials via /api/setup-wifi
  - Connects to home WiFi on next boot
  - Shows IP on LCD
  - Responds to HTTP requests

App:
  - Can scan WiFi networks on 192.168.4.1
  - Can configure device WiFi
  - Can authenticate with token
  - Can get device status
  - Can control machine (add time, reset money, etc.)

Machine:
  - Detects coins correctly
  - Button converts credits to time
  - Timer counts down every second
  - Relay activates when machine is running
  - LCD displays current state
  - State persists after reboot
```

---

## Video Walkthrough (Optional)

If you get stuck, here's what to record for debugging:

1. **Serial Monitor output** - Shows device boot logs
2. **Network scan screenshot** - Shows available networks detected
3. **Device LCD display** - Shows current state
4. **Phone app screenshot** - Shows app state
5. **API response** - From `/api/wifi-status` endpoint

---

## Next Steps After Setup

1. ✅ **Change Default Credentials** (Security)
   - Edit in esp32_custom.ino:
     ```cpp
     String adminUser = "YOUR_USERNAME";
     String adminPass = "YOUR_PASSWORD";
     const char* setupApPass = "YOUR_AP_PASSWORD";
     ```
   - Reupload to device

2. ✅ **Add Device Discovery** (Convenience)
   - Implement mDNS (call device as "vendo.local")
   - Or broadcast scan on local subnet

3. ✅ **Add Logging** (Analytics)
   - Store transaction history to NVS
   - Display earnings over time in app

4. ✅ **Add Settings UI** (Control)
   - Allow changing minCreditsToStart and secondsForMinCredits from app
   - Already have POST /control/settings endpoint

5. ✅ **Consider HTTPS** (Security for production)
   - Requires certificates and more memory
   - For production deployments only

---

## Support & Questions

If something isn't working:

1. **Read LEARNING_GUIDE.md** - Explains all concepts
2. **Check WIFI_SETUP_GUIDE.md** - Troubleshooting section
3. **Review Serial Monitor output** - Device logs detailed info
4. **Test with Postman/curl** - Verify API endpoints work
5. **Check file permissions** - Make sure all files were uploaded correctly

---

**All set! Your vending machine is now fully customizable via WiFi. No more hardcoded credentials, no Blynk dependency. Pure local control! 🎉**

---

Last updated: May 6, 2026
Made with ❤️ by Romer Cruz
