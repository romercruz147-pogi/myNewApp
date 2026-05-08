# Firebase Setup Guide for Romers Vendo

## Step 1: Create/Access Firebase Project

### If You Already Have a Project
1. Go to https://console.firebase.google.com
2. Select project "esp-32-iot-39bd2"
3. Continue to next step

### If You Need to Create a New Project
1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Project name: "Romers Vendo"
4. Continue setup

---

## Step 2: Setup Firebase Authentication

### Enable Email/Password Authentication
1. In Firebase Console: **Authentication** → **Sign-in method**
2. Click **Email/Password**
3. Enable "Email/Password"
4. Click **Save**

### Enable Google Authentication
1. **Authentication** → **Sign-in method**
2. Click **Google**
3. Enable "Google"
4. Set Project name: "Romers Vendo"
5. Set Support email (your email)
6. Click **Save**

### Add Android App to Firebase
1. **Project Settings** (⚙️ icon top-left)
2. Click **Add App** → **Android**
3. Fill in:
   - **Android package name**: `com.romersvendo`
   - **App nickname**: "Romers Vendo Mobile"
   - (SHA-1 and SHA-256 - we'll add these next)
4. Click **Register app**
5. **Download google-services.json**
6. Place in: `myApp/android/app/google-services.json`

---

## Step 3: Generate Android Signing Keys

### Generate SHA-1 and SHA-256

**Windows (Command Prompt or PowerShell):**
```bash
# For debug builds
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

**Mac/Linux:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Output will show:**
```
SHA1: AB:CD:EF:12:34:56:...
SHA256: AB:CD:EF:12:34:56:...
```

### Copy These Keys to Firebase
1. Go back to Firebase → **Project Settings** → **Android app**
2. In "SHA certificates" section:
3. Click **Add fingerprint**
4. Paste **SHA-1** from above
5. Click **Add fingerprint** again
6. Paste **SHA-256** from above
7. Click **Save**

---

## Step 4: Generate Signing Key for App Signing

For production app signing, you need a separate release keystore:

```bash
# This creates a keystore file for signing your release APK
# Run this ONCE and save it somewhere safe!

keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias -storepass mystorepassword -keypass mykeypassword

# When prompted, enter your details:
# First and last name: Your Name
# Organization unit: Romers
# Organization: Romers Vendo
# City: Your City
# State: Your State
# Country code: Your Country Code (e.g., US)
```

**Save this file securely!** You'll need it for production APK builds.

For now, debug builds will use the debug keystore.

---

## Step 5: Get Firebase Configuration Keys

1. **Project Settings** → **General** (tab)
2. Scroll down to "Android apps"
3. You'll see your app listed
4. Below it, in the "SDK setup and configuration" section, copy these values:

```
Project ID: 
API Key:
Auth Domain:
Storage Bucket:
Messaging Sender ID:
App ID:
```

5. Also go to **APIs & Services** if you have a web client:

6. Copy the **Web Client ID** (looks like: `123456789-abcdef.apps.googleusercontent.com`)

---

## Step 6: Setup Firestore Database

### Create Firestore Database
1. In Firebase Console: **Firestore Database**
2. Click **Create database**
3. Choose **Production mode**
4. Select location closest to you
5. Click **Create**

### Create Users Collection and Rules
1. In Firestore: Click **Start collection**
2. Collection ID: `users`
3. Create first document (auto-generate ID for now)
4. Click **Next** and then **Save**

### Update Security Rules
1. **Firestore Database** → **Rules** (tab)
2. Replace the default rules with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own documents
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Allow unauthenticated reads for public data (if needed)
    match /public/{document=**} {
      allow read: if true;
    }
  }
}
```

3. Click **Publish**

---

## Step 7: Verify in App Configuration

Open `myApp/lib/firebase.ts` and verify these match your Firebase project:

```typescript
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'YOUR_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'YOUR_AUTH_DOMAIN',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'YOUR_STORAGE_BUCKET',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? 'YOUR_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? 'YOUR_APP_ID',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'YOUR_WEB_CLIENT_ID',
};
```

---

## Step 8: Create App Environment File

Create `myApp/.env` (copy from `.env.example`):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyCtLJvzqp1HM9hxFjumNGbJx83l2amkbJQ
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=esp-32-iot-39bd2.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=esp-32-iot-39bd2
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=esp-32-iot-39bd2.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=807423195952
EXPO_PUBLIC_FIREBASE_APP_ID=1:807423195952:web:1a53f5650e7ebf21d08370
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=807423195952-aoq1ge24jrfr0ic7ral9m2r2imeh14aj.apps.googleusercontent.com
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080
```

Replace values with your actual Firebase keys.

---

## Step 9: Testing Google Sign-In

### Test on Device

1. Make sure you have:
   - `google-services.json` in `myApp/android/app/`
   - Correct SHA-1 and SHA-256 in Firebase
   - Google enabled in Firebase Auth

2. Build and install:
   ```bash
   cd myApp
   npm install
   eas build --platform android --profile preview
   ```

3. When app opens:
   - Try "Google Login" button
   - You should see Google login dialog
   - Select your Google account
   - You should be logged in

### If Google Login Fails

**Error: "Google Sign-In native module is missing"**
- You're using Expo Go (doesn't support native modules)
- Use development build or APK instead

**Error: "Invalid client"**
- SHA-1 not added to Firebase
- Android package name doesn't match

**Error: "Web client ID missing"**
- Check `.env` has `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- Restart Expo dev server

---

## Troubleshooting Checklist

- [ ] Firebase project created
- [ ] Email/Password auth enabled
- [ ] Google auth enabled
- [ ] Android app added to Firebase
- [ ] `google-services.json` downloaded
- [ ] SHA-1 and SHA-256 added to Firebase
- [ ] `google-services.json` in `myApp/android/app/`
- [ ] `.env` file created with Firebase keys
- [ ] Android package name is `com.romersvendo`
- [ ] Firestore database created
- [ ] Security rules set
- [ ] Build app with Expo dev build (not Go)
- [ ] Test Google login on device

---

## Next Steps

After Firebase setup is complete:
1. Follow Android Setup Guide
2. Configure Backend
3. Build and test app

**Questions?** Check ROMERS_VENDO_COMPLETE_FIX_GUIDE.md for more details.
