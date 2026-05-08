# Network Troubleshooting Guide

## Understanding the Network Architecture

```
┌──────────────────────────────────────────────────────┐
│              WiFi Network (LAN)                      │
│                                                      │
│  ┌──────────────────┐         ┌──────────────────┐ │
│  │    Phone         │         │    PC (Backend)  │ │
│  │ 192.168.0.50     │◄──────►│ 192.168.0.100    │ │
│  └──────────────────┘         └──────────────────┘ │
│         │                              │            │
│         │ Expo Dev Server              │ Express    │
│         │ Port 19000, 19001            │ Port 8080  │
│         │                              │            │
│         └──────────────────────────────┘            │
│                                                      │
└──────────────────────────────────────────────────────┘
        ↓ Firewall boundaries
     (Internet)
```

---

## Part 1: Basic Connectivity

### Step 1: Verify WiFi Network

**Phone:**
```
Settings → WiFi → [Connected network name]
Note the network name (SSID)
Note the IP address
```

**PC (Windows):**
```bash
ipconfig
# Look for your WiFi adapter (e.g., "Wireless LAN adapter WiFi")
# Note the IPv4 Address (e.g., 192.168.0.100)
# Note the Subnet Mask
```

**PC (Mac/Linux):**
```bash
ifconfig | grep -A 4 "en0\|wlan0"
# Look for "inet" address (e.g., 192.168.0.100)
```

### Step 2: Verify Same Network

**Example:**
```
Phone IP: 192.168.0.50
PC IP: 192.168.0.100
WiFi SSID: "MyWiFi"

✅ Both on "MyWiFi"
✅ Same subnet (192.168.0.x)
✅ Can proceed
```

**If Different:**
- Connect phone to same WiFi as PC
- If using hotspot, make sure both connected to same hotspot
- Check firewall isn't isolating networks

### Step 3: Ping Test

**From Phone (using terminal app or adb):**
```bash
# Via ADB
adb shell ping -c 4 192.168.0.100

# Should see:
# 64 bytes from 192.168.0.100: icmp_seq=1 ttl=64 time=...
# 4 packets transmitted, 4 packets received, 0% packet loss
```

**From PC:**
```bash
# Windows
ping 192.168.0.50

# Mac/Linux
ping -c 4 192.168.0.50

# Should see successful responses
```

---

## Part 2: Backend Connectivity

### Test Backend Health

**From PC:**
```bash
curl http://localhost:8080/health
# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

**From Phone (via adb):**
```bash
adb shell curl http://192.168.0.100:8080/health
# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

**From PC to Phone's Backend:**
```bash
# If running backend on phone (unlikely)
curl http://192.168.0.50:8080/health
```

### If Health Check Fails

**Check 1: Backend Running?**
```bash
cd iot-backend
npm run dev
# Should see: "Server running on port 8080"
```

**Check 2: Port Open?**
```bash
# Windows (check what's listening on port 8080)
netstat -ano | findstr :8080

# Mac/Linux
lsof -i :8080

# Should show Node.js process
```

**Check 3: Firewall Blocking?**
```bash
# Windows: Add Node.js to Firewall
# Settings → Privacy & Security → Firewall & network protection
# → Allow an app through firewall
# → Check Node.js is allowed
# → Check both Private and Public

# Mac: System Preferences → Security & Privacy → Firewall Options
# → Add node to allowed apps

# Linux
sudo ufw status
sudo ufw allow 8080
```

**Check 4: Correct IP?**
```bash
# Verify you're using PC's actual IP, not localhost
# localhost = 127.0.0.1 = loopback (only on your machine)
# Phone can't access your machine's localhost

ipconfig | findstr "IPv4"
# Use this IP in .env: EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080
```

---

## Part 3: Expo Dev Server Connectivity

### Expose Metro Bundler

**Problem:** Phone can't reach Expo dev server on PC

**Solution 1: Reverse Port Forwarding (USB)**
```bash
adb reverse tcp:19000 tcp:19000
adb reverse tcp:19001 tcp:19001
adb reverse tcp:8081 tcp:8081

# Now phone can access:
# http://localhost:19000 = PC's Expo server
```

**Solution 2: Use PC IP Directly**
```bash
# In Expo Go or after npm start
# Enter: exp://192.168.0.100:19000

# Or in terminal after npm start
# Press 'a' to launch on Android
# Expo automatically detects IP
```

**Solution 3: Check Firewall**
```bash
# Windows Firewall must allow Node.js (Expo uses it)
# Follow Firewall instructions in Part 2, Check 3
```

### Test Expo Dev Server

**From PC:**
```bash
curl http://localhost:19000
# Should return HTML with "Expo Go"
```

**From Phone (after port reverse):**
```bash
adb shell curl http://localhost:19000
```

---

## Part 4: Device Authentication Flow

### Scenario: App Can't Connect to Device

**Steps to Debug:**

1. **Verify Backend API Works:**
   ```bash
   curl -X POST http://192.168.0.100:8080/api/device/login \
     -H "Content-Type: application/json" \
     -d '{"deviceId":"test_device","deviceSecret":"test_secret_at_least_32_characters_long"}'
   
   # Should return: {"ok":true,"token":"...","device":{...}}
   ```

2. **Check Device Provisioned:**
   ```bash
   # Device must exist in database
   # Check Supabase dashboard → devices table
   # Verify device_id matches exactly (case-sensitive)
   # Verify status is 'active'
   ```

3. **Check Credentials Match:**
   ```bash
   # In Supabase:
   # - device_id must match (e.g., "romers_001")
   # - device_secret_hash must match original secret
   # - Original secret needed because hash is irreversible
   ```

4. **Check Backend Logs:**
   ```bash
   # Backend terminal should show:
   # POST /api/device/login 200
   # If you see 401 or 400:
   #   401 = Wrong credentials
   #   400 = Missing fields
   ```

5. **Check Phone Logs:**
   ```bash
   adb logcat | grep -i "device\|auth\|error"
   
   # Look for:
   # - "authenticateDevice"
   # - "token received"
   # - "Failed to authenticate"
   ```

---

## Part 5: CORS Issues

### Understanding CORS

```
Phone App (http://192.168.0.50:19000)
             ↓
Browser/Mobile makes request to
             ↓
Backend API (http://192.168.0.100:8080)
             ↓
Backend checks: Is origin http://192.168.0.50:19000 allowed?
             ↓
If not in CORS_ORIGINS → Error: "No Access-Control-Allow-Origin header"
```

### Fix CORS Errors

1. **Get Phone's Expo Port:**
   ```bash
   # When npm start runs, look for the URL
   # Example: http://192.168.0.50:19000
   # Extract: 192.168.0.50:19000
   ```

2. **Update Backend .env:**
   ```env
   CORS_ORIGINS=http://localhost:19000,http://192.168.0.100:19000,http://192.168.0.50:19000
   ```

3. **Restart Backend:**
   ```bash
   cd iot-backend
   npm run dev
   ```

### Verify CORS

```bash
curl -X OPTIONS http://192.168.0.100:8080/api/device/login \
  -H "Origin: http://192.168.0.50:19000" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should see: Access-Control-Allow-Origin: http://192.168.0.50:19000
```

---

## Part 6: DNS and Hostname Issues

### Problem: "Can't reach 192.168.0.100"

**Cause:** IP address changed

**Solution:**
```bash
# PC IP can change if router restarts
# Check current IP
ipconfig

# Update all .env files:
# myApp/.env
# iot-backend/.env

# Restart services
# 1. Backend
# 2. Expo dev server
# 3. Reconnect phone
```

### Static IP (Better Solution)

**Windows:**
```
Settings → Network → Advanced network settings
→ More options → Change adapter options
→ Right-click WiFi adapter → Properties
→ IPv4 Properties → Use fixed IP
```

**Mac:**
```
System Preferences → Network → WiFi → Advanced
→ TCP/IP → Configure IPv4 → Manually
→ Set IP to 192.168.0.100 (or similar)
```

**Linux:**
```bash
# Edit /etc/netplan/... or /etc/network/interfaces
# Set static IP for your interface
# See your distro's documentation
```

**Router Level (Best):**
- Access router admin (usually 192.168.0.1)
- Go to DHCP settings
- Set MAC address of PC to always get same IP
- Reserve IP 192.168.0.100

---

## Part 7: Phone Network Issues

### WiFi Problems

**Can't Connect to WiFi:**
- Check SSID is visible
- Check password correct
- Forget network and reconnect
- Restart WiFi on phone

**Connected but No Internet:**
- Check PC has internet
- Not all WiFi require internet (LAN testing is fine)
- Backend doesn't need internet

**Slow Connection:**
- Check WiFi signal (Settings → WiFi)
- Move closer to router
- Reduce interference (move away from microwave)
- Check if other apps using WiFi

### Mobile Data Issues

**If Phone Uses Mobile Data Instead of WiFi:**
- Settings → WiFi → Connect to your WiFi
- Settings → Developer Options → Disable mobile data
- Or just use WiFi testing

---

## Part 8: Complete Connectivity Checklist

### Before Testing, Verify All:

- [ ] Phone and PC connected to same WiFi
- [ ] PC IP address noted (e.g., 192.168.0.100)
- [ ] Backend .env has correct IP in CORS_ORIGINS
- [ ] Backend running: `npm run dev`
- [ ] Backend health check works: `curl http://192.168.0.100:8080/health`
- [ ] Phone can ping PC: `adb shell ping 192.168.0.100`
- [ ] Firewall allows Node.js on port 8080
- [ ] myApp/.env has correct EXPO_PUBLIC_IOT_BACKEND_URL
- [ ] Expo dev server running: `npm start`
- [ ] Port reverse forwarding active: `adb reverse tcp:19000 tcp:19000`
- [ ] App opens in Expo/APK
- [ ] Can login
- [ ] Can authenticate device
- [ ] Backend logs show requests from phone

---

## Part 9: Emergency Troubleshooting

### Everything Broken - Start Fresh

```bash
# 1. Get PC IP
ipconfig

# 2. Kill all Node processes
taskkill /F /IM node.exe  (Windows)
killall node  (Mac/Linux)

# 3. Clear phone cache
adb shell pm clear com.romersvendo

# 4. Restart ADB
adb kill-server
adb start-server

# 5. Update .env files with correct IP
# myApp/.env
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080

# iot-backend/.env
CORS_ORIGINS=http://192.168.0.100:19000

# 6. Start backend
cd iot-backend
npm install
npm run dev

# 7. Start app
cd myApp
npm install
npm start

# 8. Connect phone
adb reverse tcp:19000 tcp:19000
adb reverse tcp:8080 tcp:8080

# 9. Scan QR code in Expo
# 10. Test connectivity
```

---

## Quick Reference

**Common Issues and One-Line Fixes**

```bash
# Can't reach backend
ipconfig  # Get PC IP, update .env

# Firewall blocking
# Add Node.js to Windows Firewall exceptions

# Metro bundler unavailable
adb reverse tcp:19000 tcp:19000

# CORS error
# Add phone:port to CORS_ORIGINS in backend .env

# Wrong IP
# Update all .env files with ipconfig result

# Port already in use
netstat -ano | findstr :8080  # Find process
taskkill /F /PID <PID>        # Kill process

# App won't start
adb shell pm clear com.romersvendo

# Device not found in database
# Provision device via backend /api/devices/provision
```

---

## Testing Endpoints

```bash
# Health check
curl http://192.168.0.100:8080/health

# Login device
curl -X POST http://192.168.0.100:8080/api/device/login \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"romers_001","deviceSecret":"your_secret"}'

# Heartbeat
curl -X POST http://192.168.0.100:8080/api/devices/heartbeat \
  -H "Authorization: Bearer TOKEN_FROM_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{"credits":100,"remainingTime":300}'
```

---

## Advanced Debugging

### Network Packet Capture

```bash
# Capture all phone traffic
adb shell tcpdump -i any -s 0 -w /sdcard/capture.pcap

# Pull capture file
adb pull /sdcard/capture.pcap

# Open in Wireshark
# Filter: "http" or "tcp.port == 8080"
```

### Proxy Traffic Through PC

1. Install Charles Proxy or Burp Suite
2. Configure phone WiFi to use PC as HTTP proxy
3. See all requests/responses
4. Check headers, bodies, errors

---

## Next Steps

1. ✅ Verify WiFi connectivity
2. ✅ Verify backend running
3. ✅ Verify firewall allows traffic
4. ✅ Test endpoints with curl
5. ✅ Verify .env files correct
6. ✅ Connect phone and test app
7. ⬜ Fix any remaining issues
8. ⬜ Deploy to production

**Still having issues?** Check the specific guides:
- FIREBASE_SETUP_GUIDE.md
- ANDROID_TESTING_GUIDE.md
- ROMERS_VENDO_COMPLETE_FIX_GUIDE.md
