# Romers Vendo IoT Backend

Node.js + Express backend that authenticates ESP32 devices and mobile app sessions with `device_id` + `device_secret`.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Run `database/supabase-schema.sql` in Supabase before starting the API.

## Main endpoints

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Health check |
| `POST` | `/api/devices/provision` | `X-Provisioning-Key` | Create one device and hash its secret |
| `POST` | `/api/mobile/device-login` | none + rate limit | Mobile app login using Device ID/Secret |
| `POST` | `/api/devices/auth` | none + rate limit | ESP32 boot authentication |
| `POST` | `/api/devices/heartbeat` | device JWT | ESP32 telemetry update |
| `GET` | `/api/devices/:deviceId` | JWT | Read protected device status |
| `POST` | `/api/devices/:deviceId/commands` | mobile JWT | Queue a future command/event |

## Credential rule

The plain `device_secret` is shown only once during provisioning and copied into the ESP32. The backend stores `device_secret_hash` using bcrypt.
