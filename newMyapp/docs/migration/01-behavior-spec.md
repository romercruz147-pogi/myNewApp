# Phase 1 Behavior Spec (As-Is / Recoverable)

## A) Routing / Navigation
- **Source behavior:** Auth-gated app with login-first redirect; stack + modal and drawer shell requested.
- **Rebuilt behavior:** RN Navigation root stack with `AuthStack` and `AppDrawer`; guarded initial route via auth subscription.
- **Parity:** **Needs Decision** (frontend route table missing).

## B) Screen Workflows
All named screens are preserved as route contracts, with exact logic pending missing source.
- `vendo-control` must accept params: `ip`, `token`, `deviceId`, `uid`, `deviceDocId`.
- ESP32 control polling cadence target: 3s.
- Firestore subscriptions expected for dashboard/devices/settings.
- **Parity:** Needs Decision for exact form validation/error text.

## C) Authentication / Profiles
- Email+password + Google sign-in semantics to preserve.
- User doc upsert fields: `provider`, `role`, `createdAt`, `lastLogin`.
- Auth-state redirect behavior preserved (unauth -> login, auth -> dashboard).
- **Parity:** Needs Decision (frontend impl not recovered).

## D) Firebase Data Model
Required collections (contract):
- `users/{uid}`
- `users/{uid}/devices/{deviceId}`
- `users/{uid}/settings/preferences`
- global `devices/{deviceId|docId}` legacy compatibility
- **Parity:** Needs Decision on dual-write merge semantics/timestamps.

## E) ESP32 Direct HTTP Logic
Recovered / expected endpoint set:
- Confirmed scaffold: `/auth`, `/status`, `/control/add-time`, `/control/reset-money`.
- Required by contract: add `/control/settings`, `/control/wifi`, and setup AP endpoints `/api/scan-networks`, `/api/setup-wifi`, `/api/device-info`, `/api/wifi-status`.
- **Parity:** Acceptable for confirmed endpoints; Needs Decision for missing ones.

## F) IoT Backend API Logic
Recovered app-side compatible endpoints:
- `POST /api/device/login` (alias to mobile device login)
- `GET /api/devices/:deviceId` (JWT-scoped)
- Also available: `/api/mobile/device-login`, `/api/devices/auth`, `/api/device/connect`, `/api/devices/heartbeat`.
- **Parity:** Exact for recovered backend.

## G) Vending Business Rules
Recovered normalization and timers:
- Credits aliases normalized: `money`, `moneyInserted`, `credits`.
- Timer fields: `remainingTime`, `totalTimeUsed` (+ `totalTime` in firmware).
- Pricing controls: `minCreditsToStart`, `secondsForMinCredits`.
- Connectivity heuristic target: heartbeat freshness ~45s + status flags.
- **Parity:** Acceptable for backend/firmware facts; Needs Decision for UI reconciliation logic.
