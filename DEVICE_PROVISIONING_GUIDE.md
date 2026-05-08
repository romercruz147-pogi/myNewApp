# Device Provisioning & Management Guide

## Overview

Device provisioning is how you create and secure IoT devices (ESP32 machines) in the Romers Vendo system.

---

## Part 1: Understanding Device Credentials

### Device ID
- **Purpose:** Public identifier
- **Example:** `romers_001`, `vendo_kitchen_main`
- **Where Stored:** 
  - ESP32 firmware
  - Backend database
  - Mobile app (when connecting)
- **Security:** Not sensitive (can be visible)

### Device Secret
- **Purpose:** Cryptographic authentication token
- **Requirements:** 
  - Minimum 32 characters
  - Should be random/unpredictable
  - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`
- **Storage:**
  - **Device (ESP32):** Stored as plain text in firmware
  - **Backend:** Stored as bcrypt hash (one-way encryption)
  - **Mobile App:** Entered by user at runtime (NOT stored)
- **Security:** Extremely sensitive! Never expose in version control

---

## Part 2: Generate Device Credentials

### Generate Secure Device Secret

**Option 1: Using Node.js (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6...
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 32

# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6...
```

**Option 3: Online Generator**
- Go to https://www.random.org/
- Generate 256 random bits
- Copy as hexadecimal

### Save Device Credentials

Create a secure location to store (NOT in git):

**File: `device_credentials.txt` (keep secure!)**
```
Device: Romers Main Vendo
Created: 2024-05-08
Status: Active

Device ID: romers_001
Device Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

Backend URL: http://192.168.0.100:8080
Provisioning Date: 2024-05-08
Owner: romer.santos@example.com

---

Device: Romers Kitchen Vendo
Device ID: romers_kitchen_001
Device Secret: z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a
Owner: restaurant@example.com
```

**Security:**
- Save locally (not in cloud)
- Don't commit to Git
- Encrypt with password if possible
- Backup securely
- Share only with authorized people

---

## Part 3: Provision Device in Backend

### Prerequisites

1. Backend running:
   ```bash
   cd iot-backend
   npm run dev
   ```

2. Environment variables set:
   ```env
   PROVISIONING_KEY=your-provisioning-secret-key-32-chars
   ```

3. Database connected (Supabase working)

### Method 1: Using curl (Recommended for Testing)

```bash
curl -X POST http://192.168.0.100:8080/api/devices/provision \
  -H "Content-Type: application/json" \
  -H "X-Provisioning-Key: your-provisioning-secret-key-32-chars" \
  -d '{
    "device_id": "romers_001",
    "device_secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "owner": "romer.santos@example.com",
    "name": "Main Vendo Machine"
  }'

# Should return:
# {
#   "ok": true,
#   "device": {
#     "id": "uuid-here",
#     "device_id": "romers_001",
#     "status": "active",
#     "name": "Main Vendo Machine",
#     "created_at": "2024-05-08T10:00:00Z"
#   }
# }
```

### Method 2: Using Node.js Script

Create `iot-backend/provision-device.js`:

```javascript
const fetch = require('node-fetch');

async function provisionDevice(deviceId, deviceSecret, owner, name) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
  const provisioningKey = process.env.PROVISIONING_KEY;

  if (!provisioningKey) {
    console.error('PROVISIONING_KEY not set');
    process.exit(1);
  }

  try {
    const response = await fetch(`${backendUrl}/api/devices/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Provisioning-Key': provisioningKey,
      },
      body: JSON.stringify({
        device_id: deviceId,
        device_secret: deviceSecret,
        owner,
        name,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Provisioning failed:', data);
      return null;
    }

    console.log('Device provisioned successfully:', data.device);
    return data.device;
  } catch (error) {
    console.error('Error provisioning device:', error);
    return null;
  }
}

// Usage
provisionDevice(
  'romers_001',
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  'romer.santos@example.com',
  'Main Vendo Machine'
);
```

Run:
```bash
BACKEND_URL=http://192.168.0.100:8080 \
PROVISIONING_KEY=your-provisioning-key \
node provision-device.js
```

### Method 3: Using Supabase Dashboard

1. Go to Supabase dashboard
2. Click your project
3. Go to **SQL Editor**
4. Run:

```sql
INSERT INTO devices (device_id, device_secret_hash, owner, status, name)
VALUES (
  'romers_001',
  crypt('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6', gen_salt('bf')),
  'romer.santos@example.com',
  'active',
  'Main Vendo Machine'
);
```

---

## Part 4: Verify Device in Database

### Check Device Exists

```bash
curl http://192.168.0.100:8080/health
# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

### In Supabase Dashboard

1. Go to Supabase → Your Project
2. Click **Table Editor**
3. Open **devices** table
4. You should see your device listed:
   - `device_id`: romers_001
   - `status`: active
   - `owner`: romer.santos@example.com
   - `created_at`: current timestamp

---

## Part 5: Test Device Authentication

### Test Login

```bash
curl -X POST http://192.168.0.100:8080/api/device/login \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "romers_001",
    "deviceSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
  }'

# Should return:
# {
#   "ok": true,
#   "success": true,
#   "token": "eyJhbGc...",
#   "device": {
#     "id": "uuid",
#     "device_id": "romers_001",
#     "status": "active",
#     "name": "Main Vendo Machine",
#     "created_at": "2024-05-08T10:00:00Z"
#   }
# }
```

### If Login Fails

**Error: "Invalid Device ID or Device Secret"**
- Check device_id matches exactly (case-sensitive)
- Check device_secret is correct
- Verify device exists in database
- Verify status is 'active'

**Error: "Too many authentication attempts"**
- Rate limiter activated
- Wait 15 minutes before retrying
- Only 30 attempts per 15 minutes

---

## Part 6: Manage Devices

### List All Devices

In Supabase Dashboard:
1. **Table Editor** → **devices**
2. See all provisioned devices
3. Check `status`, `last_seen`, `metadata`

### Update Device Status

**Disable Device:**
```sql
UPDATE devices SET status = 'disabled' WHERE device_id = 'romers_001';
```

**Revoke Device:**
```sql
UPDATE devices SET status = 'revoked' WHERE device_id = 'romers_001';
```

**Delete Device:**
```sql
DELETE FROM devices WHERE device_id = 'romers_001';
```

### Monitor Device Activity

**Last Connection:**
```sql
SELECT device_id, last_seen, last_ip FROM devices ORDER BY last_seen DESC LIMIT 10;
```

**Device Metadata (Status Data):**
```sql
SELECT device_id, metadata->'credits' as credits, metadata->'remainingTime' as remaining_time
FROM devices
WHERE metadata IS NOT NULL;
```

---

## Part 7: Security Best Practices

### Secret Management

✅ **DO:**
- Generate using cryptographically secure method
- Store in secure location (not git)
- Rotate periodically (generate new, update device and backend)
- Use different secret for each device
- Keep provisioning key secret

❌ **DON'T:**
- Hardcode in public code
- Share via email or chat
- Use weak/predictable secrets
- Use same secret for multiple devices
- Commit to version control

### Provisioning Key

- Required to create new devices
- Protects unauthorized device registration
- Should be complex and random
- Keep in `.env` file (not version control)
- Rotate if exposed

### Device Lifecycle

```
1. GENERATE credentials
2. PROVISION in backend
3. FLASH to ESP32
4. TEST in development
5. DEPLOY to production
6. MONITOR for issues
7. ROTATE if compromised
8. REVOKE if stolen/lost
9. DELETE when no longer needed
```

---

## Part 8: Backup and Recovery

### Backup Device List

```sql
-- Export devices table
SELECT * FROM devices TO '/tmp/devices_backup.csv';
```

Or from Supabase UI:
1. **Table Editor** → **devices**
2. Click **...** menu
3. Export as CSV

### Recover Deleted Device

If deleted accidentally:

```bash
# Get device details from backup
# Reproduce credentials file (if saved)

# Re-provision with same ID and secret
curl -X POST http://192.168.0.100:8080/api/devices/provision \
  -H "X-Provisioning-Key: your-provisioning-key" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "romers_001",
    "device_secret": "original_secret_here",
    "owner": "owner@example.com",
    "name": "Device Name"
  }'
```

---

## Part 9: Multi-Device Management

### Provision Multiple Devices

**Batch Script: `provision-multiple.js`**

```javascript
const crypto = require('crypto');
const fetch = require('node-fetch');

async function provisionMultipleDevices(devices) {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:8080';
  const provisioningKey = process.env.PROVISIONING_KEY;

  for (const device of devices) {
    try {
      const response = await fetch(`${baseUrl}/api/devices/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provisioning-Key': provisioningKey,
        },
        body: JSON.stringify(device),
      });

      const data = await response.json();
      console.log(`✓ ${device.device_id}: ${data.ok ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.error(`✗ ${device.device_id}: ${error.message}`);
    }
  }
}

// Devices to provision
const devices = [
  {
    device_id: 'romers_001',
    device_secret: crypto.randomBytes(32).toString('hex'),
    owner: 'romer.santos@example.com',
    name: 'Main Vendo',
  },
  {
    device_id: 'romers_kitchen_001',
    device_secret: crypto.randomBytes(32).toString('hex'),
    owner: 'restaurant@example.com',
    name: 'Kitchen Vendo',
  },
  {
    device_id: 'romers_mall_001',
    device_secret: crypto.randomBytes(32).toString('hex'),
    owner: 'mall.manager@example.com',
    name: 'Mall Location',
  },
];

provisionMultipleDevices(devices);
```

Run:
```bash
BACKEND_URL=http://192.168.0.100:8080 \
PROVISIONING_KEY=your-key \
node provision-multiple.js
```

---

## Part 10: Troubleshooting

### Device Won't Authenticate

**Check 1: Credentials Match**
```bash
# Verify in database
# Supabase → devices table
# device_id and status must be correct
```

**Check 2: Backend Running**
```bash
curl http://192.168.0.100:8080/health
# Should return {"ok":true,...}
```

**Check 3: Rate Limiting**
```
Error: "Too many authentication attempts"
Wait 15 minutes before retrying
```

### Lost Device Secret

**Problem:** Don't remember original secret

**Solution:**
```sql
-- Delete old device
DELETE FROM devices WHERE device_id = 'romers_001';

-- Generate new secret
-- node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

-- Re-provision with new secret
curl -X POST http://192.168.0.100:8080/api/devices/provision \
  -H "X-Provisioning-Key: ..." \
  -d '{"device_id":"romers_001","device_secret":"new_secret"}'

-- Flash new secret to ESP32
```

### Device Not Appearing in Database

**Check:**
1. Backend running? `curl http://localhost:8080/health`
2. Provisioning key correct?
3. Request succeeded? (status 201 in response)
4. Supabase connected? (test in backend logs)

**Solution:**
```bash
# Check backend logs for errors
# Restart backend
cd iot-backend
npm run dev

# Try provisioning again
curl -X POST http://192.168.0.100:8080/api/devices/provision \
  -H "X-Provisioning-Key: ..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Checklist for Device Setup

- [ ] Generate Device ID (e.g., `romers_001`)
- [ ] Generate Device Secret (32+ chars, random)
- [ ] Save credentials securely
- [ ] Provision device via API or Dashboard
- [ ] Verify device in Supabase
- [ ] Test device login (can authenticate?)
- [ ] Flash secret to ESP32
- [ ] Test ESP32 connection to backend
- [ ] Monitor in Supabase dashboard
- [ ] Document device ownership and purpose

---

## Next Steps

1. ✅ Understand credentials
2. ✅ Generate Device ID/Secret
3. ✅ Provision in backend
4. ✅ Verify in database
5. ✅ Test authentication
6. ⬜ Flash to ESP32 (see ESP32_SETUP_GUIDE.md)
7. ⬜ Deploy and monitor

**Need help?** Check ESP32_SETUP_GUIDE.md or ROMERS_VENDO_COMPLETE_FIX_GUIDE.md
