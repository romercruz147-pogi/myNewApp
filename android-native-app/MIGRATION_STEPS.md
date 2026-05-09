# Migration Steps: Expo -> React Native CLI (Android)

## 1) Create clean project
```bash
npx @react-native-community/cli@latest init MainNativeApp --package-name com.yourcompany.mainapp
```

## 2) Install navigation + required native deps
```bash
cd MainNativeApp
npm i @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
npm i @react-native-async-storage/async-storage axios
npm i @react-native-google-signin/google-signin
npm i @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/messaging
```

## 3) Copy source folders only
Copy from old project into new project root:
- app source code
- components
- hooks
- services
- utils
- assets
- Firebase logic
- backend integration
- ESP32 communication logic
- authentication/API logic

Do not copy:
- old `android/`
- old `ios/`
- Expo-specific native configs
- caches

## 4) Replace Expo-only packages
Map and replace any `expo-*` package with RN CLI-compatible alternatives.

## 5) Android Firebase config
- Put `google-services.json` at `android/app/google-services.json`.
- Ensure package name in `android/app/build.gradle` matches Firebase Android app package.
- Add Google services classpath/plugin.

## 6) Google Sign-In
Configure SHA-1/SHA-256 and `webClientId` used by auth flow.

## 7) Permissions
Add exact required permissions in `AndroidManifest.xml` (internet, notifications, BLE/Wi-Fi/local network as needed by ESP32 flow).

## 8) Release signing
Create/upload keystore and configure `gradle.properties` + signing config.

## 9) Build
```bash
cd android
./gradlew clean
./gradlew assembleRelease
./gradlew bundleRelease
```

## 10) Verify no Expo runtime dependency
- no `expo start`
- no Expo Go
- no expo.dev requirement
