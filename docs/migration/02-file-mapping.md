# Phase 2 React Native CLI File Mapping Plan

## Stack Choice
- **React Native CLI + TypeScript + React Navigation**.
- **Firebase choice:** `@react-native-firebase/*` for native Android reliability (auth persistence and Google sign-in interop).

## Mapping Table (spec-first due missing frontend files)

| Old File | New File | Responsibility | Parity Check |
|---|---|---|---|
| (missing) app router | `src/navigation/RootNavigator.tsx` | Auth gate + app drawer stack | login redirect exactness |
| (missing) auth service | `src/services/authService.ts` | email/google login + logout + auth subscribe | auth error text mapping |
| (missing) dashboard screen | `src/screens/DashboardScreen.tsx` | dual-source device summary | connected state classification |
| (missing) devices screen | `src/screens/DevicesScreen.tsx` | list + open control route params | route param parity |
| (missing) vendo-control | `src/screens/VendoControlScreen.tsx` | 3s polling + control actions + firestore sync | timer/money parity |
| (missing) wifi setup | `src/screens/WifiSetupScreen.tsx` | AP scan + post credentials + delayed nav | setup success flow |
| (missing) settings | `src/screens/SettingsScreen.tsx` | profile + prefs live sync + CRUD | firestore path parity |
| (missing) admin | `src/screens/AdminScreen.tsx` | role-based visibility | `users/{uid}.role` gate |
| (missing) esp32 api | `src/services/esp32Service.ts` | local IP HTTP + auth header + helpers | endpoint payload parity |
| (missing) backend api | `src/services/iotBackendApi.ts` | `/api/device/login` + status + session cache | token persistence parity |
| (missing) theme | `src/theme/*` | dark palette/tokens/components | visual parity checklist |

