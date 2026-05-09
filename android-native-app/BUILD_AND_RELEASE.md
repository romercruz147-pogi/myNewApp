# Build and Release Checklist (Android Native)

## Local debug
```bash
npm install
npx react-native doctor
npx react-native run-android
```

## Release artifacts
```bash
cd android
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB
```

Expected outputs:
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

## Verification
- App installs standalone on device.
- Auth flow works (including Google Sign-In).
- Firebase reads/writes/push work.
- Backend/API calls and env URLs unchanged.
- ESP32 communication logic behavior unchanged.
- No Expo Go/expo.dev server required.
