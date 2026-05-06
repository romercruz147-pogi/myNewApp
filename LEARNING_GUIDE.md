# 📚 Learning Guide: WiFi Setup & Local Networking Concepts

## What Changed and Why?

### Before (Blynk)
```
Your Device ← WiFi → Blynk Cloud Server ← WiFi ← Your Phone
                     (Paid Service)
```
- Your device needed to connect to Blynk's cloud servers
- Blynk handled all the communication
- Your device had hardcoded WiFi credentials in code
- Required Blynk account

### After (Local HTTP)
```
Your Device ← WiFi ← Your Phone
(Same Network)
```
- Device and phone talk directly on your home WiFi
- No cloud service needed
- WiFi credentials configurable via app
- Completely free and private

---

## Understanding WiFi Modes

### 1. **Access Point (AP) Mode**
The device acts like a WiFi router:
```
Device is the "signal source"
↓
Phone connects TO the device
↓
IP is always 192.168.4.1 (default)
```

**When Used:**
- Device can't find home WiFi
- Initial setup mode
- Recovery/reconfiguration

**Your Setup AP:**
```
SSID: "VendoSetup"
Password: "12345678"
IP: 192.168.4.1
```

### 2. **Station (STA) Mode**
The device acts like a regular client:
```
Device is the "client"
↓
Device connects TO a WiFi router
↓
IP is assigned by router (e.g., 192.168.1.50)
```

**When Used:**
- Normal operation after setup
- Device is on your home WiFi
- Can be accessed by phones on same network

**Your Home WiFi:**
```
SSID: Whatever you entered (e.g., "MyWiFi")
Password: Whatever you entered
IP: Assigned by your router (varies)
```

---

## Understanding IP Addresses

### What is an IP Address?
A unique identifier for a device on a network, like a postal address.

### Local vs Public IPs
```
192.168.x.x ← Local IP (private, only within your home/office)
203.0.113.x ← Public IP (internet-facing, worldwide)
```

### The Three IP Ranges (Private)
- `192.168.0.0` to `192.168.255.255` (Most common for home WiFi)
- `10.0.0.0` to `10.255.255.255` (Enterprise)
- `172.16.0.0` to `172.31.255.255` (Rare)

**Your Device IPs:**
```
Setup Mode:      192.168.4.1 (device creates its own subnet)
Home WiFi:       192.168.1.x (assigned by your router)
```

---

## Understanding HTTP Endpoints

### What is an "Endpoint"?
A URL path on a server that handles a specific action.

### Anatomy of an HTTP Request

**Setup WiFi (Example)**
```
POST http://192.168.4.1/api/setup-wifi
     ↑    ↑              ↑ ↑         ↑
  Method Host           Port Path    Endpoint

Headers:
  Content-Type: application/json

Body (JSON):
  {
    "ssid": "MyHomeWiFi",
    "password": "mypassword123"
  }

Response:
  {
    "ok": true,
    "message": "WiFi credentials saved. Rebooting...",
    "ssid": "MyHomeWiFi"
  }
```

### Common HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| **GET** | Read data | `GET /status` → Get device state |
| **POST** | Send data/perform action | `POST /auth` → Login, `POST /control/add-time` → Add seconds |
| **PUT** | Update data | Not used in our API |
| **DELETE** | Remove data | Not used in our API |

---

## Understanding JSON

### What is JSON?
A format for sending structured data as text.

**Example:**
```json
{
  "ssid": "MyHomeWiFi",
  "password": "secret123",
  "secure": true,
  "rssi": -45,
  "devices": [
    { "name": "Phone", "ip": "192.168.1.100" },
    { "name": "Laptop", "ip": "192.168.1.105" }
  ]
}
```

### JSON Types
```json
{
  "string": "hello",           // Text in quotes
  "number": 42,               // Numbers (no quotes)
  "decimal": 3.14,            // Decimal numbers
  "boolean": true,            // true or false
  "null": null,               // Empty/missing value
  "array": [1, 2, 3],        // List with []
  "object": { "key": "val" }  // Dictionary with {}
}
```

---

## Understanding Authentication (Bearer Tokens)

### Why Authentication?
Prevent unauthorized access to device controls.

### How Bearer Tokens Work

```
1. User logs in with credentials
   POST /auth
   { "username": "admin", "password": "1234" }
   ↓
2. Server generates unique token
   Response:
   { "token": "1234567-123456" }
   ↓
3. Client stores token
   ↓
4. For future requests, include token in header
   GET /status
   Authorization: Bearer 1234567-123456
   ↓
5. Server verifies token, grants access
   ✓ Request allowed
```

### Token in Code
```javascript
// 1. Login to get token
const loginResponse = await fetch('http://192.168.x.x/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: '1234' })
});

const { token } = await loginResponse.json();
// token = "1234567-123456"

// 2. Use token for authenticated requests
const statusResponse = await fetch('http://192.168.x.x/status', {
  headers: {
    'Authorization': `Bearer ${token}`  // ← Token in header
  }
});
```

---

## Understanding CORS (Cross-Origin Resource Sharing)

### What is CORS?
Security feature that controls which websites can access your API.

### Example Problem
```
App running on: 192.168.4.1 (device AP)
App trying to access: 192.168.4.1/api/scan-networks
↓
CORS check: "Is 192.168.4.1 allowed to call 192.168.4.1?"
↓
✓ Same origin → Allowed
```

### Our Device CORS Settings
```cpp
server.sendHeader("Access-Control-Allow-Origin", "*");
                  ↓
         Allow ALL origins (open to everyone)
         
server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
                  ↓
         Allow these HTTP methods

server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
                  ↓
         Allow these request headers
```

**⚠️ Security Note:** `*` (allow all) is fine for local networks, but dangerous for public APIs.

---

## Understanding Network Flow (Detailed)

### Step 1: Device Powers On
```
Device boots
  ↓
loadWifiCredentials()  → Reads from NVS memory
  ↓
If credentials found:
  connectStationWifi()  → Try to join saved network
    ↓
    WiFi.begin(ssid, password)
      ↓
      Waits up to 20 seconds for connection
      ↓
      If successful → Get IP from router (e.g., 192.168.1.50)
      ↓
      If failed → startSetupAP()

If no credentials found OR connection failed 6+ times:
  startSetupAP()  → Create "VendoSetup" network
    ↓
    WiFi.mode(WIFI_AP_STA)  → Hybrid mode (both AP and STA)
    ↓
    WiFi.softAP("VendoSetup", "12345678")
      ↓
      Creates network on 192.168.4.1
```

### Step 2: Phone Connects to Setup AP
```
User's phone on home WiFi
  ↓
Opens Expo app
  ↓
Navigates to /wifi-setup
  ↓
Screen says "Connect to VendoSetup network"
  ↓
User opens phone WiFi settings
  ↓
Finds "VendoSetup" → Enters password "12345678"
  ↓
Phone switches to VendoSetup AP (192.168.4.1 subnet)
  ↓
App can now access device at http://192.168.4.1
```

### Step 3: App Scans Networks
```
App runs: scanNetworks()
  ↓
Makes HTTP request:
  GET http://192.168.4.1/api/scan-networks
  ↓
Device handler (handleScanNetworks):
  int n = WiFi.scanNetworks()  → Scans all 2.4GHz channels
    ↓
    For each network found:
      Extract: SSID, RSSI (signal strength), encryption
    ↓
  Build JSON response with array of networks
    ↓
  Send back to app (200 OK)
  ↓
App receives JSON and displays in list
```

### Step 4: User Selects Network & Password
```
User sees network list
  ↓
Taps "MyHomeWiFi"
  ↓
Selected network: MyHomeWiFi
  ↓
User types password: "mypassword123"
  ↓
User taps "Connect" button
```

### Step 5: App Sends Credentials
```
App runs: setupWiFi('MyHomeWiFi', 'mypassword123')
  ↓
Makes HTTP request:
  POST http://192.168.4.1/api/setup-wifi
  Content-Type: application/json
  
  {
    "ssid": "MyHomeWiFi",
    "password": "mypassword123"
  }
  ↓
Device handler (handleSetupWifi):
  saveWifiCredentials(ssid, password)
    ↓
    prefs.putString("wifi_ssid", ssid)
    prefs.putString("wifi_pass", password)
    ↓
    Saves to NVS (survives power loss)
    ↓
  ESP.restart()  → Device reboots
  ↓
App receives response: { "ok": true, ... }
```

### Step 6: Device Connects to Home WiFi
```
Device reboots (restart)
  ↓
setup() function runs
  ↓
loadWifiCredentials()  → Finds "MyHomeWiFi" and password
  ↓
connectStationWifi()  → Attempts to join
  ↓
WiFi.begin("MyHomeWiFi", "mypassword123")
  ↓
Waits for connection...
  ↓
✓ Connected! Gets IP 192.168.1.50 from router
  ↓
LCD displays:
  "WiFi Connected"
  "192.168.1.50"
  (2 second delay)
  ↓
Device ready for app access
```

### Step 7: App Detects New IP
```
App waits 3-5 seconds
  ↓
(Device is rebooting and connecting)
  ↓
Option A: Hardcode IP (if known)
  or
Option B: Scan local network for device
  or
Option C: Use mDNS hostname (vendo.local)
  ↓
Get device IP: 192.168.1.50
```

### Step 8: App Authenticates
```
App runs: authenticate('192.168.1.50', 'admin', '1234')
  ↓
POST http://192.168.1.50/auth
{
  "username": "admin",
  "password": "1234"
}
  ↓
Device validates credentials
  ↓
✓ Correct → Generate token
  ↓
Response:
{
  "token": "1623456789-456789",
  "status": "authenticated"
}
  ↓
App stores token in state/context
```

### Step 9: App Gets Status
```
App runs: getStatus('192.168.1.50', token)
  ↓
GET http://192.168.1.50/status
Authorization: Bearer 1623456789-456789
  ↓
Device validates token ✓
  ↓
Reads current state:
{
  "credits": 50,
  "remainingTime": 0,
  "totalTime": 0,
  "isActive": false,
  "salesToday": 0,
  ...
}
  ↓
App displays status in UI
  ↓
✅ Setup complete!
```

---

## Understanding NVS (Non-Volatile Storage)

### What is NVS?
A special memory on the ESP32 that survives power loss.

### How Your Device Uses It

**Saving:**
```cpp
prefs.begin("pisowash", false);  // Open "pisowash" namespace
prefs.putLong("credits", 50);    // Save as key-value pair
prefs.putString("wifi_ssid", "MyWiFi");
```

**Loading:**
```cpp
prefs.begin("pisowash", false);
long credits = prefs.getLong("credits", 0);  // Default: 0
String ssid = prefs.getString("wifi_ssid", "");  // Default: ""
```

**Your Device NVS Keys:**
```
Key                 Type    Purpose
─────────────────────────────────────────
credits             Long    Current coins
time                Long    Remaining seconds
sales               Int     Today's sales
totalEarn           Int     Total earnings
running             Bool    Is machine active
minC                Int     Min credits to start
secMin              Int     Seconds per min credit
wifi_ssid           String  Saved WiFi SSID
wifi_pass           String  Saved WiFi password
```

**Key Benefit:** When power is lost and restored, all values are restored from NVS.

---

## Understanding Your Device Logic (Preserved 100%)

### Coin Detection Flow
```
coinState = digitalRead(COIN_PIN)
  ↓
If state goes LOW → count pulse
  ↓
Wait 500ms for more pulses
  ↓
If total = 1 pulse   → Add 1 credit
If total = 5 pulses  → Add 5 credits
If total = 10 pulses → Add 10 credits
If total = other     → Reject (invalid)
  ↓
credits += coinValue
salesToday += coinValue
totalEarnings += coinValue
  ↓
saveState()  → Save to NVS
refreshLCD()  → Update display
```

### Button to Time Conversion
```
If button pressed (BTN_PIN LOW):
  ↓
  If credits >= minCreditsToStart (50):
    ↓
    multiplier = credits / minCreditsToStart
    addedTime = multiplier * secondsForMinCredits
    ↓
    timeRemaining += addedTime
    credits = 0
    isActive = true
    ↓
    Example:
    credits = 100, min = 50, secPerMin = 3000
    multiplier = 100 / 50 = 2
    addedTime = 2 * 3000 = 6000 seconds
    timeRemaining += 6000
```

### Timer Countdown
```
Every 1000ms (1 second):
  ↓
  If isActive = true:
    ↓
    If timeRemaining > 0:
      timeRemaining--
    ↓
    If timeRemaining <= 0:
      isActive = false
      timeRemaining = 0
      updateSSR()  → Turn off relay
```

### Relay Control
```
updateSSR():
  digitalWrite(SSR_PIN, (isActive && timeRemaining > 0))
  ↓
  Relay ON if:    isActive = true AND timeRemaining > 0
  Relay OFF if:   isActive = false OR timeRemaining = 0
```

---

## Key Takeaways 🎯

1. **WiFi Modes:**
   - **AP Mode:** Device is the router (setup)
   - **STA Mode:** Device is a client (normal operation)

2. **Device Flow:**
   ```
   Power On
   → Load WiFi credentials from NVS
   → Try to connect (STA mode)
   → If fail 6+ times → Switch to AP mode (setup)
   → If succeed → Device on home network
   ```

3. **App Configuration Flow:**
   ```
   Connect to AP → Scan networks → Select + password → Send → Device reboots
   → Device connects to home WiFi → App finds new IP → Authenticate → Use!
   ```

4. **All Original Logic Preserved:**
   ```
   Coin detection, button logic, timer, relay, LCD, persistence
   = IDENTICAL to original esp32.ino
   ```

5. **Security Reminder:**
   ```
   Only use on trusted networks (local only, no internet)
   HTTP is unencrypted, change default credentials before deployment
   ```

---

## Common Terminology Explained

| Term | Meaning |
|------|---------|
| **SSID** | WiFi network name (e.g., "MyWiFi") |
| **Password** | WiFi network encryption key |
| **IP Address** | Unique device identifier on network (e.g., 192.168.1.50) |
| **RSSI** | Signal strength in dBm (lower = stronger, e.g., -45 is good) |
| **Endpoint** | API route that handles a specific action |
| **Bearer Token** | Authentication credential for API requests |
| **JSON** | Structured data format (text-based) |
| **NVS** | Non-volatile storage (survives power loss) |
| **Access Point (AP)** | WiFi router mode (device creates network) |
| **Station (STA)** | WiFi client mode (device joins network) |
| **CORS** | Security feature controlling API access |
| **HTTP** | Protocol for web requests (unencrypted) |
| **HTTPS** | HTTP with encryption (secure, uses certificates) |

---

## Practice Questions

**Q1:** What is the default IP when device is in setup mode?
**A1:** 192.168.4.1

**Q2:** How many times can WiFi fail before device reverts to setup AP?
**A2:** 6 times

**Q3:** Where are WiFi credentials saved?
**A3:** NVS (non-volatile storage)

**Q4:** What HTTP method is used to send WiFi credentials?
**A4:** POST

**Q5:** Why are bearer tokens used?
**A5:** To authenticate API requests and prevent unauthorized access

**Q6:** What happens if you press the button with 100 credits (min = 50, secPerMin = 3000)?
**A6:** 
- multiplier = 100/50 = 2
- addedTime = 2 * 3000 = 6000 seconds
- Machine runs for 6000 seconds (100 minutes)

**Q7:** What coin pulse counts are valid?
**A7:** 1, 5, 10 (other counts are rejected)

**Q8:** When does the relay turn on?
**A8:** When `isActive = true` AND `timeRemaining > 0`

---

**Now you understand the complete system!** 🎓

Feel free to ask any questions in the comments or documentation.
