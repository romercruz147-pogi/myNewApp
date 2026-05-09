# Phase 0 Inventory and Recovery Scope

## Source Recovery Status

| Source Path | Status | Notes |
|---|---|---|
| `/myApp` | **Blocked (logic missing)** | Directory contains only `node_modules/.package-lock.json`; no app source, screens, navigation, or services recovered. |
| `/iot-backend` | **Recovered** | Full Express backend with auth, heartbeat, device status, and command queue endpoints present. |
| `/esp32` | **Not present in repository snapshot** | No `/esp32` directory found. |
| `/esp32-custom` | **Recovered** | Firmware scaffold with HTTP control endpoints, AP setup flow, and backend auth placeholders present. |

## Explicitly Ignored Artifacts
- `node_modules` trees in all projects.
- build caches (`android/build`, `.gradle`, Expo caches) if present.
- generated/broken native outputs.

## Migration Map (Current Evidence-Based)

> **Important:** Frontend app source is not present, so items below are assembled from backend/firmware + migration docs and marked **Needs Decision** where unverifiable.

### 1) Screens & UI Tree
- Expected screens from prior app contract: `login`, `register`, `dashboard`, `devices`, `vendo-control`, `romers-vendo`, `wifi-setup`, `settings`, `analytics`, `admin`.
- **Status:** Needs Decision (no source files found to verify component tree).

### 2) Navigation Graph
- Expected: auth-gated app, stack + modal + drawer-like shell.
- Known route param contract from requirement: `vendo-control(ip, token, deviceId, uid, deviceDocId)`.
- **Status:** Needs Decision.

### 3) Auth Flow
- Backend supports device auth flows and token actors (`mobile`, `device`).
- Mobile Firebase auth behavior cannot be confirmed due to missing frontend.
- **Status:** Partial (backend known, frontend auth screens unknown).

### 4) Firebase Integration
- Expected Firestore paths from migration prompt:
  - `users/{uid}`
  - `users/{uid}/devices/{deviceId}`
  - `users/{uid}/settings/preferences`
  - global `devices/{deviceId or docId}` compatibility
- **Status:** Needs Decision (frontend missing).

### 5) ESP32 Direct HTTP Integration
- Confirmed in firmware/readme: `/auth`, `/status`, `/control/reset-money`, `/control/add-time`.
- Prompt additionally expects `/control/settings`, `/control/wifi`, AP `/api/*` setup endpoints.
- **Status:** Partial parity from firmware scaffold; full endpoint matrix Needs Decision.

### 6) IoT Backend Integration
- Confirmed routes:
  - `POST /api/device/login` alias
  - `POST /api/device/connect` alias
  - `GET /api/devices/:deviceId`
  - canonical `/api/mobile/device-login`, `/api/devices/auth`, `/api/devices/heartbeat`
- **Status:** Recovered and documentable.

### 7) Business Rules (Vending/Timer/Credits)
- Firmware exposes `credits`, `timeRemaining`, `totalTime`, `isActive`, `minCreditsToStart`, `secondsForMinCredits`, earnings counters.
- Backend normalizes aliases (`money`, `moneyInserted`, `credits`) into metadata.
- **Status:** Partial recovered; UI reconciliation logic Needs Decision.

### 8) Shared Services/Utilities
- Backend utilities recovered: JWT, API error, auth middleware, env config.
- Frontend utilities not present.

### 9) Assets/Branding/Theming
- No theme/assets package recovered from frontend.
- **Status:** Needs Decision.

### 10) Environment Variables & Secrets Handling
- Backend env contract recoverable (`.env` documented in backend README, provisioning key, JWT secret, Supabase).
- Firmware includes hardcoded placeholder `deviceSecret` and backend URL requiring secure replacement.
- Frontend env keys absent in snapshot.

## Recovery Gaps Blocking Exact Rebuild
1. Missing frontend source code in `/myApp` (critical blocker for exact behavior parity).
2. Missing `/esp32` directory referenced by prompt.
3. No Firebase client config or React navigation code found.

## Safe Next Step
Proceed with a **spec-first migration** (Phases 1–2 fully documented, implementation scaffold in CLI app) while waiting for missing frontend source drop-in.
