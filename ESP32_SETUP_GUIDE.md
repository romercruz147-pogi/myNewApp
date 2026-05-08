# ESP32 Setup & Device ID/Secret Authentication Guide

## Overview

This guide covers setting up the ESP32 microcontroller to securely authenticate with the Romers Vendo backend using Device ID and Device Secret.

---

## Part 1: ESP32 Hardware Setup

### Components Needed

- ESP32 Development Board (e.g., NodeMCU-32S, Wemos D1 Mini32)
- USB Cable (Type-C or Micro-USB depending on board)
- Arduino IDE or PlatformIO
- USB Drivers for your ESP32 variant

### Install Arduino IDE

1. Download from https://www.arduino.cc/en/software
2. Install for your OS (Windows, Mac, or Linux)
3. Open Arduino IDE
4. Go to **File** → **Preferences**
5. Add to "Additional Boards Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
6. Go to **Tools** → **Board** → **Boards Manager**
7. Search "esp32"
8. Install "ESP32" by Espressif Systems
9. Select Board: **Tools** → **Board** → **ESP32** → **ESP32 Dev Module**

### Connect ESP32 to PC

1. Connect via USB cable
2. Go to **Tools** → **Port**
3. Select your ESP32 port (e.g., `COM3`, `/dev/ttyUSB0`)
4. Verify upload speed: 115200 baud

---

## Part 2: Install Required Libraries

In Arduino IDE:

1. **Tools** → **Manage Libraries**
2. Install these libraries:
   - **WiFi** (built-in, verify it's included)
   - **HTTPClient** (built-in)
   - **ArduinoJson** by Benoit Blanchon
   - **WebServer** (built-in)
   - **Preferences** (built-in, for storing credentials)

---

## Part 3: Device Credentials Setup

### Generate Credentials

Using Node.js (on your PC):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output (64 hex characters)
```

### Store in ESP32 Firmware

Edit the ESP32 sketch to include:

```cpp
// ========================================
// DEVICE CREDENTIALS (Set during provisioning)
// ========================================
const char* DEVICE_ID = "romers_001";                    // Change this
const char* DEVICE_SECRET = "your_64_char_hex_secret";  // Change this
const char* BACKEND_URL = "http://192.168.0.100:8080";  // Change to your PC IP
const char* DEVICE_NAME = "Main Vendo Machine";
```

**IMPORTANT:**
- Device ID: Public identifier
- Device Secret: KEEP SECURE - don't share
- Backend URL: Use your PC's IP (not localhost)
- Update these values BEFORE flashing to device

---

## Part 4: Complete ESP32 Firmware

Create new Arduino sketch: `romers_vendo_esp32.ino`

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ========================================
// CONFIGURATION
// ========================================

// WiFi Configuration
const char* WIFI_SSID = "RADIUS8E9AA";           // Change to your WiFi
const char* WIFI_PASSWORD = "9p6fzk5ZEf";       // Change to your password

// Device Credentials (Provisioned during setup)
const char* DEVICE_ID = "romers_001";
const char* DEVICE_SECRET = "your_64_char_hex_secret_here";
const char* BACKEND_URL = "http://192.168.0.100:8080";

// Hardware Pins
const int COIN_SENSOR_PIN = 16;      // Coin pulse input
const int RELAY_PIN = 23;            // Relay control output
const int BUTTON_PIN = 17;           // Manual control button

// ========================================
// GLOBAL VARIABLES
// ========================================

Preferences preferences;           // For persistent storage

// Device State
String deviceToken = "";           // JWT token from backend
unsigned long tokenExpiresAt = 0;  // Token expiration time
bool isWiFiConnected = false;
bool isAuthenticated = false;

// Vendo State
int creditsBalance = 0;
unsigned long timeRemaining = 0;
unsigned long startTime = 0;
int salesToday = 0;
int totalEarnings = 0;
bool isRunning = false;

// Coin Detection
int coinPulseCount = 0;
unsigned long lastCoinPulse = 0;
const unsigned long COIN_DEBOUNCE = 200;  // 200ms debounce

// Update Timing
unsigned long lastBackendUpdate = 0;
const unsigned long BACKEND_UPDATE_INTERVAL = 10000;  // 10 seconds

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n========================================");
  Serial.println("Romers Vendo ESP32 Starting...");
  Serial.println("========================================\n");
  
  // Initialize Preferences (persistent storage)
  preferences.begin("romers", false);
  
  // Setup Hardware Pins
  pinMode(COIN_SENSOR_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  digitalWrite(RELAY_PIN, LOW);  // Relay off initially
  
  // Load previous state
  creditsBalance = preferences.getInt("credits", 0);
  salesToday = preferences.getInt("sales", 0);
  totalEarnings = preferences.getInt("earnings", 0);
  
  Serial.println("✓ Hardware initialized");
  Serial.println("✓ Previous state loaded");
  Serial.print("  - Credits: ");
  Serial.println(creditsBalance);
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("\n✓ Setup complete!\n");
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  // Handle WiFi connection
  if (!isWiFiConnected) {
    connectToWiFi();
    return;  // Retry next loop
  }
  
  // Handle authentication
  if (!isAuthenticated) {
    authenticateWithBackend();
    return;  // Retry next loop
  }
  
  // Check token expiration
  if (millis() > tokenExpiresAt) {
    Serial.println("⚠ Token expired, re-authenticating...");
    isAuthenticated = false;
    return;
  }
  
  // Poll coin sensor
  pollCoinSensor();
  
  // Poll button
  pollButton();
  
  // Update timer
  if (isRunning && timeRemaining > 0) {
    if (millis() - startTime >= 1000) {
      timeRemaining--;
      startTime = millis();
      
      if (timeRemaining <= 0) {
        stopWashing();
      }
    }
  }
  
  // Send heartbeat to backend
  if (millis() - lastBackendUpdate >= BACKEND_UPDATE_INTERVAL) {
    sendHeartbeatToBackend();
    lastBackendUpdate = millis();
  }
  
  // Small delay to prevent watchdog reset
  delay(10);
}

// ========================================
// WiFi Management
// ========================================

void connectToWiFi() {
  if (isWiFiConnected) return;
  
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    isWiFiConnected = true;
    Serial.println("\n✓ WiFi connected!");
    Serial.print("  - SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("  - IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("  - Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    isWiFiConnected = false;
    Serial.println("\n✗ WiFi connection failed");
    Serial.println("  Retrying in 5 seconds...");
    delay(5000);
  }
}

// ========================================
// Device Authentication
// ========================================

void authenticateWithBackend() {
  if (!isWiFiConnected) return;
  
  Serial.println("🔐 Authenticating device with backend...");
  
  HTTPClient http;
  String authUrl = String(BACKEND_URL) + "/api/device/connect";
  
  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");
  
  // Prepare JSON body
  StaticJsonDocument<200> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["deviceSecret"] = DEVICE_SECRET;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  Serial.print("  POST ");
  Serial.println(authUrl);
  
  int httpCode = http.POST(jsonBody);
  String payload = http.getString();
  http.end();
  
  Serial.print("  Response: ");
  Serial.println(httpCode);
  
  if (httpCode == 200) {
    // Parse response
    StaticJsonDocument<500> response;
    DeserializationError error = deserializeJson(response, payload);
    
    if (!error && response["ok"] == true) {
      deviceToken = response["token"].as<String>();
      isAuthenticated = true;
      
      // Token expires in 7 days (7 * 24 * 60 * 60 * 1000)
      tokenExpiresAt = millis() + (7 * 24 * 60 * 60 * 1000);
      
      Serial.println("✓ Device authenticated successfully!");
      Serial.print("  - Device ID: ");
      Serial.println(DEVICE_ID);
      Serial.print("  - Token (first 20 chars): ");
      Serial.println(deviceToken.substring(0, 20) + "...");
      return;
    }
  }
  
  // Authentication failed
  isAuthenticated = false;
  Serial.println("✗ Authentication failed");
  Serial.println("  Retrying in 5 seconds...");
  delay(5000);
}

// ========================================
// Coin Detection
// ========================================

void pollCoinSensor() {
  int sensorValue = digitalRead(COIN_SENSOR_PIN);
  
  // LOW = coin detected (active low)
  if (sensorValue == LOW) {
    if (millis() - lastCoinPulse > COIN_DEBOUNCE) {
      coinPulseCount++;
      lastCoinPulse = millis();
      
      Serial.print("💰 Coin pulse detected. Count: ");
      Serial.println(coinPulseCount);
      
      // Example: 1 pulse = 10 credits
      creditsBalance += 10;
      totalEarnings += 10;
      
      // Save to persistent storage
      preferences.putInt("credits", creditsBalance);
      preferences.putInt("earnings", totalEarnings);
    }
  }
}

// ========================================
// Button Control
// ========================================

void pollButton() {
  static unsigned long lastButtonPress = 0;
  static bool lastButtonState = HIGH;
  
  int buttonState = digitalRead(BUTTON_PIN);
  
  if (buttonState == LOW && lastButtonState == HIGH) {
    // Button pressed
    if (millis() - lastButtonPress > 500) {
      handleButtonPress();
      lastButtonPress = millis();
    }
  }
  
  lastButtonState = buttonState;
}

void handleButtonPress() {
  Serial.println("🔘 Button pressed");
  
  if (!isRunning && creditsBalance >= 50) {
    startWashing();
  } else if (isRunning) {
    stopWashing();
  } else {
    Serial.println("  Not enough credits");
  }
}

// ========================================
// Washing Machine Control
// ========================================

void startWashing() {
  if (creditsBalance < 50) {
    Serial.println("  Not enough credits");
    return;
  }
  
  isRunning = true;
  creditsBalance -= 50;
  timeRemaining = 300;  // 5 minutes
  startTime = millis();
  salesToday++;
  
  digitalWrite(RELAY_PIN, HIGH);  // Turn relay ON
  
  Serial.println("▶️ Washing started!");
  Serial.print("   Time: ");
  Serial.print(timeRemaining);
  Serial.println(" seconds");
  Serial.print("   Credits: ");
  Serial.println(creditsBalance);
  
  preferences.putInt("credits", creditsBalance);
  preferences.putInt("sales", salesToday);
}

void stopWashing() {
  isRunning = false;
  timeRemaining = 0;
  
  digitalWrite(RELAY_PIN, LOW);  // Turn relay OFF
  
  Serial.println("⏹️ Washing stopped");
  
  preferences.putInt("credits", creditsBalance);
}

// ========================================
// Backend Communication
// ========================================

void sendHeartbeatToBackend() {
  if (!isAuthenticated) return;
  
  HTTPClient http;
  String heartbeatUrl = String(BACKEND_URL) + "/api/devices/heartbeat";
  
  http.begin(heartbeatUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + deviceToken);
  
  // Prepare device state JSON
  StaticJsonDocument<500> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["credits"] = creditsBalance;
  doc["remainingTime"] = isRunning ? timeRemaining : 0;
  doc["totalTimeUsed"] = 0;  // Calculate if needed
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["isActive"] = isRunning;
  doc["wifiConnected"] = isWiFiConnected;
  doc["wifiSignal"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  doc["coinPulseCount"] = coinPulseCount;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.POST(jsonBody);
  
  if (httpCode == 200) {
    Serial.println("✓ Heartbeat sent successfully");
  } else {
    Serial.print("✗ Heartbeat failed (HTTP ");
    Serial.print(httpCode);
    Serial.println(")");
    
    if (httpCode == 401) {
      // Token invalid, re-authenticate
      isAuthenticated = false;
    }
  }
  
  http.end();
}

// ========================================
// Debugging / Serial Commands
// ========================================

void serialEvent() {
  while (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "status") {
      printStatus();
    } else if (cmd == "reset") {
      resetDevice();
    } else if (cmd == "coin") {
      coinPulseCount++;
      creditsBalance += 10;
      Serial.println("Test coin pulse added");
    } else if (cmd == "start") {
      startWashing();
    } else if (cmd == "stop") {
      stopWashing();
    } else if (cmd == "help") {
      printHelp();
    }
  }
}

void printStatus() {
  Serial.println("\n====== DEVICE STATUS ======");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("WiFi Connected: ");
  Serial.println(isWiFiConnected ? "Yes" : "No");
  Serial.print("Authenticated: ");
  Serial.println(isAuthenticated ? "Yes" : "No");
  Serial.print("Credits: ");
  Serial.println(creditsBalance);
  Serial.print("Is Running: ");
  Serial.println(isRunning ? "Yes" : "No");
  Serial.print("Time Remaining: ");
  Serial.print(timeRemaining);
  Serial.println(" seconds");
  Serial.print("Sales Today: ");
  Serial.println(salesToday);
  Serial.print("Total Earnings: ");
  Serial.println(totalEarnings);
  Serial.println("===========================\n");
}

void printHelp() {
  Serial.println("\n====== COMMANDS ======");
  Serial.println("status - Print device status");
  Serial.println("reset - Reset device");
  Serial.println("coin - Simulate coin pulse");
  Serial.println("start - Start washing");
  Serial.println("stop - Stop washing");
  Serial.println("help - Show this help");
  Serial.println("=======================\n");
}

void resetDevice() {
  Serial.println("Resetting device...");
  preferences.clear();
  creditBalance = 0;
  salesToday = 0;
  totalEarnings = 0;
  isAuthenticated = false;
  isRunning = false;
  Serial.println("Device reset complete");
}
```

---

## Part 5: Flash to ESP32

1. Copy above code into Arduino IDE
2. **Update these values:**
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* DEVICE_ID = "YOUR_DEVICE_ID";
   const char* DEVICE_SECRET = "YOUR_DEVICE_SECRET";
   const char* BACKEND_URL = "http://192.168.0.100:8080";
   ```
3. Verify code: **Sketch** → **Verify/Compile**
4. Upload: **Sketch** → **Upload**
5. Open Serial Monitor: **Tools** → **Serial Monitor**
6. Baud rate: 115200
7. Should see startup messages

---

## Part 6: Testing ESP32

### Serial Monitor Commands

In Serial Monitor, type commands:
```
status    - Show device status
coin      - Simulate coin pulse
start     - Start washing
stop      - Stop washing
help      - Show commands
```

### Expected Output

```
========================================
Romers Vendo ESP32 Starting...
========================================

✓ Hardware initialized
✓ Previous state loaded
  - Credits: 0
📡 Connecting to WiFi: RADIUS8E9AA
✓ WiFi connected!
  - SSID: RADIUS8E9AA
  - IP: 192.168.0.121
  - Signal: -45 dBm
🔐 Authenticating device with backend...
  POST http://192.168.0.100:8080/api/device/connect
  Response: 200
✓ Device authenticated successfully!
  - Device ID: romers_001
  - Token (first 20 chars): eyJhbGciOiJIUzI1N...

✓ Setup complete!

✓ Heartbeat sent successfully
💰 Coin pulse detected. Count: 1
▶️ Washing started!
```

### If Errors

**WiFi Won't Connect:**
- Check SSID and password correct
- Ensure WiFi is 2.4GHz (not 5GHz)
- Check signal strength

**Can't Authenticate:**
- Check Device ID matches backend
- Check Device Secret correct
- Verify backend URL (use PC IP, not localhost)
- Check backend running: `curl http://192.168.0.100:8080/health`

**Compilation Error:**
- Verify ArduinoJson library installed
- Check syntax (missing semicolons, brackets)
- Ensure board selected: **Tools** → **Board** → **ESP32**

---

## Part 7: Monitor Device in Backend

### Check in Supabase

1. **Supabase Dashboard** → **Table Editor** → **devices**
2. Look for your device: `device_id = "romers_001"`
3. Check **last_seen** timestamp (should be recent)
4. Check **metadata** for latest state

### Check Backend Logs

```bash
# Terminal where backend is running
# Should see:
# POST /api/devices/heartbeat 200
# for each heartbeat
```

### Check with curl

```bash
# First get token
curl -X POST http://192.168.0.100:8080/api/device/connect \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId":"romers_001",
    "deviceSecret":"your_secret"
  }'

# Get TOKEN from response
# Then check device status
curl -X GET http://192.168.0.100:8080/api/devices/romers_001 \
  -H "Authorization: Bearer TOKEN"
```

---

## Part 8: Troubleshooting

### Device Keeps Rebooting

**Cause:** Watchdog timeout

**Solution:** Add `delay(10)` in main loop to prevent stalling

### WiFi Disconnects Randomly

**Cause:** Signal too weak or interference

**Solution:**
- Move router closer
- Use 2.4GHz band (more reliable than 5GHz)
- Add WiFi reconnection logic

### Backend Connection Timeout

**Cause:** Wrong IP address or backend not running

**Solution:**
```cpp
// Update BACKEND_URL with correct IP
const char* BACKEND_URL = "http://192.168.0.100:8080";

// Verify backend running
curl http://192.168.0.100:8080/health
```

### Coin Sensor Not Detecting

**Cause:** Wrong pin or sensor not triggered

**Solution:**
- Verify pin number correct in code
- Test with Serial.print() to see pin value
- Check sensor wiring

---

## Quick Reference

**Important Pins**
```
Coin Sensor: GPIO 16 (Input)
Relay: GPIO 23 (Output)
Button: GPIO 17 (Input)
```

**WiFi Credentials**
```cpp
const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
```

**Device Credentials**
```cpp
const char* DEVICE_ID = "romers_001";
const char* DEVICE_SECRET = "64_char_hex_string";
const char* BACKEND_URL = "http://192.168.0.100:8080";
```

**Commands**
```
status - Device status
coin - Test coin
start - Start washing
stop - Stop washing
help - Show help
```

---

## Checklist

- [ ] Arduino IDE installed
- [ ] ESP32 board added to IDE
- [ ] Required libraries installed (ArduinoJson)
- [ ] ESP32 connected and COM port visible
- [ ] Device ID and Secret generated
- [ ] Credentials provisioned in backend
- [ ] Credentials updated in sketch
- [ ] WiFi SSID/password correct
- [ ] Backend URL correct (not localhost)
- [ ] Code compiles without errors
- [ ] Code uploaded to ESP32
- [ ] Serial Monitor shows successful startup
- [ ] Device authenticates with backend
- [ ] Coin detection works
- [ ] Relay activation works
- [ ] Heartbeat sent to backend

---

## Next Steps

1. ✅ Setup Arduino IDE
2. ✅ Install libraries
3. ✅ Prepare credentials
4. ✅ Flash firmware
5. ✅ Test in Serial Monitor
6. ✅ Verify in Supabase
7. ⬜ Test with mobile app
8. ⬜ Deploy to production

**Questions?** Check DEVICE_PROVISIONING_GUIDE.md or ROMERS_VENDO_COMPLETE_FIX_GUIDE.md
