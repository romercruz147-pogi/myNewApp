# Phase 10 Production Readiness (Android CLI)

## No-Expo Hardening Checklist
1. Remove Expo-only packages and APIs entirely.
2. Ensure Android network cleartext/local-LAN policy supports ESP32 `http://192.168.x.x` traffic.
3. Configure Google Sign-In package + SHA-1/SHA-256 in Firebase.
4. Move firmware/backend secrets out of code into secure env/provisioning channels.
5. Add centralized logging and UI error boundary strategy.

## Current Risk Notes
- Frontend source absence blocks direct Expo-dependency purge verification.
- Firmware currently shows placeholder `deviceSecret`/`backendUrl`; production process must replace at provisioning.
- Backend already supports JWT actor scoping and rate limits; keep unchanged for parity.
