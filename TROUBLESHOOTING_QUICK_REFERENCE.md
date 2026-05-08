# Romers Vendo - Troubleshooting Quick Reference

Use this guide when something isn't working. Find your issue and follow the solution.

---

## 🔴 Critical Issues

### "App Crashes on Startup"

**Symptoms:** App opens then crashes immediately

**Solutions:**
1. Check backend URL in `.env` is correct
2. Verify backend is running: `cd iot-backend && npm run dev`
3. Test health endpoint: `curl http://192.168.0.100:8080/health`
4. Check Firebase config in `myApp/lib/firebase.ts`
5. Clear app cache: Settings → Apps → App → Storage → Clear Cache

**If still failing:**
- See ANDROID_TESTING_GUIDE.md Part 10 (Common Issues)
- Check logs: `adb logcat | grep -i "react"`

---

### "Backend Won't Start"

**Symptoms:** `npm run dev` shows errors

**Solutions:**
1. Check .env file exists in iot-backend/
2. Verify all required variables set (especially SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
3. Check Supabase connection: Test in Supabase dashboard
4. Clear node_modules: `rm -rf node_modules && npm install`
5. Check Node version: `node --version` (need 16+)

**If still failing:**
- See BACKEND_DEPLOYMENT_GUIDE.md troubleshooting
- Check error message for specific issue

---

### "Google Sign-In Not Working"

**Symptoms:** Google login button does nothing or shows error

**Solutions:**
1. Check SHA-1 and SHA-256 in Firebase Console
   - Run: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey`
   - Copy SHA-1 and SHA-256 to Firebase
2. Verify using Expo dev build (not Go): `eas build --platform android --profile preview`
3. Check google-services.json in `android/app/`
4. Verify package name is `com.romersvendo` everywhere
5. Check Web Client ID in `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

**If still failing:**
- See FIREBASE_SETUP_GUIDE.md Part 3 (SHA Key Setup)
- See ANDROID_TESTING_GUIDE.md Part 8 (Google Sign-In)

---

### "Cannot Connect to Backend from Phone"

**Symptoms:** "Failed to connect", network error, timeout

**Solutions:**
1. Check both on same WiFi network
2. Test from PC first: `curl http://localhost:8080/health` (works = backend OK)
3. Replace localhost with PC IP: `http://192.168.0.100:8080` (change X's to your IP)
4. Test from phone: `curl http://192.168.0.100:8080/health`
5. Check backend CORS_ORIGINS in `.env` includes phone's Expo URL
6. Verify firewall allows port 8080

**If still failing:**
- See NETWORK_TROUBLESHOOTING_GUIDE.md
- Check CORS errors in backend logs
- Verify `adb reverse` is working if using USB

---

## 🟡 Common Issues

### "Device Authentication Fails"

**Symptoms:** "Invalid Device ID or Secret" error

**Solutions:**
1. Verify Device ID matches exactly (case-sensitive)
2. Verify Device Secret matches exactly
3. Ensure device is provisioned in database:
   ```bash
   curl http://localhost:8080/api/devices/provision \
     -H "X-Provisioning-Key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"device_id":"test_001",...}'
   ```
4. Check device status is "active" in Supabase
5. Verify Device Secret hasn't expired

**If still failing:**
- See DEVICE_PROVISIONING_GUIDE.md Part 5 (Verify)
- Check backend logs for validation errors

---

### "Relay Doesn't Activate"

**Symptoms:** Button pressed but relay doesn't click

**Solutions:**
1. Check relay wired to GPIO 23 on ESP32
2. Verify relay has power supply (separate from ESP32)
3. Test relay manually with jumper wire
4. Check command reaches backend:
   ```bash
   curl http://localhost:8080/api/devices/command \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"action":"start"}'
   ```
5. Check ESP32 receives and processes command in Serial Monitor

**If still failing:**
- See ESP32_SETUP_GUIDE.md Part 6 (Troubleshooting)
- Check relay specifications and power requirements

---

### "Coin Sensor Not Detecting"

**Symptoms:** Coins detected = 0

**Solutions:**
1. Check coin sensor wired to GPIO 16
2. Test sensor with jumper wire (ground pin)
3. Verify sensor polarity (+ and -)
4. Check for loose connections
5. Test in Serial Monitor: Type `coin` and press Enter
6. Verify coin sensor is not defective

**If still failing:**
- See ESP32_SETUP_GUIDE.md Part 6
- Temporarily simulate: `coin` command in Serial Monitor

---

### "WiFi Connection Failed"

**Symptoms:** ESP32 can't connect to WiFi

**Solutions:**
1. Check WiFi SSID and password in firmware
2. Verify WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
3. Test WiFi with another device first
4. Check credentials in Serial Monitor output
5. Restart ESP32: Press reset button
6. Try static IP instead of DHCP

**If still failing:**
- See WIFI_SETUP_GUIDE.md
- Check router network settings
- Try moving ESP32 closer to router

---

### "Database Queries Slow"

**Symptoms:** App takes long time to load or respond

**Solutions:**
1. Check Supabase connection in backend:
   ```bash
   psql -h db.supabase.co -U postgres
   ```
2. Verify database indexes exist:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename='devices';
   ```
3. Check row count: `SELECT COUNT(*) FROM devices;`
4. Clear old logs/transactions: Archive old data
5. Upgrade Supabase plan if needed

**If still failing:**
- See BACKEND_DEPLOYMENT_GUIDE.md Part 12 (Scaling)

---

## 🟢 Minor Issues

### "App Slow to Load"

**Solutions:**
1. Clear app cache
2. Restart phone
3. Check network connection: `ping 192.168.0.100`
4. Verify backend not heavily loaded
5. Check no large queries running

---

### "Firebase Config Shows Warnings"

**Solutions:**
1. This is usually harmless
2. Update firebase/compat to latest
3. Or ignore if functionality works

---

### "Expo Go Shows "Metro Bundler Unavailable""

**Solutions:**
1. Make sure on same WiFi
2. Phone must be able to reach PC's IP
3. Try `adb reverse tcp:19000 tcp:19000` for USB
4. Check firewall allows port 19000

---

### "Device Status Not Updating"

**Solutions:**
1. Ensure device sending heartbeat
2. Check ESP32 heartbeat interval (should be 10 seconds)
3. Verify device still connected
4. Refresh app to see latest status
5. Check Supabase RLS policies not blocking updates

---

## 🔧 Debugging Techniques

### Check What's Running

```bash
# Backend running?
curl http://localhost:8080/health

# Database working?
# (Go to Supabase dashboard)

# WiFi connected?
ping 192.168.0.1

# Device accessible?
ping 192.168.0.100
```

### View Logs

**Backend:**
```bash
# Terminal where backend is running
# Look for POST requests and error messages
```

**Mobile App:**
```bash
adb logcat | grep -i "react"
adb logcat | grep -i "error"
```

**ESP32:**
```
Serial Monitor at 115200 baud
```

**Database:**
Supabase Dashboard → Logs (top right)

---

### Test API Directly

```bash
# Test device authentication
curl -X POST http://localhost:8080/api/device/connect \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "romers_001",
    "deviceSecret": "secret..."
  }'

# Test heartbeat
curl -X POST http://localhost:8080/api/devices/heartbeat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credits": 100,
    "remainingTime": 300,
    "isActive": true
  }'
```

---

## 📋 Verification Checklist

When things aren't working, go through this:

- [ ] Backend running (`npm run dev` shows "listening on 8080")
- [ ] Database connected (Supabase accessible)
- [ ] Phone and PC on same WiFi
- [ ] PC IP correct in `.env` files
- [ ] Firebase credentials correct in `myApp/.env`
- [ ] Device provisioned in database
- [ ] Device Secret matches exactly
- [ ] No CORS errors in logs
- [ ] No authentication errors
- [ ] Network connectivity working (ping test)
- [ ] All services (backend, Supabase, Firebase) up and running

---

## 🚨 Emergency Steps

If everything is broken:

### 1. Reset Backend
```bash
cd iot-backend
rm -rf node_modules
npm install
npm run dev
```

### 2. Reset Mobile App
```bash
cd myApp
rm -rf node_modules
npm install
npm start
# Kill app and reinstall on phone
```

### 3. Reset Database
- Go to Supabase dashboard
- Run DATABASE_SCHEMA.sql again (clears old data)

### 4. Restart ESP32
- Press reset button on ESP32
- Wait for Serial Monitor to show startup sequence

### 5. Network Reset
- Restart phone
- Restart PC
- Restart WiFi router
- Reconnect all devices

---

## 📞 Detailed Guides

For comprehensive solutions, see:

| Issue | Guide |
|-------|-------|
| Google Login | [FIREBASE_SETUP_GUIDE.md](FIREBASE_SETUP_GUIDE.md) |
| Android | [ANDROID_TESTING_GUIDE.md](ANDROID_TESTING_GUIDE.md) |
| Network | [NETWORK_TROUBLESHOOTING_GUIDE.md](NETWORK_TROUBLESHOOTING_GUIDE.md) |
| Device Auth | [DEVICE_PROVISIONING_GUIDE.md](DEVICE_PROVISIONING_GUIDE.md) |
| ESP32 | [ESP32_SETUP_GUIDE.md](ESP32_SETUP_GUIDE.md) |
| Backend | [BACKEND_DEPLOYMENT_GUIDE.md](BACKEND_DEPLOYMENT_GUIDE.md) |
| Complete System | [ROMERS_VENDO_COMPLETE_FIX_GUIDE.md](ROMERS_VENDO_COMPLETE_FIX_GUIDE.md) |
| Testing | [END_TO_END_TESTING_GUIDE.md](END_TO_END_TESTING_GUIDE.md) |

---

## ✅ Success Indicators

Your system is working when:

✓ App opens without crashing
✓ Can login with email/password
✓ Can login with Google
✓ Device authentication succeeds
✓ Relay activates when commanded
✓ Coins detected and credits updated
✓ All data in Supabase current
✓ No errors in any logs
✓ Network connectivity stable
✓ Backend responds < 200ms

---

## 📊 Common Causes of Errors

| Error | Usual Cause | Fix |
|-------|------------|-----|
| Connection timeout | Backend not running or wrong IP | Start backend, update IP in .env |
| Authentication failed | Wrong credentials | Verify Device ID/Secret match |
| CORS error | Backend CORS_ORIGINS not set | Update .env CORS_ORIGINS |
| 404 Not Found | Wrong API endpoint | Check endpoint URL |
| Firebase error | Config missing | Add firebase config to .env |
| Network unreachable | Wrong WiFi | Check WiFi connection |
| Permission denied | Android permissions | Add INTERNET permission to manifest |

---

**Can't find your issue?** Check the comprehensive guides listed above. Each has a detailed troubleshooting section.

**Still stuck?** Make sure you:
1. Followed the guide step-by-step
2. Verified all configuration values
3. Checked all logs
4. Tested each component individually

Good luck! 🚀
