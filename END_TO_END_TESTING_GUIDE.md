# End-to-End Testing & Verification Guide

## Overview

This guide helps you verify that every component of the Romers Vendo system is working correctly.

---

## Phase 1: Backend Verification

### Step 1: Start Backend

```bash
cd iot-backend
npm install
npm run dev

# Expected output:
# Server running on port 8080
# Database connected
```

### Step 2: Health Check

```bash
curl http://localhost:8080/health

# Expected response:
# {"ok":true,"service":"romers-vendo-iot-api"}
```

**If fails:** Check backend logs for errors

### Step 3: Database Connection

```bash
# Verify tables exist in Supabase dashboard:
# - devices
# - transactions
# - timer_logs
# - sales_logs
# - device_events

# Or test with curl after provisioning
```

### Step 4: Test Provisioning

```bash
# Provision a test device
curl -X POST http://localhost:8080/api/devices/provision \
  -H "Content-Type: application/json" \
  -H "X-Provisioning-Key: test-provisioning-key" \
  -d '{
    "device_id": "test_device_001",
    "device_secret": "this_is_a_test_secret_minimum_32_characters_long",
    "owner": "test@example.com",
    "name": "Test Device"
  }'

# Expected response (HTTP 201):
# {
#   "ok": true,
#   "device": {
#     "id": "uuid",
#     "device_id": "test_device_001",
#     "status": "active",
#     "created_at": "2024-..."
#   }
# }
```

**If fails:** 
- Check provisioning key matches .env
- Verify Supabase connection
- Check database has devices table

### Step 5: Test Device Authentication

```bash
# Authenticate with device credentials
curl -X POST http://localhost:8080/api/device/connect \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test_device_001",
    "deviceSecret": "this_is_a_test_secret_minimum_32_characters_long"
  }'

# Expected response (HTTP 200):
# {
#   "ok": true,
#   "success": true,
#   "token": "eyJhbGci...",
#   "device": { ... }
# }

# Save the token for next step
TOKEN="eyJhbGci..."
```

**If fails:**
- Check device ID and secret match exactly
- Verify device status is 'active'
- Check backend logs for validation errors

### Step 6: Test Heartbeat

```bash
# Send heartbeat with token from previous step
curl -X POST http://localhost:8080/api/devices/heartbeat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credits": 100,
    "remainingTime": 300,
    "salesToday": 5,
    "totalEarnings": 500,
    "isActive": true,
    "wifiConnected": true,
    "wifiSignal": -45,
    "ip": "192.168.0.121"
  }'

# Expected response (HTTP 200):
# {"ok": true, "device": { ... }}
```

**If fails:**
- Check token is valid (not expired)
- Verify device still exists and is active
- Check Authorization header format

### Step 7: Verify in Database

```bash
# Go to Supabase Dashboard
# → Table Editor → devices
# You should see:
# - device_id: test_device_001
# - status: active
# - last_seen: just now
# - metadata: contains credits, time, etc.
```

---

## Phase 2: Mobile App Verification

### Prerequisites

- Phone connected to same WiFi as PC
- Device ID/Secret provisioned in backend
- Backend URL correct in `.env`
- Firebase configured correctly

### Step 1: Build and Install

```bash
cd myApp
npm install

# Build development APK
eas build --platform android --profile preview

# Or build locally
npm run android

# Install on device
adb install -r app-release.apk
```

**If fails:**
- Check Android SDK installed
- Verify gradle.properties configured
- See ANDROID_TESTING_GUIDE.md

### Step 2: App Startup

Open app on device. Verify:
- ✓ Splash screen appears
- ✓ No crash errors
- ✓ Transitions to login screen
- ✓ No "Metro bundler unavailable" error

**If fails:**
- Check backend URL in .env
- Check Firebase configuration
- See ROMERS_VENDO_COMPLETE_FIX_GUIDE.md

### Step 3: Email/Password Authentication

1. Tap "Don't have an account? Sign Up"
2. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: Test123!
3. Tap "Create Account"

Expected:
- ✓ New account created
- ✓ Logged in automatically
- ✓ Redirected to dashboard

**If fails:**
- Check Firebase auth enabled
- Check network connectivity
- Check Android permissions (INTERNET)
- See FIREBASE_SETUP_GUIDE.md

### Step 4: Google Sign-In

1. Go back to login screen
2. Tap "Google Login"

Expected:
- ✓ Google sign-in dialog appears
- ✓ Select account
- ✓ Logged in to app
- ✓ Profile created in Firestore

**If fails:**
- Check SHA-1 and SHA-256 in Firebase
- Check google-services.json in android/app/
- Check using Expo dev build (not Go)
- See FIREBASE_SETUP_GUIDE.md Part 9

### Step 5: Device Connection

1. In app dashboard, look for device connection section
2. Enter Device ID: `test_device_001`
3. Enter Device Secret: `this_is_a_test_secret_minimum_32_characters_long`
4. Tap "Connect to Device"

Expected:
- ✓ Connected successfully message
- ✓ Device status displayed
- ✓ Can see credits/time
- ✓ Backend logs show authentication

**If fails:**
- Check backend running
- Check backend URL in .env
- Check device provisioned and active
- Check Device ID/Secret match exactly
- See NETWORK_TROUBLESHOOTING_GUIDE.md

### Step 6: Device Control

1. Tap "Start" or "Connect" button
2. Verify relay activation

Expected:
- ✓ Relay turns on (or simulated in app)
- ✓ Timer starts counting
- ✓ Credits deducted
- ✓ Status updates in backend

---

## Phase 3: ESP32 Verification

### Step 1: Flash Firmware

1. Open Arduino IDE
2. Open `esp32_new.ino`
3. Update:
   - DEVICE_ID
   - DEVICE_SECRET
   - BACKEND_URL (use PC IP)
   - WiFi SSID and password
4. **Sketch** → **Upload**

### Step 2: Serial Monitor

Open **Tools** → **Serial Monitor** (115200 baud)

Expected startup sequence:
```
========================================
Romers Vendo ESP32 - Initializing
========================================

✓ Hardware initialized
  Device ID: romers_001
📡 Connecting to WiFi: RADIUS8E9AA
.....
✓ WiFi connected!
  IP: 192.168.0.121
  Signal: -45 dBm
🔐 Authenticating with backend...
  POST http://192.168.0.100:8080/api/device/connect
  Response: 200
✓ Device authenticated!

✓ Setup complete!
```

**If fails:**
- WiFi error: Check SSID, password, band (2.4GHz)
- Backend error: Check URL, backend running, firewall
- Authentication error: Check Device ID/Secret, database

### Step 3: Test Coin Sensor

In Serial Monitor, type: `coin`

Expected:
```
💰 Coin detected!
Credits: 10
✓ Heartbeat sent
```

**If fails:**
- Check coin sensor wired to GPIO 16
- Check sensor logic (active high/low)
- Simulate manually with jumper wire

### Step 4: Test Relay

In Serial Monitor, type: `start`

Expected:
```
▶️ Machine started!
   Time: 300 seconds
```

Physical ESP32:
- Relay should activate (click sound)
- LED/indicator should turn on

**If fails:**
- Check relay wired to GPIO 23
- Check relay power supply
- Test relay directly with battery

### Step 5: Monitor Heartbeat

In Serial Monitor, watch for periodic messages:
```
✓ Heartbeat sent
✓ Heartbeat sent
```

Should appear every 10 seconds.

**If fails:**
- Check backend connection
- Check heartbeat interval set correctly
- Check token not expired

### Step 6: Verify in Database

Supabase Dashboard:
- → Table Editor
- → devices table
- Look for device_id = "romers_001"
- Check:
  - status: active
  - last_seen: just now
  - metadata: has current credits, time, etc.

---

## Phase 4: End-to-End Integration

### Full Flow Test

```
1. User opens app on phone
   ↓
2. User logs in (email or Google)
   ↓
3. User enters Device ID and Secret
   ↓
4. App authenticates device with backend
   ↓
5. ESP32 sends heartbeat to backend
   ↓
6. User taps "Start Machine"
   ↓
7. App sends command to relay
   ↓
8. Relay activates (physically turns on)
   ↓
9. Coin sensor detects insertion
   ↓
10. Credits updated in app and ESP32
   ↓
11. All data logged in Supabase
   ↓
12. User taps "Stop"
   ↓
13. Relay deactivates
   ↓
14. Transaction recorded in database
```

### Integration Test Checklist

- [ ] Phone and ESP32 on same WiFi
- [ ] Backend running on PC
- [ ] App connects to backend without errors
- [ ] Device authentication succeeds
- [ ] App shows device status
- [ ] ESP32 connects to backend
- [ ] Heartbeat sent every 10 seconds
- [ ] Relay activation works
- [ ] Coin detection works
- [ ] Timer counts down
- [ ] All data in Supabase is correct
- [ ] No CORS errors
- [ ] No network timeouts
- [ ] No crashes on either device

---

## Phase 5: Performance & Load Testing

### Response Time Test

```bash
# Measure backend response time
time curl http://localhost:8080/health
time curl -X POST http://localhost:8080/api/device/connect ...

# Should be < 100ms
```

### Database Query Performance

```bash
# In Supabase, run this SQL:
SELECT 
  COUNT(*) as device_count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_devices
FROM devices;

SELECT COUNT(*) as transaction_count FROM transactions;
```

Should return quickly (< 1 second)

### Network Throughput

```bash
# From phone to backend
ping 192.168.0.100

# Should show < 50ms latency
# 0% packet loss
```

---

## Phase 6: Error Scenarios

### Test Graceful Failure

#### WiFi Disconnection

1. On ESP32, turn off WiFi
2. Observe:
   - ✓ App doesn't crash
   - ✓ Graceful error message
   - ✓ Retry mechanism works
3. Turn WiFi back on
4. Device reconnects automatically

#### Backend Unavailable

1. Stop backend: Ctrl+C
2. On mobile app:
   - ✓ Can't authenticate new devices
   - ✓ Error message displayed
3. Restart backend
4. App reconnects successfully

#### Invalid Credentials

1. Try to login with wrong password
2. Should see error: "Wrong password"
3. Try Device ID/Secret with wrong secret
4. Should see: "Invalid Device ID or Device Secret"

#### Expired Token

1. Get token from device login
2. Wait for expiration (normally 7 days, can reduce for testing)
3. ESP32 should auto-re-authenticate
4. Should see in logs: "Token expired, re-authenticating"

---

## Debugging Tools

### Backend Logs

```bash
# Terminal where backend is running
# Look for:
# - POST /api requests
# - 200 = success
# - 401 = auth failed
# - 500 = server error
```

### Mobile App Logs

```bash
# Via terminal
adb logcat | grep -i "react\|error\|device"

# Or use Expo CLI
npm start
# Press 'j' to open debugger
```

### ESP32 Logs

Serial Monitor at 115200 baud shows all messages

### Database Logs

Supabase Dashboard → Logs (top right) shows queries

---

## Verification Checklist

### Backend ✓
- [ ] Starts without errors
- [ ] Health endpoint responds
- [ ] Database connected
- [ ] Device provisioning works
- [ ] Device authentication works
- [ ] Heartbeat accepted
- [ ] No SQL errors in logs
- [ ] CORS configured correctly

### Mobile App ✓
- [ ] Builds without errors
- [ ] Installs on device
- [ ] Starts without crashing
- [ ] Firebase authentication works
- [ ] Google Sign-In works
- [ ] Device connection succeeds
- [ ] UI updates from backend
- [ ] No network errors
- [ ] Handles disconnections

### ESP32 ✓
- [ ] Flashes successfully
- [ ] Connects to WiFi
- [ ] Authenticates with backend
- [ ] Sends heartbeat
- [ ] Detects coin sensor
- [ ] Activates relay
- [ ] Persistent storage works
- [ ] Serial commands work

### Database ✓
- [ ] Has all required tables
- [ ] Devices table has correct data
- [ ] Transactions logged
- [ ] No data corruption
- [ ] Backups working
- [ ] Query performance good

### Network ✓
- [ ] Phone and PC on same WiFi
- [ ] All traffic unencrypted (dev) or encrypted (prod)
- [ ] No firewall blocking
- [ ] Correct IPs everywhere
- [ ] Port 8080 accessible
- [ ] No timeouts

---

## Test Results Template

Use this to document your testing:

```
Date: 2024-05-08
Environment: Development
Tester: Your Name

BACKEND: ✓ PASS / ✗ FAIL
- Health: ✓
- Provisioning: ✓
- Authentication: ✓
- Heartbeat: ✓
Notes: All working

MOBILE APP: ✓ PASS / ✗ FAIL
- Installation: ✓
- Firebase Login: ✓
- Google Login: ✓
- Device Connection: ✓
- UI Updates: ✓
Notes: Google login took 3 seconds

ESP32: ✓ PASS / ✗ FAIL
- WiFi Connection: ✓
- Backend Auth: ✓
- Heartbeat: ✓
- Coin Detection: ✓
- Relay Control: ✓
Notes: Signal strength -45 dBm

INTEGRATION: ✓ PASS / ✗ FAIL
- End-to-end flow: ✓
- Database updates: ✓
- Error handling: ✓
Notes: All functioning correctly

ISSUES FOUND:
- None

READY FOR PRODUCTION: YES / NO
```

---

## Next Steps

After all tests pass:
1. Review QUICK_START_SUMMARY.md
2. Prepare for production deployment
3. Follow BACKEND_DEPLOYMENT_GUIDE.md
4. Update app URLs to production
5. Build production APK
6. Deploy and test again

**Congratulations!** Your Romers Vendo system is fully tested and ready! 🎉
