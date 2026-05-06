# Secure ESP32 + Mobile App IoT Architecture Guide

This guide upgrades the current ESP32 + mobile app workflow to a production-ready authentication model using a unique `device_id` and `device_secret` for every ESP32.

## 1. What changes and what stays the same

### Keep unchanged
- Coin counting, credits, pricing, LCD, relay/SSR, timer, sales, and vendo business logic stay in the ESP32 firmware.
- Existing app screens can keep their current navigation and device-control flow.
- Existing local ESP32 endpoints such as `/status`, `/control/add-time`, and `/control/reset-money` remain available.

### Upgrade only authentication and connection architecture
- A Node.js + Express backend becomes the trusted gatekeeper.
- Supabase stores devices.
- The database stores `device_secret_hash`, not the plain `device_secret`.
- The mobile app authenticates a device with `device_id` + `device_secret` and receives a JWT.
- The ESP32 authenticates on boot with `device_id` + `device_secret`, receives a JWT, then sends authenticated heartbeats.

## 2. Architecture

```text
[ Mobile App ]
     |  POST /api/mobile/device-login { device_id, device_secret }
     v
[ Backend API ]
     |  query devices + bcrypt.compare(secret, device_secret_hash)
     v
[ Supabase Database ]
     ^
     |  POST /api/devices/auth on ESP32 boot
     |
[ ESP32 Firmware ]
```

### Data flow
1. Factory/admin creates credentials for one ESP32.
2. Backend stores `device_id` and a bcrypt hash of `device_secret`.
3. The same plain `device_secret` is flashed into the ESP32 or configured through the setup portal once.
4. User enters Device ID and Device Secret in the mobile app.
5. Backend verifies credentials and returns a JWT session.
6. ESP32 sends the same credentials to `/api/devices/auth` on boot.
7. Backend verifies the ESP32 and returns a JWT.
8. ESP32 sends heartbeats to `/api/devices/heartbeat` with `Authorization: Bearer <token>`.
9. Mobile app uses its own JWT to read protected device status.

## 3. Folder structure

```text
workspace/application/
├── iot-backend/
│   ├── package.json
│   ├── .env.example
│   ├── database/
│   │   └── supabase-schema.sql
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       │   ├── env.js
│       │   └── supabase.js
│       ├── controllers/
│       │   └── device-controller.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── error-handler.js
│       ├── routes/
│       │   └── device-routes.js
│       └── utils/
│           ├── errors.js
│           └── jwt.js
├── myApp/
│   └── lib/
│       ├── esp32-device-api.ts
│       └── iot-backend-api.ts
└── esp32-custom/
    └── esp32_custom.ino
```

## 4. Database schema

Use `iot-backend/database/supabase-schema.sql` in Supabase SQL Editor. The important table is:

```sql
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_secret_hash text not null,
  owner uuid null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
```

The implemented schema also adds `last_seen`, `last_ip`, `metadata`, and `updated_at` so the backend can track online/offline state and ESP32 telemetry.

## 5. Backend setup

```bash
cd iot-backend
npm install
cp .env.example .env
npm run dev
```

Fill `.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
JWT_SECRET=generate-a-long-random-secret
PROVISIONING_KEY=generate-a-long-random-admin-key
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Why each backend piece exists
- `helmet` adds safer HTTP headers.
- `cors` restricts which app origins can call the API.
- `express-rate-limit` slows brute-force credential guessing.
- `bcryptjs` hashes and verifies Device Secrets safely.
- `jsonwebtoken` creates short proof that the device already authenticated.
- `middleware/auth.js` protects routes so unauthenticated devices cannot read or write data.
- `middleware/error-handler.js` gives consistent JSON errors.

## 6. Provision one ESP32 device

Generate a secret outside your source code repository:

```bash
node -e "console.log('RV-' + crypto.randomBytes(8).toString('hex').toUpperCase()); console.log('RVS-' + crypto.randomBytes(32).toString('hex').toUpperCase())"
```

Create the database record:

```bash
curl -X POST http://localhost:8080/api/devices/provision \
  -H 'Content-Type: application/json' \
  -H 'X-Provisioning-Key: YOUR_PROVISIONING_KEY' \
  -d '{
    "device_id": "RV-1234567890ABCDEF",
    "device_secret": "RVS-REPLACE_WITH_LONG_RANDOM_SECRET",
    "name": "Romers Vendo 01"
  }'
```

The backend stores only the hash. Save the plain secret once and put it into the ESP32 through the setup portal or firmware build secrets.

## 7. ESP32 boot authentication

On boot, the ESP32 now follows this sequence:

```text
connect Wi-Fi
load device_id + device_secret from Preferences
POST /api/devices/auth
receive JWT
POST /api/devices/heartbeat with Authorization header
run existing vending logic continuously
```

Example JSON sent by ESP32:

```json
{
  "device_id": "RV-1234567890ABCDEF",
  "device_secret": "RVS-REPLACE_WITH_LONG_RANDOM_SECRET"
}
```

Example heartbeat:

```http
POST /api/devices/heartbeat
Authorization: Bearer <esp32-jwt>
Content-Type: application/json
```

```json
{
  "deviceId": "RV-1234567890ABCDEF",
  "credits": 10,
  "remainingTime": 120,
  "salesToday": 55,
  "totalEarnings": 1200,
  "isActive": true,
  "wifiSignal": -55,
  "ip": "192.168.1.50"
}
```

## 8. Mobile app flow

1. User opens existing device connection screen.
2. User enters Device ID and Device Secret.
3. App calls `iotBackendApi.authenticateDevice(deviceId, deviceSecret)`.
4. Backend returns `{ token, device }`.
5. App saves the session token using a secure storage adapter.
6. On the next app launch, app loads the token and calls `getDeviceStatus`.
7. If token is expired or invalid, app asks the user to enter credentials again.

Example integration:

```ts
import { iotBackendApi } from '@/lib/iot-backend-api';

const session = await iotBackendApi.authenticateDevice(deviceId, deviceSecret);
await iotBackendApi.saveSession(storage, session);
const device = await iotBackendApi.getDeviceStatus(session.device.device_id, session.token);
```

For production React Native, use secure device storage for `storage`, for example Expo SecureStore or encrypted storage. Do not store tokens in plain text AsyncStorage for sensitive deployments.

## 9. Security checklist

### Plain secrets are dangerous
If you store `device_secret` as plain text, a database leak immediately exposes every ESP32. Hashing means the database stores a one-way value. During login, the backend hashes the submitted secret and compares it safely.

### JWT purpose
JWT avoids sending `device_secret` on every request. The secret is used only at authentication time. After that, the token proves the app or ESP32 has already passed authentication.

### HTTPS is mandatory
Use HTTPS in production so Wi-Fi attackers cannot read Device Secrets or JWTs. For ESP32 production builds, pin a root CA certificate instead of disabling certificate validation.

### Rate limiting
The backend limits authentication attempts. This slows attackers trying many Device Secret guesses.

### Duplicate prevention
The database uses `unique(device_id)`, and the provisioning route returns `409 duplicate_device` if someone tries to reuse a Device ID.

### Fake-device prevention
A fake ESP32 cannot send heartbeats unless it knows both the Device ID and Device Secret. After auth, it must also include a valid JWT.

## 10. Debugging guide

### ESP32 cannot connect to Wi-Fi
- Confirm SSID/password.
- Watch Serial Monitor for connection logs.
- Confirm router is 2.4 GHz; many ESP32 boards cannot use 5 GHz.
- Confirm power supply is stable.

### ESP32 gets HTTP 401 from `/api/devices/auth`
- Device ID has a typo.
- Device Secret has a typo.
- Database row was not provisioned.
- Device status is not `active`.

### ESP32 heartbeat gets HTTP 401/403
- JWT expired or backend restarted with a different `JWT_SECRET`.
- Device was revoked or disabled.
- ESP32 will clear the token and re-authenticate on the next loop.

### Mobile app says invalid credentials
- Verify the user typed the exact Device ID and Device Secret.
- Confirm the backend can query Supabase.
- Confirm the `device_secret_hash` was created from the same plain secret.

### Backend cannot connect to Supabase
- Check `SUPABASE_URL`.
- Check `SUPABASE_SERVICE_ROLE_KEY`.
- Confirm the SQL schema was run.
- Look at terminal logs from `npm run dev`.

### API returns rate limited
- Too many failed attempts happened in 15 minutes.
- Wait or lower the rate limit only for local development.

## 11. Production notes

- Rotate `JWT_SECRET` carefully; old tokens become invalid.
- Keep `PROVISIONING_KEY` off mobile apps and ESP32 firmware.
- Never commit real Device Secrets.
- Use HTTPS only.
- Add MQTT or WebSockets later for real-time command delivery.
- Add audit logs for provisioning and secret rotation.
- Add per-owner authorization before multiple users manage devices.
