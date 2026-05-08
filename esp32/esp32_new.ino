#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ========================================
// ROMERS VENDO ESP32 - DEVICE ID/SECRET AUTHENTICATION
// ========================================
// This firmware securely authenticates with the backend using:
// - Device ID: Public identifier
// - Device Secret: Cryptographic token
// - JWT Token: For authenticated API calls
// ========================================

// ========================================
// CONFIGURATION - UPDATE THESE!
// ========================================

// Device Credentials (from provisioning)
const char* DEVICE_ID = "romers_001";                           // Your Device ID
const char* DEVICE_SECRET = "your_64_char_hex_secret_here";    // Your Device Secret (32+ chars)
const char* BACKEND_URL = "http://192.168.0.100:8080";         // Backend URL (use PC IP, not localhost)

// WiFi Credentials
const char* WIFI_SSID = "RADIUS8E9AA";                         // Your WiFi network name
const char* WIFI_PASSWORD = "9p6fzk5ZEf";                      // Your WiFi password

// Hardware Configuration
const int COIN_PIN = 16;      // Coin pulse input pin
const int BTN_PIN = 17;       // Button input pin
const int RELAY_PIN = 23;     // Relay control output pin

// ========================================
// GLOBAL STATE
// ========================================

String deviceToken = "";           // JWT token from backend
unsigned long tokenExpiresAt = 0;  // Token expiration time

// Device Status
int credits = 0;
long timeRemaining = 0;
int salesToday = 0;
int totalEarnings = 0;
bool isRunning = false;

// Connection Status
bool isWiFiConnected = false;
bool isAuthenticated = false;

// Timing
unsigned long lastBackendUpdate = 0;
unsigned long lastCoinPulse = 0;
unsigned long machineStartTime = 0;

const unsigned long BACKEND_UPDATE_INTERVAL = 10000;  // 10 seconds
const unsigned long COIN_DEBOUNCE = 200;               // 200ms debounce
const int MIN_CREDITS = 50;
const int SECONDS_PER_CREDIT = 300;  // 5 minutes per 50 credits

// Storage
Preferences preferences;

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("\n\n========================================");
  Serial.println("Romers Vendo ESP32 - Initializing");
  Serial.println("========================================\n");
  
  // Initialize preferences
  preferences.begin("romers", false);
  
  // Load previous state
  loadState();
  
  // Setup pins
  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // Relay off initially
  
  Serial.println("✓ Hardware initialized");
  Serial.print("  Device ID: ");
  Serial.println(DEVICE_ID);
  
  // Connect WiFi
  connectToWiFi();
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  // Maintain WiFi connection
  if (!isWiFiConnected) {
    connectToWiFi();
    delay(5000);
    return;
  }
  
  // Authenticate if needed
  if (!isAuthenticated) {
    authenticateWithBackend();
    delay(5000);
    return;
  }
  
  // Check token expiration
  if (millis() > tokenExpiresAt) {
    Serial.println("⚠ Token expired, re-authenticating...");
    isAuthenticated = false;
    return;
  }
  
  // Poll sensors
  pollCoinSensor();
  pollButton();
  
  // Update timer if running
  if (isRunning && timeRemaining > 0) {
    if (millis() - machineStartTime >= 1000) {
      timeRemaining--;
      machineStartTime = millis();
      
      if (timeRemaining <= 0) {
        stopMachine();
      }
    }
  }
  
  // Send heartbeat periodically
  if (millis() - lastBackendUpdate >= BACKEND_UPDATE_INTERVAL) {
    sendHeartbeatToBackend();
    lastBackendUpdate = millis();
  }
  
  delay(10);
}

// ========================================
// WiFi Management
// ========================================

void connectToWiFi() {
  if (isWiFiConnected) return;
  
  Serial.print("📡 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    isWiFiConnected = true;
    Serial.println("✓ WiFi connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("  Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    isWiFiConnected = false;
    Serial.println("✗ WiFi connection failed");
  }
}

// ========================================
// Device Authentication
// ========================================

void authenticateWithBackend() {
  if (!isWiFiConnected) return;
  
  Serial.println("🔐 Authenticating with backend...");
  
  HTTPClient http;
  String authUrl = String(BACKEND_URL) + "/api/device/connect";
  
  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");
  
  // Build JSON body
  StaticJsonDocument<200> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["deviceSecret"] = DEVICE_SECRET;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.POST(jsonBody);
  String response = http.getString();
  http.end();
  
  if (httpCode == 200) {
    StaticJsonDocument<500> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc["ok"] == true) {
      deviceToken = responseDoc["token"].as<String>();
      isAuthenticated = true;
      
      // Token valid for 7 days
      tokenExpiresAt = millis() + (7 * 24 * 60 * 60 * 1000);
      
      Serial.println("✓ Device authenticated!");
      return;
    }
  }
  
  Serial.print("✗ Authentication failed (HTTP ");
  Serial.print(httpCode);
  Serial.println(")");
  isAuthenticated = false;
}

// ========================================
// Sensor Input
// ========================================

void pollCoinSensor() {
  int sensorValue = digitalRead(COIN_PIN);
  
  if (sensorValue == LOW) {  // Coin detected (active low)
    if (millis() - lastCoinPulse > COIN_DEBOUNCE) {
      handleCoinPulse();
      lastCoinPulse = millis();
    }
  }
}

void handleCoinPulse() {
  Serial.println("💰 Coin detected!");
  
  // 1 pulse = 10 credits (adjust as needed)
  credits += 10;
  totalEarnings += 10;
  
  saveState();
}

void pollButton() {
  static unsigned long lastButtonPress = 0;
  static bool lastButtonState = HIGH;
  
  int buttonState = digitalRead(BTN_PIN);
  
  if (buttonState == LOW && lastButtonState == HIGH) {
    if (millis() - lastButtonPress > 500) {
      handleButtonPress();
      lastButtonPress = millis();
    }
  }
  
  lastButtonState = buttonState;
}

void handleButtonPress() {
  Serial.println("🔘 Button pressed");
  
  if (!isRunning && credits >= MIN_CREDITS) {
    startMachine();
  } else if (isRunning) {
    stopMachine();
  } else {
    Serial.println("  Not enough credits");
  }
}

// ========================================
// Machine Control
// ========================================

void startMachine() {
  if (credits < MIN_CREDITS) {
    Serial.println("✗ Not enough credits");
    return;
  }
  
  isRunning = true;
  credits -= MIN_CREDITS;
  timeRemaining = SECONDS_PER_CREDIT;
  machineStartTime = millis();
  salesToday++;
  
  digitalWrite(RELAY_PIN, HIGH);  // Turn relay ON
  
  Serial.println("▶️ Machine started!");
  Serial.print("   Time: ");
  Serial.print(timeRemaining);
  Serial.println(" seconds");
  
  saveState();
}

void stopMachine() {
  isRunning = false;
  timeRemaining = 0;
  
  digitalWrite(RELAY_PIN, LOW);  // Turn relay OFF
  
  Serial.println("⏹️ Machine stopped");
  
  saveState();
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
  
  // Build device state
  StaticJsonDocument<500> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["credits"] = credits;
  doc["remainingTime"] = isRunning ? timeRemaining : 0;
  doc["totalTimeUsed"] = 0;
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["isActive"] = isRunning;
  doc["wifiConnected"] = isWiFiConnected;
  doc["wifiSignal"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int httpCode = http.POST(jsonBody);
  
  if (httpCode == 200) {
    Serial.println("✓ Heartbeat sent");
  } else if (httpCode == 401) {
    // Token invalid
    isAuthenticated = false;
    Serial.println("⚠ Token invalid, re-authenticating...");
  } else {
    Serial.print("✗ Heartbeat failed (HTTP ");
    Serial.print(httpCode);
    Serial.println(")");
  }
  
  http.end();
}

// ========================================
// State Management
// ========================================

void loadState() {
  credits = preferences.getInt("credits", 0);
  salesToday = preferences.getInt("sales", 0);
  totalEarnings = preferences.getInt("earnings", 0);
  
  Serial.println("✓ State loaded from storage");
}

void saveState() {
  preferences.putInt("credits", credits);
  preferences.putInt("sales", salesToday);
  preferences.putInt("earnings", totalEarnings);
}

// ========================================
// Serial Debugging
// ========================================

void serialEvent() {
  while (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "status") {
      printStatus();
    } else if (cmd == "coin") {
      handleCoinPulse();
    } else if (cmd == "start") {
      startMachine();
    } else if (cmd == "stop") {
      stopMachine();
    } else if (cmd == "help") {
      printHelp();
    }
  }
}

void printStatus() {
  Serial.println("\n========== DEVICE STATUS ==========");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("WiFi Connected: ");
  Serial.println(isWiFiConnected ? "Yes" : "No");
  Serial.print("Authenticated: ");
  Serial.println(isAuthenticated ? "Yes" : "No");
  Serial.print("Credits: ");
  Serial.println(credits);
  Serial.print("Is Running: ");
  Serial.println(isRunning ? "Yes" : "No");
  Serial.print("Time Remaining: ");
  Serial.println(timeRemaining);
  Serial.print("Sales Today: ");
  Serial.println(salesToday);
  Serial.print("Total Earnings: ");
  Serial.println(totalEarnings);
  Serial.println("==================================\n");
}

void printHelp() {
  Serial.println("\n========== COMMANDS ==========");
  Serial.println("status - Show device status");
  Serial.println("coin   - Simulate coin pulse");
  Serial.println("start  - Start machine");
  Serial.println("stop   - Stop machine");
  Serial.println("help   - Show this help");
  Serial.println("==============================\n");
}
