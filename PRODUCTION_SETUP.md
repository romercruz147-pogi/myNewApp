# Romers Vendo - Supabase + Expo + ESP32 Production Setup

## 1) Required packages (mobile)
- `@react-native-google-signin/google-signin`
- `expo-dev-client`
- `expo-secure-store`
- `@supabase/supabase-js` (if you call Supabase directly from app)

## 2) Expo config
- App name: `Romers Vendo`
- Icon / adaptive icon / splash all use `assets/images/icon.png`
- Google Sign-In plugin configured in `app.json`

## 3) EAS build commands
```bash
cd myApp
npx expo prebuild --clean
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
npx eas build --profile production --platform all
```

## 4) Example .env
```env
# mobile (safe public)
EXPO_PUBLIC_IOT_BACKEND_URL=https://your-api.example.com
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID

# backend only (never expose)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
JWT_SECRET=CHANGE_ME_STRONG_SECRET
CORS_ORIGINS=https://yourapp.example.com
```

## 5) Supabase
1. Create project.
2. Run SQL from `iot-backend/database/supabase-schema.sql`.
3. Enable RLS (already included in SQL).
4. Create `profiles` table with role column (`admin`/`user`) and set admin users.

## 6) Device registration/auth flow
1. Admin logs in mobile app.
2. Admin calls `POST /api/devices/register` with `deviceId`, `deviceSecret`, `deviceName`, `ownerId`.
3. Backend hashes secret and stores only hash.
4. ESP32 calls `POST /api/device/login` with `deviceId` + `deviceSecret`.
5. Backend returns JWT for heartbeats/status.

## 7) ESP32 firmware values
```cpp
String deviceId = "romers001";
String deviceSecret = "secret123";
String backendUrl = "https://your-api.example.com";
```
Flash steps:
1. Open `esp32-custom/esp32_custom.ino` in Arduino IDE.
2. Set board/port.
3. Update WiFi + backend values.
4. Upload.
5. Watch serial monitor for auth/heartbeat logs.

## 8) APIs
- `POST /api/devices/register`
- `POST /api/device/login`
- `GET /api/devices/:deviceId`
- `POST /api/devices/heartbeat`

## 9) Google Sign-In fix
- Works only in Expo Development Build / release build.
- Not available in Expo Go.
- If unavailable, app should show warning and keep email/password auth usable.
