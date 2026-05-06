# ESP32 Custom Backend Bridge (Blynk Replacement)

This folder contains a **drop-in connectivity refactor scaffold** that replaces Blynk transport with local HTTP endpoints while preserving existing vendo logic.

## What this provides
- Local HTTP API for the mobile app:
  - `GET /status` → `{ money, remainingTime, totalTime, isActive }`
  - `POST /auth` with `{ username, password }`
  - `POST /control/reset-money`
  - `POST /control/add-time` with `{ seconds }`
- CORS headers for local app access.
- Simple bearer token protection for control endpoints.

## Critical migration rule
Keep your original firmware logic exactly the same.
- Do **not** rename variables/functions used by your timing, coin, and relay logic.
- Paste your existing logic into:
  - `setupVendoLogic()`
  - `runVendoLogicNonBlocking()`
  - `resetMoneyExactLogic()`
  - `addTimeExactLogic()`

Only the Blynk transport layer should be removed/replaced.

## Blynk mapping guide
- `Blynk.virtualWrite(...)` -> update shared variables read by `/status`.
- `BLYNK_WRITE(Vx)` handlers -> map to `/control/*` HTTP handlers.
- `Blynk.run()` -> `server.handleClient()` in `loop()`.

## Notes
- This scaffold is in a separate folder and does not modify existing app code.
- Adjust endpoint names if your app expects `/login` + `/vendo/*` aliases.
