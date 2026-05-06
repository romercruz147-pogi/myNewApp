#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ===== LCD & SERVER =====
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
Preferences prefs;

// ===== AUTH =====
String adminUser = "admin";
String adminPass = "1234";
String sessionToken = "";

// ===== WIFI CONFIG (NEW CONNECTIVITY LAYER) =====
const char* setupApSsid = "VendoSetup";
const char* setupApPass = "12345678";
bool inSetupMode = false;
int wifiFailCount = 0;
unsigned long lastWifiCheck = 0;

String staSsid = "";
String staPass = "";

// ===== PINS (UNCHANGED) =====
const int COIN_PIN = 16;
const int BTN_PIN = 17;
const int SSR_PIN = 23;

// ===== CORE STATE VARIABLES (UNCHANGED LOGIC) =====
long credits = 0;
long timeRemaining = 0;
long totalTime = 0;
bool isActive = false;

int minCreditsToStart = 50;
int secondsForMinCredits = 3000;
int salesToday = 0;
int totalEarnings = 0;

// ===== TIMING & STATE (UNCHANGED) =====
unsigned long lastTick = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastLCDSwitch = 0;
bool showAltScreen = false;

// ===== COIN INPUT (UNCHANGED) =====
int coinState = HIGH;
int lastCoinState = HIGH;
int pulseCount = 0;
unsigned long lastPulseTime = 0;
static unsigned long lastValidPulse = 0;

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

void updateSSR() {
  digitalWrite(SSR_PIN, (isActive && timeRemaining > 0));
}

void saveState() {
  prefs.putLong("credits", credits);
  prefs.putLong("time", timeRemaining);
  prefs.putInt("sales", salesToday);
  prefs.putInt("totalEarn", totalEarnings);
  prefs.putBool("running", isActive);
  prefs.putInt("minC", minCreditsToStart);
  prefs.putInt("secMin", secondsForMinCredits);
}

void refreshLCD() {
  lcd.setCursor(0, 0); lcd.print("                ");
  lcd.setCursor(0, 1); lcd.print("                ");

  if (isActive) {
    if (showAltScreen && credits > 0) {
      lcd.setCursor(0, 0); lcd.print("CREDITS:");
      lcd.setCursor(0, 1); lcd.print(credits);
    } else {
      lcd.setCursor(0, 0); lcd.print("RUNNING");
      lcd.setCursor(0, 1); lcd.printf("%02d:%02d", timeRemaining / 60, timeRemaining % 60);
    }
  } else {
    lcd.setCursor(0, 0); lcd.print("Credits:"); lcd.print(credits);
    lcd.setCursor(0, 1); lcd.print("Insert Coin");
  }
}

// ===== NEW: WIFI CREDENTIAL STORAGE =====
void loadWifiCredentials() {
  staSsid = prefs.getString("wifi_ssid", "");
  staPass = prefs.getString("wifi_pass", "");
}

void saveWifiCredentials(const String& ssid, const String& pass) {
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", pass);
  staSsid = ssid;
  staPass = pass;
}

bool connectStationWifi() {
  if (staSsid.length() == 0) return false;

  WiFi.mode(WIFI_STA);
  WiFi.begin(staSsid.c_str(), staPass.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected IP: http://");
    Serial.println(WiFi.localIP());
    return true;
  }
  return false;
}

void startSetupAP() {
  inSetupMode = true;
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(setupApSsid, setupApPass);
  Serial.print("Setup AP IP: http://");
  Serial.println(WiFi.softAPIP());
}

String setupPortalPage() {
  int n = WiFi.scanNetworks();
  String html = "<html><body><h2>Vendo WiFi Setup</h2>";
  html += "<form method='POST' action='/setup/save'>SSID:<select name='ssid'>";
  for (int i = 0; i < n; i++) {
    html += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  html += "</select><br>Password:<input name='pass' type='password'/><br><button>Save</button></form>";
  html += "</body></html>";
  return html;
}

void handleSetupRoot() {
  server.send(200, "text/html", setupPortalPage());
}

void handleSetupSave() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  if (ssid.length() == 0) {
    server.send(400, "text/plain", "SSID required");
    return;
  }
  saveWifiCredentials(ssid, pass);
  server.send(200, "text/plain", "Saved. Rebooting to connect...");
  delay(1200);
  ESP.restart();
}

// ===== NEW: API ENDPOINT FOR WIFI SCAN (JSON) =====
void handleScanNetworks() {
  addCorsHeaders();
  
  int n = WiFi.scanNetworks();
  DynamicJsonDocument doc(2048);
  JsonArray networks = doc.createNestedArray("networks");
  
  for (int i = 0; i < n; i++) {
    JsonObject net = networks.createNestedObject();
    net["ssid"] = WiFi.SSID(i);
    net["rssi"] = WiFi.RSSI(i);
    net["channel"] = WiFi.channel(i);
    net["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? 1 : 0;
  }
  
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

// ===== NEW: API ENDPOINT FOR WIFI CONNECT (JSON) =====
void handleSetupWifi() {
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
  
  String ssid = doc["ssid"] | "";
  String pass = doc["password"] | "";
  
  if (ssid.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"SSID required\"}");
    return;
  }
  
  saveWifiCredentials(ssid, pass);
  
  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["message"] = "WiFi credentials saved. Rebooting...";
  res["ssid"] = ssid;
  
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
  
  delay(1000);
  ESP.restart();
}

// ===== NEW: ENDPOINT FOR WIFI STATUS =====
void handleWifiStatus() {
  addCorsHeaders();
  
  DynamicJsonDocument doc(256);
  doc["connected"] = WiFi.status() == WL_CONNECTED ? true : false;
  if (WiFi.status() == WL_CONNECTED) {
    doc["ip"] = WiFi.localIP().toString();
    doc["ssid"] = WiFi.SSID();
    doc["rssi"] = WiFi.RSSI();
  } else {
    doc["ip"] = WiFi.softAPIP().toString();
    doc["ssid"] = setupApSsid;
    doc["mode"] = "setup";
  }
  
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleAuth() {
  addCorsHeaders();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return;
  }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return;
  }
  String username = doc["username"] | "";
  String password = doc["password"] | "";
  if (username != adminUser || password != adminPass) {
    server.send(401, "application/json", "{\"error\":\"Invalid credentials\"}"); return;
  }
  sessionToken = String(millis()) + "-" + String(random(100000, 999999));
  DynamicJsonDocument res(128);
  res["token"] = sessionToken;
  String out; serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleStatus() {
  addCorsHeaders();
  DynamicJsonDocument doc(512);
  doc["money"] = credits;
  doc["remainingTime"] = timeRemaining;
  doc["totalTime"] = totalTime;
  doc["isActive"] = isActive;
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleResetMoney() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  credits = 0;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleAddTime() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  long seconds = doc["seconds"] | 0;
  timeRemaining += seconds;
  isActive = true;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleOptions() { addCorsHeaders(); server.send(204); }

void handleWebUi() {
  if (!server.authenticate(adminUser.c_str(), adminPass.c_str())) return server.requestAuthentication();
  String p = "<html><body><h2>Vendo Status</h2>";
  p += "<p>Money: " + String(credits) + "</p>";
  p += "<p>Remaining: " + String(timeRemaining) + "</p>";
  p += "<p>IP: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString()) + "</p>";
  p += "</body></html>";
  server.send(200, "text/html", p);
}

void setupHttpServer() {
  server.on("/", HTTP_GET, [](){ addCorsHeaders(); server.send(200, "application/json", "{\"service\":\"romers-vendo\"}"); });
  server.on("/ui", HTTP_GET, handleWebUi);
  server.on("/auth", HTTP_POST, handleAuth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/add-time", HTTP_POST, handleAddTime);

  // WiFi Setup Endpoints (NEW)
  server.on("/setup", HTTP_GET, handleSetupRoot);
  server.on("/setup/save", HTTP_POST, handleSetupSave);
  server.on("/api/scan-networks", HTTP_GET, handleScanNetworks);     // NEW: Scan WiFi in JSON
  server.on("/api/setup-wifi", HTTP_POST, handleSetupWifi);          // NEW: Set WiFi in JSON
  server.on("/api/wifi-status", HTTP_GET, handleWifiStatus);         // NEW: Get WiFi status

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) return handleOptions();
    addCorsHeaders();
    server.send(404, "application/json", "{\"error\":\"Not found\"}");
  });
  server.begin();
}

void setup() {
  Serial.begin(115200);
  pinMode(SSR_PIN, OUTPUT); digitalWrite(SSR_PIN, LOW);
  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);

  Wire.begin(21, 22);
  lcd.init(); lcd.backlight();

  prefs.begin("pisowash", false);
  credits = prefs.getLong("credits", 0);
  timeRemaining = prefs.getLong("time", 0);
  salesToday = prefs.getInt("sales", 0);
  totalEarnings = prefs.getInt("totalEarn", 0);
  isActive = prefs.getBool("running", false);
  minCreditsToStart = prefs.getInt("minC", 50);
  secondsForMinCredits = prefs.getInt("secMin", 3000);
  if (timeRemaining <= 0) isActive = false;

  loadWifiCredentials();
  if (!connectStationWifi()) {
    startSetupAP();
  }

  if (WiFi.status() == WL_CONNECTED) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi Connected");
    lcd.setCursor(0, 1); lcd.print(WiFi.localIP().toString());
    delay(1500);
  }

  setupHttpServer();
  lastLCDUpdate = 0;
  refreshLCD();
}

void loop() {
  server.handleClient();

  if (!inSetupMode && millis() - lastWifiCheck > 10000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      wifiFailCount++;
      WiFi.disconnect();
      WiFi.begin(staSsid.c_str(), staPass.c_str());
      if (wifiFailCount >= 6) {
        startSetupAP();
      }
    } else {
      wifiFailCount = 0;
    }
  }

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

  if (isActive && millis() - lastTick >= 1000) {
    lastTick = millis();
    if (timeRemaining > 0) timeRemaining--;
    if (timeRemaining <= 0) {
      isActive = false;
      timeRemaining = 0;
    }
    lastLCDUpdate = 0;
    refreshLCD();
  }

  if (isActive && credits > 0 && millis() - lastLCDSwitch >= 15000) {
    lastLCDSwitch = millis();
    showAltScreen = !showAltScreen;
    lastLCDUpdate = 0;
    refreshLCD();
  }

  updateSSR();
}
