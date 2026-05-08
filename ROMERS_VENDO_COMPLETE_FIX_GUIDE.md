# Romers Vendo IoT System - Complete Fix Guide

## Overview
This guide provides step-by-step instructions to fully debug, fix, and deploy the Romers Vendo app with complete Device ID/Device Secret authentication system.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Android Connection Issues & Solutions](#android-connection-issues)
3. [Network Configuration](#network-configuration)
4. [Google Sign-In Setup](#google-sign-in-setup)
5. [Firebase Configuration](#firebase-configuration)
6. [Backend Setup](#backend-setup)
7. [ESP32 Device Integration](#esp32-device-integration)
8. [Mobile App Configuration](#mobile-app-configuration)
9. [Testing on Physical Device](#testing-on-physical-device)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Components
```
┌─────────────────────────────────────────────────────────────┐
│                    Internet / Cloud                         │
│  (Optional: Deployed Backend URL for Production)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    [WiFi]         [WiFi]         [WiFi]
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌──────────────┐
   │  Phone  │  │   PC     │  │   ESP32      │
   │  (App)  │  │(Backend) │  │  (Device)    │
   └────┬────┘  └────┬─────┘  └──────┬───────┘
        │             │               │
        └─────────────┼───────────────┘
              LAN WiFi Network
```

### Authentication Flow
```
1. User Authentication (Firebase)
   Phone → Firebase Auth (Email/Google) → Firebase stores user profile

2. Device Authentication (Device ID/Device Secret)
   Phone → Backend (Device ID + Device Secret) → JWT Token
   ESP32 → Backend (Device ID + Device Secret) → JWT Token

3. Secure Communication
   Phone/ESP32 → Backend (with JWT Token) → Authenticated API Calls
```

---

## Android Connection Issues & Solutions

### Why Localhost Doesn't Work on Android
**Problem:**
- `http://localhost:8080` or `http://127.0.0.1:8080` is a loopback address
- Each device has its own loopback interface
- Phone cannot access PC's localhost

**Solution:**
Use one of these approaches:
1. **LAN IP** (for testing): `http://192.168.x.x:8080`
2. **Deployed URL** (for production): `https://api.example.com`
3. **Ngrok** (for quick testing): `https://abc123.ngrok.io`

### Android Specific Issues

#### Issue 1: Metro Bundler Not Reachable
**Symptom:** "Metro bundler unavailable" error
**Solutions:**
- Ensure phone and PC are on same WiFi
- PC must not have firewall blocking port 8081
- Phone must have Developer Mode enabled
- Use `adb reverse tcp:8081 tcp:8081` for USB connection

#### Issue 2: CORS Errors
**Symptom:** "CORS policy: No 'Access-Control-Allow-Origin' header"
**Solutions:**
- Backend CORS configuration must include phone's origin
- For LAN testing: Add `http://192.168.x.x:19000` to CORS origins
- Backend already has proper CORS setup

#### Issue 3: Cleartext HTTP Traffic
**Symptom:** "Cleartext traffic to `api.example.com` not permitted"
**Solutions:**
- Use HTTPS in production
- For local testing: Create `android/app/src/main/AndroidManifest.xml` with proper network security config

#### Issue 4: Firebase Configuration Wrong
**Symptom:** "google-services.json not found or misconfigured"
**Solutions:**
- Download correct `google-services.json` from Firebase
- Must match Android package name: `com.romersvendo`
- Place in `android/app/google-services.json`

#### Issue 5: Google Sign-In Native Module Missing
**Symptom:** "Native module @react-native-google-signin/google-signin not found"
**Solutions:**
- Must use Expo dev build (not Expo Go)
- Must generate SHA-1 and SHA-256 fingerprints
- Must add fingerprints to Firebase OAuth configuration

---

## Network Configuration

### For LAN Testing (PC and Phone on Same WiFi)

#### Step 1: Find Your PC's IP Address
```bash
# Windows
ipconfig

# Look for IPv4 Address under your WiFi adapter
# Example: 192.168.0.100
```

#### Step 2: Update Environment Variables
Create `.env` file in `iot-backend/`:
```env
PORT=8080
NODE_ENV=development
CORS_ORIGINS=http://192.168.0.100:19000,http://192.168.0.100:19001,http://localhost:19000
# ... other variables
```

#### Step 3: Update App Configuration
Create `.env.local` in `myApp/`:
```env
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080
EXPO_PUBLIC_DEVICE_BACKEND_URL=http://192.168.0.100:8080
EXPO_PUBLIC_FIREBASE_API_KEY=...
# ... other variables
```

#### Step 4: Ensure Backend is Accessible
```bash
# Run backend
cd iot-backend
npm install
npm run dev

# Test from another machine
curl http://192.168.0.100:8080/health
# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

#### Step 5: Configure Phone
- Connect to same WiFi as PC
- Enable Developer Mode
- Allow local network access in app settings

### For Production Deployment

1. Deploy backend to cloud (Heroku, AWS, Azure, etc.)
2. Update CORS_ORIGINS to production domain
3. Use HTTPS only
4. Update app environment to production URL

---

## Google Sign-In Setup

### Step 1: Generate Android SHA Keys

```bash
# Find your keystore
cd myApp/android
find . -name "*.jks" -o -name "debug.keystore"

# If no keystore exists, create one
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000

# Get SHA-1
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android

# Get SHA-256
keytool -list -v -keystore "C:\Users\[YOUR_USER]\.android\debug.keystore" -storepass android -alias androiddebugkey
# (Windows path for default keystore)
```

### Step 2: Add Keys to Firebase

1. Go to Firebase Console → Project Settings
2. Go to Android apps section
3. Add both SHA-1 and SHA-256 fingerprints
4. Download updated `google-services.json`
5. Place in `myApp/android/app/google-services.json`

### Step 3: Verify OAuth Configuration

In Firebase Console → Authentication → Sign-in Method:
- Ensure Google is enabled
- Check that the Android package name matches: `com.romersvendo`
- Verify both SHA keys are added

### Step 4: Configure Google Sign-In

The app already has `@react-native-google-signin/google-signin` installed.
Make sure `lib/firebase.ts` has correct webClientId:
```typescript
webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '807423195952-aoq1ge24jrfr0ic7ral9m2r2imeh14aj.apps.googleusercontent.com'
```

---

## Firebase Configuration

### Verify Your Firebase Project

1. Go to https://console.firebase.google.com
2. Select your project: `esp-32-iot-39bd2`
3. Go to Project Settings
4. Verify these keys match your `firebaseConfig` in `lib/firebase.ts`:
   - projectId
   - apiKey
   - authDomain
   - messagingSenderId
   - appId

### Enable Required Authentication Methods

1. Go to Authentication → Sign-in Method
2. Enable:
   - Email/Password
   - Google
   - Anonymous (optional, for testing)

### Setup Firestore Database

1. Go to Firestore Database
2. Create database in Production mode
3. Create collection `users` with document rules:
```
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

---

## Backend Setup

### Key Components

1. **Device Provisioning**: Create Device ID + Device Secret
2. **Device Authentication**: Verify credentials and issue JWT tokens
3. **Secure Communication**: All API calls require valid JWT
4. **Transaction Logging**: Record all vendo transactions

### Installation & Setup

```bash
cd iot-backend
npm install
```

### Configuration

Create `.env` file:
```env
# Server
PORT=8080
NODE_ENV=development

# Supabase (PostgreSQL Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# JWT
JWT_SECRET=your-super-secure-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# Provisioning
PROVISIONING_KEY=your-provisioning-secret-key

# CORS
CORS_ORIGINS=http://192.168.0.100:19000,http://localhost:8080

# Bcrypt
BCRYPT_ROUNDS=12
```

### Database Schema

The system uses Supabase PostgreSQL with these tables:

```sql
-- Devices Table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT UNIQUE NOT NULL,
  device_secret_hash TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'active',
  name TEXT,
  device_name TEXT,
  last_ip TEXT,
  last_seen TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  transaction_id TEXT UNIQUE,
  credits_added NUMERIC DEFAULT 0,
  pulse_count INTEGER DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'coin',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
```

### API Endpoints

#### User Authentication (Firebase Handles This)
```
POST /api/register          (Firebase)
POST /api/login             (Firebase)
POST /logout                (Firebase)
```

#### Device Management
```
POST /api/devices/provision
  Headers: X-Provisioning-Key: <key>
  Body: { device_id, device_secret, owner?, name? }
  Returns: { device }

POST /api/device/login (Mobile App)
  Body: { deviceId, deviceSecret }
  Returns: { token, device }

POST /api/device/connect (ESP32)
  Body: { deviceId, deviceSecret } OR Headers: X-Device-ID, X-Device-Secret
  Returns: { token, device }

POST /api/devices/heartbeat (ESP32 with Token)
  Headers: Authorization: Bearer <token>
  Body: { transactionId?, creditsAdded?, ... }
  Returns: { ok: true }

GET /api/devices/:deviceId (Mobile App with Token)
  Headers: Authorization: Bearer <token>
  Returns: { device }

POST /api/devices/:deviceId/commands (Mobile App with Token)
  Headers: Authorization: Bearer <token>
  Body: { command, ... }
  Returns: { ok: true }
```

---

## ESP32 Device Integration

### Device ID & Device Secret System

**Device ID** (Public)
- Uniquely identifies the device
- Shared between ESP32 and Backend
- Stored in ESP32 firmware
- Example: `romers_001`, `vendo_kitchen_1`

**Device Secret** (Private)
- Cryptographic token to verify device
- NEVER transmitted in plain text
- Only stored in:
  1. ESP32 firmware (once, during provisioning)
  2. Backend database (hashed with bcrypt)
- At least 32 characters

### Provisioning Process

#### Step 1: Generate Device Credentials
```bash
# Run this on your PC (or use online generator)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456... (64 hex characters = 32 bytes)
```

#### Step 2: Provision Device in Backend
```bash
curl -X POST http://localhost:8080/api/devices/provision \
  -H "Content-Type: application/json" \
  -H "X-Provisioning-Key: your-provisioning-key" \
  -d '{
    "device_id": "romers_001",
    "device_secret": "abc123def456...",
    "owner": "romer.santos@example.com",
    "name": "Main Vendo"
  }'
```

#### Step 3: Store in ESP32
Add to ESP32 firmware:
```cpp
// Device Credentials (Set during provisioning)
const char* DEVICE_ID = "romers_001";
const char* DEVICE_SECRET = "abc123def456...";
const char* BACKEND_URL = "http://192.168.0.100:8080";
```

### Updated ESP32 Code Structure

See updated ESP32 firmware files in the codebase for complete implementation.

---

## Mobile App Configuration

### Environment Variables

Create `myApp/.env` file:
```env
# Backend
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyCtLJvzqp1HM9hxFjumNGbJx83l2amkbJQ
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=esp-32-iot-39bd2.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=esp-32-iot-39bd2
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=esp-32-iot-39bd2.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=807423195952
EXPO_PUBLIC_FIREBASE_APP_ID=1:807423195952:web:1a53f5650e7ebf21d08370

# Google Sign-In
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=807423195952-aoq1ge24jrfr0ic7ral9m2r2imeh14aj.apps.googleusercontent.com
```

### Android Package Name
Update in `myApp/app.json`:
```json
{
  "expo": {
    "name": "Romers Vendo",
    "slug": "romers-vendo",
    "plugins": [
      "@react-native-google-signin/google-signin"
    ],
    "android": {
      "package": "com.romersvendo",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "versionCode": 1
    }
  }
}
```

### Android Permissions & Security

Verify `myApp/android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.CHANGE_NETWORK_STATE"/>
```

---

## Testing on Physical Device

### Prerequisites
- Phone with Android 11+ (API level 30+)
- Same WiFi network as PC
- USB cable for ADB debugging
- Android Studio or Android SDK tools

### Method 1: Development Build (Recommended)

```bash
cd myApp

# Install dependencies
npm install

# Build development client
eas build --platform android --profile preview

# Or use local build
expo run:android

# When app opens, scan Expo QR code or manually enter PC IP
# Format: exp://192.168.0.100:19000
```

### Method 2: Production APK

```bash
cd myApp

# Build production APK
eas build --platform android --profile production

# Or local build
npm run android

# Install APK
adb install app-release.apk
```

### Method 3: Expo Go (Limited)

```bash
# Install Expo Go from Play Store
# Open Expo Go and scan QR code

# Note: Some native modules may not work in Expo Go
```

### Testing Checklist

- [ ] App opens without errors
- [ ] User can login with email
- [ ] User can login with Google
- [ ] User can create account
- [ ] Backend API calls work (check network tab)
- [ ] Device connection succeeds
- [ ] Coin pulses are registered
- [ ] Timer counts down correctly
- [ ] Relay activates/deactivates

---

## Deployment

### Backend Deployment Options

#### Option 1: Heroku (Simple, Free Tier Deprecated)
```bash
# Create account at heroku.com
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create romers-vendo-api

# Set environment variables
heroku config:set PORT=8080 SUPABASE_URL=... JWT_SECRET=...

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

#### Option 2: Railway.app (Recommended)
1. Sign up at railway.app
2. Connect GitHub repo
3. Create PostgreSQL database (Railway Supabase integration)
4. Set environment variables in Railway dashboard
5. Deploy automatically on push

#### Option 3: AWS / Azure / Google Cloud
See their respective documentation for Node.js deployment.

### Mobile App Deployment

#### Option 1: Google Play Store
```bash
cd myApp
eas build --platform android --profile production
eas submit --platform android --latest

# Follow prompts to upload to Play Store
```

#### Option 2: Direct APK Distribution
```bash
# Build production APK
eas build --platform android --profile production

# Download APK and distribute directly
# Users install via ADB or sideloading
```

---

## Troubleshooting

### "Cannot connect to backend"

**Check:**
1. Backend running: `curl http://192.168.0.100:8080/health`
2. PC IP correct in `.env`
3. Phone on same WiFi
4. Firewall not blocking port 8080
5. PC firewall exception for Node.js

**Fix:**
```bash
# Restart backend
cd iot-backend
npm run dev

# Check logs for errors
# Verify IP: ipconfig (Windows) or ifconfig (Mac/Linux)
# Update .env with correct IP
```

### "Google Sign-In Failed"

**Check:**
1. SHA-1 and SHA-256 added to Firebase
2. Android package name correct in app.json
3. google-services.json downloaded and placed correctly
4. Using Expo dev build (not Go)
5. Google enabled in Firebase Auth

**Fix:**
```bash
# Regenerate debug keystore
rm ~/.android/debug.keystore
keytool -genkey -v -keystore ~/.android/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000

# Get new SHA keys and update Firebase
keytool -list -v -keystore ~/.android/debug.keystore

# Rebuild app
eas build --platform android --profile preview
```

### "Metro Bundler Unavailable"

**Check:**
1. Expo dev server running on PC
2. Phone can access PC (ping test)
3. Port 8081 not blocked by firewall
4. Correct IP in Expo URL

**Fix:**
```bash
# Manual reverse for USB
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080

# Or use PC IP explicitly
# Manual URL: exp://192.168.0.100:19000
```

### "Device Authentication Fails"

**Check:**
1. Device ID matches exactly
2. Device Secret matches exactly
3. Device status is 'active' in database
4. Backend .env has correct SUPABASE_URL and keys

**Fix:**
```bash
# Check device in database
curl -X GET http://192.168.0.100:8080/api/devices/romers_001 \
  -H "Authorization: Bearer <test-token>"

# Verify provisioning
curl -X POST http://192.168.0.100:8080/api/devices/provision \
  -H "X-Provisioning-Key: test-key" \
  -d '{"device_id":"test","device_secret":"test123..."}'
```

### "AsyncStorage / Session Token Errors"

**Check:**
1. Device successfully authenticated
2. Token stored in AsyncStorage
3. Token not expired
4. Token valid JWT format

**Fix:**
```typescript
// Clear all app data
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();

// Restart app and re-authenticate
```

---

## Quick Reference

### Key Files Modified/Created
```
iot-backend/
  ├── .env (create)
  ├── src/
  │   ├── app.js (updated)
  │   ├── server.js (updated)
  │   └── ... (other files)

myApp/
  ├── .env (create)
  ├── app.json (update package name)
  ├── lib/
  │   ├── firebase.ts (verify)
  │   ├── auth.ts (verify/update)
  │   └── iot-backend-api.ts (verify)
  ├── app/
  │   ├── login.tsx (verify)
  │   ├── register.tsx (verify)
  │   └── ... (other screens)
  └── android/
      └── app/
          ├── google-services.json (download from Firebase)
          └── src/main/AndroidManifest.xml (verify)

esp32/
  └── esp32.ino (update with Device ID/Secret)
```

### Essential Commands

```bash
# Backend
cd iot-backend
npm install
npm run dev                    # Development
npm start                      # Production

# Frontend
cd myApp
npm install
expo run:android              # Local build
eas build --platform android  # Cloud build

# Testing
curl http://192.168.0.100:8080/health
curl -X POST http://192.168.0.100:8080/api/device/login \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"romers_001","deviceSecret":"..."}'
```

---

## Next Steps

1. ✅ Read this entire guide
2. ⬜ Follow Network Configuration section
3. ⬜ Setup Firebase and Google Sign-In
4. ⬜ Configure and start backend
5. ⬜ Update mobile app configuration
6. ⬜ Update and provision ESP32
7. ⬜ Test on physical device
8. ⬜ Deploy to production

**You're now ready to fully debug and fix your Romers Vendo system!**
