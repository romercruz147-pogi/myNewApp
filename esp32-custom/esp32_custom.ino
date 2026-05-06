// ===== HEADERS (BLYNK REMOVED, HTTP ADDED) =====
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <ArduinoJson.h>
// NOTE: Removed #include <BlynkSimpleEsp32.h> and BLYNK_* defines

/*
  REFACTORED: Removed Blynk, added local HTTP server for Expo React Native app
  ============================================================================
  All original device logic preserved exactly:
  - Coin detection (pulses for 1, 5, 10)
  - Button time conversion logic
  - SSR relay control
  - LCD display with rotating screens
  - Preferences/NVS storage
  - Multi-network WiFi fallback
  
  HTTP Endpoints (replace Blynk virtual pins):
  - POST /auth           -> authenticate user
  - GET /status          -> read money, time, active state
  - POST /control/reset-money -> clear credits
  - POST /control/add-time    -> add seconds to remaining time
*/

// ===== LCD & COMMS (unchanged) =====
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
Preferences prefs;

// ===== AUTHENTICATION (same credentials, no Blynk token) =====
const char* adminUser = "admin";
const char* adminPass = "1234";
String sessionToken = "";

// ===== WIFI (multi-network fallback, unchanged logic) =====
const char* ssidList[] = {"CHARD", "Infinix NOTE 40 5G", "Infinix HOT 50 Pro+"};
const char* passList[] = {"1234567890@", "romer13456", "geconnect"};

// ===== PINS (unchanged) =====
const int COIN_PIN = 16;
const int BTN_PIN = 17;
const int SSR_PIN = 23;

// ===== CORE STATE VARIABLES (unchanged names & behavior) =====
long credits = 0;           // Current coins inserted (was money in template)
long timeRemaining = 0;     // Seconds left running
long totalTime = 0;         // Total session time (for UI display if needed)
bool isActive = false;      // Machine is running

int minCreditsToStart = 50;         // Minimum coins to start
int secondsForMinCredits = 3000;    // Seconds for min credit unit
int salesToday = 0;
int totalEarnings = 0;

// ===== TIMING & STATE (unchanged) =====
unsigned long lastTick = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastLCDSwitch = 0;
bool showAltScreen = false;

// ===== COIN INPUT (unchanged) =====
int coinState = HIGH;
int lastCoinState = HIGH;
int pulseCount = 0;
unsigned long lastPulseTime = 0;
static unsigned long lastValidPulse = 0;

// ===== HTTP HELPERS (REPLACE BLYNK) =====
void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

bool isAuthorizedRequest() {
  if (sessionToken.length() == 0) return false;
  String auth = server.header("Authorization");
  return auth == ("Bearer " + sessionToken);
}

// ===== SSR CONTROL (unchanged) =====
void updateSSR() {
  digitalWrite(SSR_PIN, (isActive && timeRemaining > 0));
}

// ===== WIFI SETUP (unchanged multi-network logic) =====
void connectWiFi() {
  for (int i = 0; i < 3; i++) {
    WiFi.begin(ssidList[i], passList[i]);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 6000) {
      delay(300);
    }
    if (WiFi.status() == WL_CONNECTED) break;
  }
}

// ===== PERSISTENCE (unchanged) =====
void saveState() {
  prefs.putLong("credits", credits);
  prefs.putLong("time", timeRemaining);
  prefs.putInt("sales", salesToday);
  prefs.putInt("totalEarn", totalEarnings);
  prefs.putBool("running", isActive);
  prefs.putInt("minC", minCreditsToStart);
  prefs.putInt("secMin", secondsForMinCredits);
}

// ===== LCD DISPLAY (unchanged) =====
void refreshLCD() {
  lcd.setCursor(0, 0);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print("                ");

  if (isActive) {
    if (showAltScreen && credits > 0) {
      lcd.setCursor(0, 0);
      lcd.print("CREDITS:");
      lcd.setCursor(0, 1);
      lcd.print(credits);
    } else {
      lcd.setCursor(0, 0);
      lcd.print("RUNNING");
      lcd.setCursor(0, 1);
      lcd.printf("%02d:%02d", timeRemaining / 60, timeRemaining % 60);
    }
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Credits:");
    lcd.print(credits);
    lcd.setCursor(0, 1);
    lcd.print("Insert Coin");
  }
}

// ===== HTTP ENDPOINT: POST /auth (REPLACES Blynk.login) =====
void handleAuth() {
  addCorsHeaders();
  
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  String username = doc["username"] | "";
  String password = doc["password"] | "";

  if (username != adminUser || password != adminPass) {
    server.send(401, "application/json", "{\"error\":\"Invalid credentials\"}");
    return;
  }

  // Generate session token (replaces Blynk auth token concept)
  sessionToken = String(millis()) + "-" + String(random(100000, 999999));
  
  DynamicJsonDocument res(256);
  res["token"] = sessionToken;
  res["status"] = "authenticated";
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: GET /status (REPLACES Blynk.virtualRead) =====
void handleStatus() {
  addCorsHeaders();

  DynamicJsonDocument doc(512);
  doc["credits"] = credits;
  doc["remainingTime"] = timeRemaining;
  doc["totalTime"] = totalTime;
  doc["isActive"] = isActive;
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["minCreditsToStart"] = minCreditsToStart;
  doc["secondsPerMinCredit"] = secondsForMinCredits;
  doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  doc["wifiSignal"] = WiFi.RSSI();

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/reset-money (REPLACES VPIN_RESET_C logic) =====
void handleResetMoney() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  // Exact same logic as original BLYNK_WRITE(VPIN_RESET_C)
  credits = 0;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["credits"] = credits;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/add-time (REPLACES VPIN_ADD_TIME logic) =====
void handleAddTime() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  long seconds = doc["seconds"] | 0;
  
  // Exact same logic as original BLYNK_WRITE(VPIN_ADD_TIME)
  timeRemaining += seconds;
  isActive = true;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["remainingTime"] = timeRemaining;
  res["isActive"] = isActive;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/reset-time =====
void handleResetTime() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  timeRemaining = 0;
  isActive = false;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["remainingTime"] = timeRemaining;
  res["isActive"] = isActive;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/reset-credits =====
void handleResetCredits() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  credits = 0;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["credits"] = credits;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/reset-sales =====
void handleResetSales() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  salesToday = 0;
  saveState();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["salesToday"] = salesToday;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/pause-resume =====
void handlePauseResume() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  isActive = !isActive;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["isActive"] = isActive;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: POST /control/settings =====
void handleUpdateSettings() {
  addCorsHeaders();
  
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  if (doc.containsKey("minCreditsToStart")) {
    minCreditsToStart = doc["minCreditsToStart"];
  }
  if (doc.containsKey("secondsForMinCredits")) {
    secondsForMinCredits = doc["secondsForMinCredits"];
  }

  saveState();

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["minCreditsToStart"] = minCreditsToStart;
  res["secondsForMinCredits"] = secondsForMinCredits;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

// ===== HTTP ENDPOINT: OPTIONS (CORS preflight) =====
void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

// ===== HTTP ENDPOINT: GET / (service info) =====
void handleRoot() {
  addCorsHeaders();
  DynamicJsonDocument doc(256);
  doc["service"] = "romers-vendo";
  doc["version"] = "2.0.0-http";
  doc["firmware"] = "esp32_custom.ino";
  
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

// ===== REGISTER HTTP ENDPOINTS (REPLACES Blynk.begin) =====
void setupHttpServer() {
  server.on("/", HTTP_GET, handleRoot);
  
  // Authentication
  server.on("/auth", HTTP_POST, handleAuth);
  
  // Status monitoring
  server.on("/status", HTTP_GET, handleStatus);
  
  // Device controls
  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/add-time", HTTP_POST, handleAddTime);
  server.on("/control/reset-time", HTTP_POST, handleResetTime);
  server.on("/control/reset-credits", HTTP_POST, handleResetCredits);
  server.on("/control/reset-sales", HTTP_POST, handleResetSales);
  server.on("/control/pause-resume", HTTP_POST, handlePauseResume);
  server.on("/control/settings", HTTP_POST, handleUpdateSettings);
  
  // CORS preflight
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
      return;
    }
    addCorsHeaders();
    server.send(404, "application/json", "{\"error\":\"Not found\"}");
  });

  server.begin();
}

// ===== SETUP (UNCHANGED CORE LOGIC, REPLACED BLYNK) =====
void setup() {
  Serial.begin(115200);

  // Pin setup (unchanged)
  pinMode(SSR_PIN, OUTPUT);
  digitalWrite(SSR_PIN, LOW);
  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);

  // LCD setup (unchanged)
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();

  // Load state from NVS (unchanged)
  prefs.begin("pisowash", false);
  credits = prefs.getLong("credits", 0);
  timeRemaining = prefs.getLong("time", 0);
  salesToday = prefs.getInt("sales", 0);
  totalEarnings = prefs.getInt("totalEarn", 0);
  isActive = prefs.getBool("running", false);
  minCreditsToStart = prefs.getInt("minC", 50);
  secondsForMinCredits = prefs.getInt("secMin", 3000);

  if (timeRemaining <= 0) isActive = false;

  // WiFi setup (unchanged multi-network fallback)
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("Admin", "12345678");
  connectWiFi();

  // HTTP server setup (REPLACES Blynk.begin, Blynk.config, Blynk.connect)
  setupHttpServer();

  lastLCDUpdate = 0;
  refreshLCD();
}

// ===== MAIN LOOP (UNCHANGED CORE LOGIC, REPLACED Blynk.run) =====
void loop() {
  // Handle HTTP requests (replaces Blynk.run())
  server.handleClient();

  // ===== COIN DETECTION (UNCHANGED) =====
  coinState = digitalRead(COIN_PIN);

  if (coinState == LOW && lastCoinState == HIGH) {
    if (millis() - lastValidPulse > 100) {
      pulseCount++;
      lastPulseTime = millis();
      lastValidPulse = millis();
    }
  }

  lastCoinState = coinState;

  if (pulseCount > 0 && millis() - lastPulseTime > 500) {
    if (pulseCount != 1 && pulseCount != 5 && pulseCount != 10) {
      pulseCount = 0;
    } else {
      int coinValue = 0;
      if (pulseCount == 1) coinValue = 1;
      else if (pulseCount == 5) coinValue = 5;
      else if (pulseCount == 10) coinValue = 10;

      credits += coinValue;
      salesToday += coinValue;
      totalEarnings += coinValue;

      saveState();
      lastLCDUpdate = 0;
      refreshLCD();
    }

    pulseCount = 0;
  }

  // ===== BUTTON: CONVERT CREDITS TO TIME (UNCHANGED) =====
  if (digitalRead(BTN_PIN) == LOW) {
    delay(200);

    if (credits >= minCreditsToStart) {
      float multiplier = (float)credits / (float)minCreditsToStart;
      long addedTime = multiplier * secondsForMinCredits;

      timeRemaining += addedTime;
      credits = 0;

      isActive = true;
      lastLCDUpdate = 0;
      refreshLCD();
    }
  }

  // ===== TIMER COUNTDOWN (UNCHANGED) =====
  if (isActive && millis() - lastTick >= 1000) {
    lastTick = millis();

    if (timeRemaining > 0) {
      timeRemaining--;
    }

    if (timeRemaining <= 0) {
      isActive = false;
      timeRemaining = 0;
    }

    lastLCDUpdate = 0;
    refreshLCD();
  }

  // ===== LCD SCREEN ROTATION (UNCHANGED) =====
  if (isActive && credits > 0 && millis() - lastLCDSwitch >= 15000) {
    lastLCDSwitch = millis();
    showAltScreen = !showAltScreen;
    lastLCDUpdate = 0;
    refreshLCD();
  }

  // ===== RELAY CONTROL (UNCHANGED) =====
  updateSSR();
}
