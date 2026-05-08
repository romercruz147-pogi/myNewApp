# Android Testing Guide for Romers Vendo

## Prerequisites

- Android phone with Android 11+ (API level 30+)
- USB cable (recommended for debugging)
- Android Studio OR Android SDK Command Line Tools
- PC and phone on same WiFi network

---

## Part 1: Setup Android Development Environment

### Install Android SDK Tools

**Option A: Android Studio (Easiest)**
1. Download from https://developer.android.com/studio
2. Install and open
3. Go to **SDK Manager** → **SDK Tools**
4. Install:
   - Android SDK Platform Tools
   - Android SDK Build-Tools (latest)
   - Android Emulator (if you want emulator)
5. Accept Android SDK License

**Option B: Command Line Only**
1. Download command-line tools from https://developer.android.com/studio
2. Extract to a folder
3. Run:
   ```bash
   sdkmanager --licenses  # Accept all licenses
   sdkmanager "platform-tools"
   sdkmanager "build-tools;34.0.0"
   ```

### Setup ADB (Android Debug Bridge)

Add to your system PATH:
- Windows: `C:\Users\[YourUsername]\AppData\Local\Android\Sdk\platform-tools`
- Mac: `~/Library/Android/sdk/platform-tools`
- Linux: `~/Android/Sdk/platform-tools`

Test installation:
```bash
adb version
# Should show: Android Debug Bridge version ...
```

---

## Part 2: Enable Developer Mode on Phone

1. Open **Settings**
2. Go to **About phone**
3. Find "Build number"
4. Tap it **7 times**
5. You'll see message "You are now a developer"
6. Go to **Settings** → **System** → **Developer options** (or similar)
7. Enable:
   - **Developer mode / USB debugging**
   - **Wireless debugging** (optional, for WiFi connection)
   - **Allow USB debugging from this computer**
   - **Allow mock locations** (for testing)

---

## Part 3: Connect Phone to PC

### Method 1: USB Connection (Recommended for Debugging)

1. Connect phone to PC with USB cable
2. On phone: Select "File Transfer" mode (if prompted)
3. On PC, open terminal:
   ```bash
   adb devices
   ```
4. You should see:
   ```
   List of attached devices
   12AB3CD456  device
   ```

If you see "unauthorized":
- Phone will show "Allow USB debugging?" dialog
- Tap **Allow** and check "Always allow from this computer"
- Run `adb devices` again

### Method 2: Wireless Connection (For Testing on WiFi)

1. Connect phone to PC with USB first
2. In terminal:
   ```bash
   # Get phone's IP
   adb shell ip addr show | grep "inet " | head -1
   # Output: inet 192.168.0.50/24 ...
   
   # Enable wireless debugging
   adb tcpip 5555
   
   # Disconnect USB
   ```
3. Now phone is in wireless mode:
   ```bash
   adb connect 192.168.0.50:5555
   
   # Verify
   adb devices
   ```

---

## Part 4: Build and Install Romers Vendo App

### Using Development Build (Recommended)

```bash
cd myApp

# Install dependencies
npm install

# Build development client for Android
eas build --platform android --profile preview

# When build completes, download APK
# Install on phone
adb install -r path/to/app-release.apk

# Or use direct install
eas build --platform android --profile preview --wait
# Follow prompts to auto-install
```

### Using Local Build (Requires Native Build Tools)

```bash
cd myApp

npm install

# Build locally
npm run android
# or
expo run:android

# Follow prompts
# Expo will build, compile, and install on connected phone
```

### Fallback: Build APK Manually

```bash
cd myApp/android

# Build debug APK
./gradlew assembleDebug

# Install
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Or build release APK (requires keystore)
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## Part 5: Run App on Phone

### First Launch with Expo Dev Server

```bash
cd myApp

# Start Expo dev server on PC
npm start

# You'll see QR code in terminal
# On phone:
# 1. Press 'a' in terminal to open on Android
# OR
# 2. Open Expo Go app on phone (download from Play Store)
# 3. Scan the QR code
# 4. Wait for app to load
```

### Connect Phone to Dev Server

If Metro bundler doesn't connect automatically:

**Via USB Reverse Forwarding:**
```bash
adb reverse tcp:19000 tcp:19000
adb reverse tcp:19001 tcp:19001
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
```

**Via Manual URL:**
```
exp://192.168.0.100:19000
```
(Replace 192.168.0.100 with your PC's IP)

Enter this in Expo Go:
- Open Expo Go app
- Tap "Scan QR code" or "Enter URL"
- Paste the URL
- Press Enter

---

## Part 6: Testing Checklist

### App Opens
- [ ] App launches without crashes
- [ ] Shows login screen
- [ ] No "Metro bundler unavailable" error
- [ ] No permission errors

### User Authentication
- [ ] Email/password login works
- [ ] Account creation works
- [ ] Google login works (shows Google dialog)
- [ ] Can navigate after login

### Device Connection
- [ ] Can enter Device ID
- [ ] Can enter Device Secret
- [ ] Backend connection succeeds
- [ ] Sees connected device info

### Vendo Functionality
- [ ] Coin pulses register
- [ ] Timer counts down
- [ ] Relay turns on/off
- [ ] Money/credit updates show
- [ ] Sales/earnings log

### Network
- [ ] Requests show in backend logs
- [ ] Device IP appears in backend
- [ ] No CORS errors in console
- [ ] No "cleartext traffic" errors

---

## Part 7: Debugging on Device

### View Console Logs

**Method 1: Via Expo CLI**
```bash
cd myApp

# Start Expo dev server
npm start

# Press 'shift + m' to see more commands
# Press 'j' to view logs in debugger
```

**Method 2: Via Android Studio**
1. Open Android Studio
2. Go to **Tools** → **Device Manager**
3. Click device
4. Click **Logcat** tab
5. Run app
6. Filter by "React"

**Method 3: Via adb**
```bash
adb logcat | grep -i "react\|error\|warn"

# Or save to file
adb logcat > logs.txt

# View JS errors
adb logcat | grep "E  ReactNativeJS"
```

### View Network Requests

**Option 1: Backend Logs**
```bash
# Backend terminal will show all requests
# Look for logs from phone's IP
```

**Option 2: Network Monitor (Chrome DevTools)**
```bash
cd myApp
npm start

# Press 'shift + d' in terminal
# Open http://localhost:19000 in browser
# Go to Chrome DevTools
# Check Network tab
```

**Option 3: Burp Suite or Charles Proxy**
- Setup phone to use proxy
- Intercept all HTTPS/HTTP traffic
- See exactly what app is sending/receiving

---

## Part 8: Common Issues and Solutions

### "Metro Bundler Unavailable"

**Cause:** Phone can't reach dev server on PC

**Solutions:**
```bash
# Check PC IP
ipconfig (Windows) or ifconfig (Mac/Linux)

# Update .env in myApp
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080

# Restart Expo
npm start

# Try reverse forwarding
adb reverse tcp:19000 tcp:19000
adb reverse tcp:19001 tcp:19001

# Try manual URL
exp://192.168.0.100:19000
```

### "Cannot connect to Backend API"

**Cause:** Backend not running or wrong IP

**Solutions:**
```bash
# Check backend is running
cd iot-backend
npm run dev

# Verify backend IP works
curl http://192.168.0.100:8080/health

# Check firewall
# Windows: Add Node.js to firewall exceptions
# Mac/Linux: Check with 'sudo ufw status'

# Update .env
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080

# Restart Expo
npm start
```

### "Google Sign-In Failed" / "Native Module Missing"

**Cause:** Using Expo Go instead of dev build

**Solution:** Build dev build or APK:
```bash
cd myApp
eas build --platform android --profile preview

# Or local build
npm run android
```

### "Permission Denied" or "Cleartext Traffic Not Permitted"

**Cause:** Android blocking HTTP or permissions missing

**Solutions:**
```bash
# Ensure AndroidManifest.xml has INTERNET permission
# See ANDROID_FIXES.md

# For HTTP in development, use network security config
# Already configured in android/app/src/main/AndroidManifest.xml
```

### "App Crashes on Startup"

**Steps:**
1. Check logcat for errors:
   ```bash
   adb logcat | grep -i "error\|crash\|exception"
   ```

2. Common causes:
   - Missing env variables
   - Firebase misconfiguration
   - Native module not installed
   - Incorrect package name

3. Fix:
   ```bash
   # Clear app data
   adb shell pm clear com.romeindroid.vendo
   
   # Rebuild
   npm run android
   ```

---

## Part 9: Testing on Physical Device vs Emulator

### Emulator
- **Pros:** Don't need physical device, can test multiple Android versions
- **Cons:** Slower, uses more CPU, some features don't work
- **Setup:** Android Studio → Device Manager → Create Virtual Device

### Physical Device (Recommended)
- **Pros:** Real hardware, real WiFi, real performance
- **Cons:** Need actual phone, battery drains during testing
- **Setup:** See Part 2-3 above

### For This Project: Use Physical Device
- Firebase device fingerprints must match physical device
- WiFi connectivity important for testing
- Real coin/relay hardware testing needed

---

## Part 10: Build Production APK

```bash
cd myApp

# Ensure you have release keystore
# See FIREBASE_SETUP_GUIDE.md for creating one

# Build production APK
eas build --platform android --profile production

# Or local build
cd android
./gradlew bundleRelease
./gradlew assembleRelease

# APK will be in:
# app/build/outputs/apk/release/app-release.apk

# Install on device
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## Testing Endpoints

### Test Login
```bash
# Backend must be running
curl -X POST http://192.168.0.100:8080/api/device/login \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test_001","deviceSecret":"test_secret_at_least_32_chars_long"}'
```

### Test Health
```bash
curl http://192.168.0.100:8080/health
# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

---

## Quick Reference

**Most Important Commands**
```bash
# Start dev server
npm start

# Connect phone
adb devices

# View logs
adb logcat

# Build dev APK
eas build --platform android --profile preview

# Install APK
adb install -r path/to/app.apk

# Reverse port
adb reverse tcp:19000 tcp:19000
adb reverse tcp:8080 tcp:8080
```

---

## Next Steps

1. ✅ Setup Android SDK
2. ✅ Enable developer mode
3. ✅ Connect phone
4. ✅ Build and install app
5. ✅ Run on device
6. ✅ Test all features
7. ⬜ Fix any errors (see troubleshooting)
8. ⬜ Deploy to production

**Need help?** Check ROMERS_VENDO_COMPLETE_FIX_GUIDE.md or ANDROID_FIXES.md for more details.
