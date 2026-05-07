#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Wire.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include <HTTPClient.h>

// LCD initialization
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

// Authentication
String adminUser = "admin";
String adminPass = "1234";
String sessionToken = "";

// Device identity and cloud-link metadata
String deviceId = "ESP0001";
String deviceSecret = "";
String backendUrl = "";
#ifndef DEVICE_BACKEND_URL
#define DEVICE_BACKEND_URL ""
#endif
const char* defaultBackendUrl = DEVICE_BACKEND_URL;
String ownerUid = "";
bool wifiStaEnabled = true;
String cloudJwt = "";
bool cloudAuthenticated = false;
unsigned long lastCloudHeartbeat = 0;
unsigned long lastCloudAuthAttempt = 0;

// WiFi Configuration
const char* setupApSsid = "Romers-Vendo-Setup";
const char* setupApPass = "12345678";
const byte DNS_PORT = 53;
const int setupApChannel = 6;
const bool setupApHidden = false;
const int setupApMaxConnections = 4;
IPAddress setupApIp(192, 168, 4, 1);
IPAddress setupApGateway(192, 168, 4, 1);
IPAddress setupApSubnet(255, 255, 255, 0);
bool inSetupMode = false;
bool setupApStarted = false;
int wifiFailCount = 0;
unsigned long lastWifiCheck = 0;
unsigned long lastApHealthCheck = 0;

String staSsid = "";
String staPass = "";

// Pin Definitions
const int COIN_PIN = 16;
const int BTN_PIN = 17;
const int SSR_PIN = 23;

// Core State Variables
long credits = 0;
long timeRemaining = 0;
long totalTime = 0;
bool isActive = false;
bool isPaused = false;

int minCreditsToStart = 50;
int secondsForMinCredits = 3000;
int salesToday = 0;
int totalEarnings = 0;

// Timing and State
unsigned long lastTick = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastLCDSwitch = 0;
bool showAltScreen = false;

// Coin Input State
int coinState = HIGH;
int lastCoinState = HIGH;
int pulseCount = 0;
unsigned long lastPulseTime = 0;
static unsigned long lastValidPulse = 0;

// ===== TIME FORMATTING HELPERS =====

String formatHHMMSS(long seconds) {
  if (seconds < 0) seconds = 0;
  long h = seconds / 3600;
  long m = (seconds % 3600) / 60;
  long s = seconds % 60;
  char buf[9];
  snprintf(buf, sizeof(buf), "%02ld:%02ld:%02ld", h, m, s);
  return String(buf);
}

String formatMMSS(long seconds) {
  if (seconds < 0) seconds = 0;
  long m = seconds / 60;
  long s = seconds % 60;
  char buf[6];
  snprintf(buf, sizeof(buf), "%02ld:%02ld", m, s);
  return String(buf);
}

// ===== HELPER FUNCTIONS =====

bool hasBearerToken(const String& token) {
  String auth = server.header("Authorization");
  return token.length() > 0 && auth == ("Bearer " + token);
}

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

bool isAuthorizedRequest() {
  return hasBearerToken(sessionToken) || hasBearerToken(deviceSecret);
}

void updateSSR() {
  digitalWrite(SSR_PIN, (isActive && !isPaused && timeRemaining > 0) ? HIGH : LOW);
}

void saveState() {
  prefs.putLong("credits", credits);
  prefs.putLong("time", timeRemaining);
  prefs.putLong("totalTime", totalTime);
  prefs.putInt("sales", salesToday);
  prefs.putInt("totalEarn", totalEarnings);
  prefs.putBool("running", isActive);
  prefs.putBool("paused", isPaused);
  prefs.putInt("minC", minCreditsToStart);
  prefs.putInt("secMin", secondsForMinCredits);
}

String normalizeBackendUrl(String url) {
  url.trim();
  while (url.endsWith("/")) url.remove(url.length() - 1);
  return url;
}

String backendApiUrl(const String& path) {
  String base = normalizeBackendUrl(backendUrl);
  if (base.length() == 0) return "";
  return base + path;
}

String randomHex(uint8_t bytes) {
  String out = "";
  for (uint8_t i = 0; i < bytes; i++) {
    uint8_t value = (uint8_t)(esp_random() & 0xFF);
    if (value < 16) out += "0";
    out += String(value, HEX);
  }
  out.toUpperCase();
  return out;
}

void loadDeviceIdentity() {
  deviceId = prefs.getString("device_id", "");
  deviceSecret = prefs.getString("dev_secret", "");
  adminUser = prefs.getString("admin_user", adminUser);
  adminPass = prefs.getString("admin_pass", adminPass);
  backendUrl = normalizeBackendUrl(prefs.getString("backend", String(defaultBackendUrl)));
  ownerUid = prefs.getString("owner_uid", "");
  wifiStaEnabled = prefs.getBool("wifi_on", true);
}

// ===== LCD DISPLAY =====

void refreshLCD() {
  lcd.clear();

  if (isActive) {
    if (isPaused) {
      lcd.setCursor(0, 0);
      lcd.print("** PAUSED **    ");
      lcd.setCursor(0, 1);
      lcd.print(formatHHMMSS(timeRemaining));
    } else if (showAltScreen && credits > 0) {
      lcd.setCursor(0, 0);
      lcd.print("CREDITS: ");
      lcd.print(credits);
      lcd.print("        ");
      lcd.setCursor(0, 1);
      lcd.print(formatHHMMSS(timeRemaining));
    } else {
      lcd.setCursor(0, 0);
      lcd.print("RUNNING         ");
      lcd.setCursor(0, 1);
      lcd.print(formatHHMMSS(timeRemaining));
    }
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Credits: ");
    lcd.print(credits);
    lcd.print("     ");
    lcd.setCursor(0, 1);
    if (WiFi.status() == WL_CONNECTED) {
      lcd.print("WiFi OK ");
      lcd.print(WiFi.RSSI());
      lcd.print("dBm  ");
    } else {
      lcd.print("Insert Coin     ");
    }
  }
}

// ===== CLOUD AUTH / HEARTBEAT =====

bool authenticateWithBackend() {
  if (backendUrl.length() == 0 || deviceId.length() == 0 || deviceSecret.length() == 0 || WiFi.status() != WL_CONNECTED) return false;
  if (cloudAuthenticated && cloudJwt.length() > 0) return true;
  if (millis() - lastCloudAuthAttempt < 10000) return false;
  lastCloudAuthAttempt = millis();

  HTTPClient http;
  String authUrl = backendApiUrl("/api/devices/auth");
  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(384);
  doc["device_id"] = deviceId;
  doc["device_secret"] = deviceSecret;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  String response = http.getString();
  http.end();

  if (code != 200) {
    Serial.printf("[CloudAuth] Failed HTTP %d\n", code);
    cloudJwt = "";
    cloudAuthenticated = false;
    return false;
  }

  DynamicJsonDocument res(768);
  if (deserializeJson(res, response)) {
    cloudJwt = "";
    cloudAuthenticated = false;
    return false;
  }

  cloudJwt = String((const char*)res["token"]);
  cloudAuthenticated = cloudJwt.length() > 0;
  Serial.println(cloudAuthenticated ? "[CloudAuth] OK" : "[CloudAuth] Missing token");
  return cloudAuthenticated;
}

void sendCloudHeartbeat() {
  if (backendUrl.length() == 0 || deviceId.length() == 0 || deviceSecret.length() == 0 || WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastCloudHeartbeat < 15000) return;
  if (!authenticateWithBackend()) return;
  lastCloudHeartbeat = millis();

  HTTPClient http;
  http.begin(backendApiUrl("/api/devices/heartbeat"));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + cloudJwt);

  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["status"] = "Connected";
  doc["connectionStatus"] = "Connected";
  doc["isConnected"] = true;
  doc["online"] = true;
  doc["money"] = credits;
  doc["moneyInserted"] = credits;
  doc["credits"] = credits;
  doc["remainingTime"] = timeRemaining;
  doc["totalTimeUsed"] = totalTime;
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["isActive"] = isActive;
  doc["isPaused"] = isPaused;
  doc["wifiConnected"] = true;
  doc["wifiSignal"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  doc["minCreditsToStart"] = minCreditsToStart;
  doc["secondsForMinCredits"] = secondsForMinCredits;
  JsonObject pricing = doc.createNestedObject("pricingSettings");
  pricing["minCreditsToStart"] = minCreditsToStart;
  pricing["secondsForMinCredits"] = secondsForMinCredits;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  http.end();

  if (code == 401 || code == 403) {
    cloudJwt = "";
    cloudAuthenticated = false;
    lastCloudAuthAttempt = 0;
  }
}

// ===== WIFI FUNCTIONS =====

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

void startSetupAP() {
  Serial.println("[AP] Starting Setup Access Point...");
  inSetupMode = true;
  setupApStarted = false;
  dnsServer.stop();
  WiFi.persistent(false);
  WiFi.setSleep(false);
  WiFi.disconnect(true);
  WiFi.softAPdisconnect(true);
  delay(300);
  WiFi.mode(WIFI_OFF);
  delay(500);
  WiFi.mode(WIFI_AP);
  delay(500);

  if (!WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet)) {
    Serial.println("[AP] WARNING: softAPConfig failed.");
  }
  delay(200);

  bool started = WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
  delay(1000);

  IPAddress currentIp = WiFi.softAPIP();
  bool ipOk = (currentIp == setupApIp);

  if (!started || !ipOk) {
    Serial.println("[AP] Retrying...");
    WiFi.softAPdisconnect(true);
    delay(700);
    WiFi.mode(WIFI_AP);
    delay(700);
    WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet);
    delay(200);
    started = WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
    delay(1000);
    currentIp = WiFi.softAPIP();
    ipOk = (currentIp == setupApIp);
  }

  setupApStarted = started && ipOk;
  if (setupApStarted) {
    dnsServer.start(DNS_PORT, "*", setupApIp);
    Serial.println("[AP] Hotspot OK");
    Serial.print("[AP] SSID: "); Serial.println(setupApSsid);
    Serial.print("[AP] IP: http://"); Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("[AP] ERROR: Hotspot failed.");
  }
}

bool connectStationWifi() {
  if (!wifiStaEnabled) { Serial.println("[STA] Disabled."); return false; }
  if (staSsid.length() == 0) { Serial.println("[STA] No credentials."); return false; }

  Serial.print("[STA] Connecting: "); Serial.println(staSsid);
  WiFi.mode(WIFI_AP_STA);
  delay(300);
  WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet);
  WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
  delay(500);

  WiFi.begin(staSsid.c_str(), staPass.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiFailCount = 0;
    inSetupMode = false;
    Serial.print("[STA] Connected! http://"); Serial.println(WiFi.localIP());
    return true;
  }
  Serial.println("[STA] Failed.");
  WiFi.disconnect(false);
  return false;
}

void ensureSetupAP() {
  if (millis() - lastApHealthCheck < 30000) return;
  lastApHealthCheck = millis();
  IPAddress currentIp = WiFi.softAPIP();
  bool ipOk = (currentIp == setupApIp);
  if (!setupApStarted || !ipOk) {
    Serial.println("[AP] Health check failed. Restarting...");
    bool wasInSetupMode = inSetupMode;
    if (WiFi.status() == WL_CONNECTED) {
      WiFi.softAPdisconnect(true);
      delay(500);
      WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet);
      delay(200);
      setupApStarted = WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
      delay(1000);
      if (setupApStarted) {
        dnsServer.stop();
        dnsServer.start(DNS_PORT, "*", setupApIp);
      }
    } else {
      startSetupAP();
    }
    inSetupMode = wasInSetupMode;
  }
}

// ===== EMBEDDED WEB DASHBOARD =====
// NOTE: Delimiter changed from "rawliteral" to "HTMLEOF" to avoid any
// accidental match inside the HTML/JS content, which caused the compiler
// to leak out of the string and treat JS "function" as C++ tokens.

const char index_html[] PROGMEM = R"HTMLEOF(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Romers Vendo Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');
  :root {
    --bg: #060a0f;
    --panel: #0d1520;
    --border: #1a2d45;
    --accent: #00d4ff;
    --accent2: #ff6b35;
    --green: #00ff88;
    --red: #ff3355;
    --yellow: #ffcc00;
    --text: #c8ddf0;
    --dim: #4a6080;
    --mono: 'Share Tech Mono', monospace;
    --ui: 'Rajdhani', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--ui);
    min-height: 100vh;
    padding: 16px;
    background-image:
      radial-gradient(ellipse at 20% 0%, rgba(0,212,255,0.06) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 100%, rgba(255,107,53,0.05) 0%, transparent 60%);
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }
  .logo {
    width: 42px; height: 42px;
    background: linear-gradient(135deg, var(--accent), #0055ff);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700; color: #000; font-family: var(--mono);
  }
  header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.05em; }
  header p { font-size: 0.8rem; color: var(--dim); font-family: var(--mono); }
  .online-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: blink 2s infinite;
    margin-left: auto;
    flex-shrink: 0;
  }
  .online-dot.offline { background: var(--red); box-shadow: 0 0 8px var(--red); animation: none; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 20px; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.4;
  }
  .card.active::before { background: linear-gradient(90deg, transparent, var(--green), transparent); opacity: 1; }
  .card.warn::before { background: linear-gradient(90deg, transparent, var(--yellow), transparent); opacity: 1; }
  .card label {
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--dim); font-weight: 600; display: block; margin-bottom: 8px;
  }
  .card .val {
    font-family: var(--mono);
    font-size: 1.6rem;
    font-weight: 700;
    color: #fff;
    line-height: 1;
  }
  .card .val.big { font-size: 1.9rem; color: var(--accent); }
  .card .val.green { color: var(--green); }
  .card .val.red { color: var(--red); }
  .card .val.yellow { color: var(--yellow); }
  .card .sub { font-size: 0.72rem; color: var(--dim); margin-top: 6px; font-family: var(--mono); }

  .section {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 14px;
  }
  .section h2 {
    font-size: 1rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent);
    margin-bottom: 16px; padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .btn-row { display: flex; flex-wrap: wrap; gap: 10px; }
  button {
    font-family: var(--ui); font-size: 0.9rem; font-weight: 700;
    border: none; border-radius: 8px; cursor: pointer;
    padding: 10px 18px; letter-spacing: 0.05em;
    transition: all 0.15s; text-transform: uppercase;
  }
  .btn-primary { background: var(--accent); color: #000; }
  .btn-primary:hover { background: #33ddff; box-shadow: 0 0 16px rgba(0,212,255,0.4); }
  .btn-danger { background: var(--red); color: #fff; }
  .btn-danger:hover { background: #ff5577; box-shadow: 0 0 16px rgba(255,51,85,0.4); }
  .btn-warn { background: var(--yellow); color: #000; }
  .btn-warn:hover { box-shadow: 0 0 16px rgba(255,204,0,0.4); }
  .btn-success { background: var(--green); color: #000; }
  .btn-success:hover { box-shadow: 0 0 16px rgba(0,255,136,0.4); }
  .btn-ghost {
    background: transparent; color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

  .form-row { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 0.75rem; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: 0.08em; }
  input, select {
    background: #080f1a;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: #fff;
    font-family: var(--mono);
    font-size: 0.95rem;
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }
  input:focus, select:focus { border-color: var(--accent); }
  .message {
    font-family: var(--mono);
    font-size: 0.82rem;
    padding: 10px 14px;
    border-radius: 8px;
    margin-top: 12px;
    display: none;
  }
  .message.show { display: block; }
  .message.ok { background: rgba(0,255,136,0.1); color: var(--green); border: 1px solid rgba(0,255,136,0.3); }
  .message.err { background: rgba(255,51,85,0.1); color: var(--red); border: 1px solid rgba(255,51,85,0.3); }

  .wifi-info { font-family: var(--mono); font-size: 0.82rem; color: var(--dim); margin-bottom: 14px; }
  .badge {
    display: inline-block; font-size: 0.72rem; font-weight: 700;
    padding: 3px 8px; border-radius: 5px; text-transform: uppercase;
    letter-spacing: 0.07em; font-family: var(--ui);
  }
  .badge.on { background: rgba(0,255,136,0.15); color: var(--green); border: 1px solid rgba(0,255,136,0.3); }
  .badge.off { background: rgba(255,51,85,0.15); color: var(--red); border: 1px solid rgba(255,51,85,0.3); }
  .badge.pause { background: rgba(255,204,0,0.15); color: var(--yellow); border: 1px solid rgba(255,204,0,0.3); }

  .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
  footer {
    text-align: center; font-size: 0.75rem; font-family: var(--mono);
    color: var(--dim); padding-top: 14px; margin-top: 8px;
    border-top: 1px solid var(--border);
  }
  #refreshIndicator {
    width: 6px; height: 6px; border-radius: 50%;
    display: inline-block; background: var(--accent);
    margin-left: 6px; vertical-align: middle;
    transition: opacity 0.1s;
  }
</style>
</head>
<body>

<header>
  <div class="logo">RV</div>
  <div>
    <h1>Romers Vendo</h1>
    <p id="deviceIdLabel">ESP32 Dashboard</p>
  </div>
  <div id="onlineDot" class="online-dot offline" title="Connection status"></div>
</header>

<!-- STATUS CARDS -->
<div class="grid">
  <div class="card active" id="cardTimer">
    <label>&#9201; Remaining Time</label>
    <div class="val big" id="remainingTime">--:--:--</div>
    <div class="sub" id="timerStatus">&#8212;</div>
  </div>
  <div class="card">
    <label>&#128176; Money / Credits</label>
    <div class="val green" id="money">--</div>
    <div class="sub" id="moneyNote">credits inserted</div>
  </div>
  <div class="card">
    <label>&#128202; Machine Status</label>
    <div class="val" id="statusBadge">--</div>
    <div class="sub" id="totalTimeDisplay">&#8212;</div>
  </div>
  <div class="card">
    <label>&#128225; WiFi</label>
    <div class="val" id="wifiStatus">--</div>
    <div class="sub" id="wifiIp">&#8212;</div>
  </div>
  <div class="card">
    <label>&#128200; Sales Today</label>
    <div class="val yellow" id="salesToday">--</div>
    <div class="sub">&#8369; collected today</div>
  </div>
  <div class="card">
    <label>&#128185; Total Earnings</label>
    <div class="val" id="totalEarnings">--</div>
    <div class="sub">&#8369; all time</div>
  </div>
  <div class="card">
    <label>&#128101; AP Clients</label>
    <div class="val" id="apClients">--</div>
    <div class="sub">connected to hotspot</div>
  </div>
  <div class="card">
    <label>&#128246; Signal</label>
    <div class="val" id="wifiSignal">--</div>
    <div class="sub">dBm RSSI</div>
  </div>
</div>

<!-- CONTROLS -->
<div class="section">
  <h2>&#9889; Controls</h2>
  <div class="btn-row">
    <button class="btn-danger" onclick="doResetMoney()">Reset Money</button>
    <button class="btn-danger" onclick="doResetTimer()">Reset Timer</button>
    <button class="btn-warn" id="pauseBtn" onclick="doPause()">Pause</button>
    <button class="btn-success" id="resumeBtn" onclick="doResume()">Resume</button>
    <button class="btn-ghost" onclick="pollStatus()">&#8634; Refresh</button>
  </div>
  <hr class="divider">
  <div class="form-row">
    <div class="field">
      <label>Add Time (seconds)</label>
      <input type="number" id="addSeconds" placeholder="e.g. 300">
    </div>
    <div class="field">
      <label>&nbsp;</label>
      <button class="btn-primary" onclick="doAddTime()" style="height:42px">Add Time</button>
    </div>
    <div class="field">
      <label>Remove Time (seconds)</label>
      <input type="number" id="removeSeconds" placeholder="e.g. 60">
    </div>
    <div class="field">
      <label>&nbsp;</label>
      <button class="btn-danger" onclick="doRemoveTime()" style="height:42px">Remove Time</button>
    </div>
  </div>
  <div id="ctrlMsg" class="message"></div>
</div>

<!-- SETTINGS -->
<div class="section">
  <h2>&#9881;&#65039; Pricing Settings</h2>
  <div class="form-row">
    <div class="field">
      <label>Min Credits to Start (&#8369;)</label>
      <input type="number" id="minCredits" placeholder="e.g. 50">
    </div>
    <div class="field">
      <label>Seconds for Min Credits</label>
      <input type="number" id="secondsMin" placeholder="e.g. 3000">
    </div>
  </div>
  <div style="margin-top:10px; font-family:var(--mono); font-size:0.8rem; color:var(--dim)" id="ratePreview">&#8212;</div>
  <div class="btn-row" style="margin-top:14px">
    <button class="btn-primary" onclick="saveSettings()">Save Pricing</button>
  </div>
  <div id="settingsMsg" class="message"></div>
</div>

<!-- ADMIN LOGIN -->
<div class="section">
  <h2>&#128274; Admin Login</h2>
  <div class="form-row">
    <div class="field">
      <label>Username</label>
      <input type="text" id="loginUser" value="admin">
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="loginPass" value="1234">
    </div>
  </div>
  <div class="btn-row" style="margin-top:12px">
    <button class="btn-primary" onclick="doLogin()">Login</button>
  </div>
  <div id="loginMsg" class="message"></div>
</div>

<!-- WIFI SETUP -->
<div class="section">
  <h2>&#128246; WiFi Setup</h2>
  <p class="wifi-info" id="wifiDetail">Loading...</p>
  <button class="btn-ghost" onclick="scanNetworks()" style="margin-bottom:12px">Scan Networks</button>
  <div class="form-row">
    <div class="field">
      <label>Network (scan results)</label>
      <select id="ssidSelect" onchange="document.getElementById('ssid').value=this.value">
        <option value="">&#8212; Scan first &#8212;</option>
      </select>
    </div>
    <div class="field">
      <label>SSID</label>
      <input type="text" id="ssid" placeholder="Network name">
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="wifiPass" placeholder="WiFi password">
    </div>
  </div>
  <div class="btn-row" style="margin-top:12px">
    <button class="btn-primary" onclick="connectWifi()">Save &amp; Reboot</button>
  </div>
  <div id="wifiMsg" class="message"></div>
</div>

<!-- DEVICE CREDENTIALS -->
<div class="section">
  <h2>&#128273; App Device Credentials</h2>
  <div class="form-row">
    <div class="field">
      <label>Device ID (from app)</label>
      <input type="text" id="credDeviceId" placeholder="RV-...">
    </div>
    <div class="field">
      <label>Device Secret (from app)</label>
      <input type="password" id="credSecret" placeholder="RVS-...">
    </div>
    <div class="field">
      <label>Backend URL (optional)</label>
      <input type="text" id="credBackend" placeholder="https://...">
    </div>
  </div>
  <div class="btn-row" style="margin-top:12px">
    <button class="btn-primary" onclick="saveCredentials()">Save Credentials</button>
  </div>
  <div id="credMsg" class="message"></div>
</div>

<footer>
  Romers Vendo ESP32 &nbsp;|&nbsp; Auto-refresh every 3s
  <span id="refreshIndicator"></span>
</footer>

<script>
var authToken = '';
var lastData = {};

function fmtHMS(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  return [h, m, s].map(function(v){ return String(v).padStart(2,'0'); }).join(':');
}

function showMsg(id, text, type) {
  type = type || 'ok';
  var el = document.getElementById(id);
  el.textContent = text;
  el.className = 'message show ' + type;
  setTimeout(function(){ el.className = 'message'; }, 4000);
}

function flash() {
  var dot = document.getElementById('refreshIndicator');
  dot.style.opacity = '0';
  setTimeout(function(){ dot.style.opacity = '1'; }, 120);
}

function authHeader() {
  return authToken
    ? { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function pollStatus() {
  Promise.all([
    fetch('/status'),
    fetch('/api/wifi-status'),
    fetch('/api/device-info')
  ]).then(function(responses) {
    return Promise.all(responses.map(function(r){ return r.json(); }));
  }).then(function(results) {
    var s = results[0];
    var w = results[1];
    var d = results[2];
    lastData = s;
    updateDashboard(s, w, d);
    flash();
  }).catch(function() {
    document.getElementById('onlineDot').className = 'online-dot offline';
  });
}

function updateDashboard(s, w, d) {
  document.getElementById('onlineDot').className = 'online-dot' + (s.wifiConnected ? '' : '');
  document.getElementById('onlineDot').title = s.wifiConnected ? 'Connected' : 'Setup Mode';

  if (d.deviceId) document.getElementById('deviceIdLabel').textContent = 'Device: ' + d.deviceId;

  document.getElementById('remainingTime').textContent = fmtHMS(s.remainingTime);

  var timerLabel = 'Idle';
  if (s.isActive && s.isPaused) timerLabel = 'Paused';
  else if (s.isActive) timerLabel = 'Running';
  document.getElementById('timerStatus').textContent = timerLabel;

  var card = document.getElementById('cardTimer');
  card.className = 'card ' + (s.isActive && !s.isPaused ? 'active' : s.isPaused ? 'warn' : '');

  document.getElementById('money').textContent = '\u20B1' + (s.money != null ? s.money : 0);

  var badge = '<span class="badge off">Idle</span>';
  if (s.isActive && s.isPaused) badge = '<span class="badge pause">Paused</span>';
  else if (s.isActive) badge = '<span class="badge on">Active</span>';
  document.getElementById('statusBadge').innerHTML = badge;
  document.getElementById('totalTimeDisplay').textContent = 'Total used: ' + fmtHMS(s.totalTime);

  document.getElementById('wifiStatus').textContent = w.connected ? '\u2714 ' + (w.ssid || '') : '\u2716 Setup AP';
  document.getElementById('wifiIp').textContent = w.ip || '\u2014';
  document.getElementById('wifiDetail').textContent = w.connected
    ? ('Connected to ' + w.ssid + ' \u00B7 IP: ' + w.ip)
    : ('Setup mode \u00B7 SSID: Romers-Vendo-Setup \u00B7 http://192.168.4.1');

  document.getElementById('salesToday').textContent = '\u20B1' + (s.salesToday != null ? s.salesToday : 0);
  document.getElementById('totalEarnings').textContent = '\u20B1' + (s.totalEarnings != null ? s.totalEarnings : 0);
  document.getElementById('wifiSignal').textContent = s.wifiSignal ? s.wifiSignal + ' dBm' : '--';
  document.getElementById('apClients').textContent = d.apClients != null ? d.apClients : '--';

  if (!document.getElementById('minCredits').value && s.minCreditsToStart)
    document.getElementById('minCredits').value = s.minCreditsToStart;
  if (!document.getElementById('secondsMin').value && s.secondsForMinCredits)
    document.getElementById('secondsMin').value = s.secondsForMinCredits;

  updateRatePreview();

  if (!document.getElementById('credDeviceId').value && d.deviceId)
    document.getElementById('credDeviceId').value = d.deviceId;
  if (!document.getElementById('credBackend').value && d.backendUrl)
    document.getElementById('credBackend').value = d.backendUrl;
}

function updateRatePreview() {
  var c = parseInt(document.getElementById('minCredits').value) || 0;
  var s = parseInt(document.getElementById('secondsMin').value) || 0;
  if (c && s) {
    var minPerPeso = (s / c / 60).toFixed(1);
    var hrPer10 = (s * 10 / c / 3600).toFixed(2);
    document.getElementById('ratePreview').textContent =
      '\u20B11 = ' + minPerPeso + ' min \u00B7 \u20B110 = ' + hrPer10 + ' hr';
  }
}
document.getElementById('minCredits').addEventListener('input', updateRatePreview);
document.getElementById('secondsMin').addEventListener('input', updateRatePreview);

function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  fetch('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  }).then(function(r) {
    return r.json().then(function(d) { return { ok: r.ok, data: d }; });
  }).then(function(res) {
    if (!res.ok) throw new Error(res.data.error || 'Login failed');
    authToken = res.data.token;
    showMsg('loginMsg', 'Logged in. Token stored for this session.', 'ok');
  }).catch(function(e) {
    showMsg('loginMsg', e.message, 'err');
  });
}

function doResetMoney() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  if (!confirm('Reset money/credits to 0?')) return;
  fetch('/control/reset-money', { method: 'POST', headers: authHeader() })
    .then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Money reset.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function doResetTimer() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  if (!confirm('Reset timer to 0?')) return;
  fetch('/control/reset-timer', { method: 'POST', headers: authHeader() })
    .then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Timer reset.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function doPause() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  fetch('/pause', { method: 'POST', headers: authHeader() })
    .then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Paused.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function doResume() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  fetch('/resume', { method: 'POST', headers: authHeader() })
    .then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Resumed.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function doAddTime() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  var sec = parseInt(document.getElementById('addSeconds').value);
  if (!sec || sec <= 0) { showMsg('ctrlMsg', 'Enter valid seconds.', 'err'); return; }
  fetch('/control/add-time', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ seconds: sec })
  }).then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Added ' + fmtHMS(sec) + '.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function doRemoveTime() {
  if (!authToken) { showMsg('ctrlMsg', 'Login first.', 'err'); return; }
  var sec = parseInt(document.getElementById('removeSeconds').value);
  if (!sec || sec <= 0) { showMsg('ctrlMsg', 'Enter valid seconds.', 'err'); return; }
  fetch('/control/remove-time', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ seconds: sec })
  }).then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('ctrlMsg', 'Removed ' + fmtHMS(sec) + '.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('ctrlMsg', e.message, 'err'); });
}

function saveSettings() {
  if (!authToken) { showMsg('settingsMsg', 'Login first.', 'err'); return; }
  var minC = parseInt(document.getElementById('minCredits').value);
  var secM = parseInt(document.getElementById('secondsMin').value);
  if (!minC || !secM || minC < 1 || secM < 1) {
    showMsg('settingsMsg', 'Both values must be positive numbers.', 'err'); return;
  }
  fetch('/control/settings', {
    method: 'POST', headers: authHeader(),
    body: JSON.stringify({ minCreditsToStart: minC, secondsForMinCredits: secM })
  }).then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('settingsMsg', 'Pricing saved.', 'ok');
      updateRatePreview();
    }).catch(function(e) { showMsg('settingsMsg', e.message, 'err'); });
}

function scanNetworks() {
  showMsg('wifiMsg', 'Scanning...', 'ok');
  fetch('/api/scan-networks')
    .then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Scan failed');
      var sel = document.getElementById('ssidSelect');
      sel.innerHTML = '<option value="">\u2014 Select \u2014</option>';
      (res.data.networks || []).forEach(function(n) {
        var o = document.createElement('option');
        o.value = n.ssid;
        o.textContent = n.ssid + ' (' + n.rssi + ' dBm' + (n.secure ? ', locked' : '') + ')';
        sel.appendChild(o);
      });
      showMsg('wifiMsg', 'Found ' + (res.data.networks || []).length + ' networks.', 'ok');
    }).catch(function(e) { showMsg('wifiMsg', e.message, 'err'); });
}

function connectWifi() {
  var ssid = document.getElementById('ssid').value.trim();
  var pass = document.getElementById('wifiPass').value;
  if (!ssid) { showMsg('wifiMsg', 'SSID required.', 'err'); return; }
  fetch('/api/setup-wifi', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid: ssid, password: pass })
  }).then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('wifiMsg', 'Saved. Rebooting device...', 'ok');
    }).catch(function(e) { showMsg('wifiMsg', e.message, 'err'); });
}

function saveCredentials() {
  var id = document.getElementById('credDeviceId').value.trim();
  var sec = document.getElementById('credSecret').value.trim();
  var url = document.getElementById('credBackend').value.trim();
  if (!id || !sec) { showMsg('credMsg', 'Device ID and Secret required.', 'err'); return; }
  fetch('/api/device-credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: id, deviceSecret: sec, backendUrl: url })
  }).then(function(r) { return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || 'Failed');
      showMsg('credMsg', 'Credentials saved.', 'ok');
      pollStatus();
    }).catch(function(e) { showMsg('credMsg', e.message, 'err'); });
}

pollStatus();
setInterval(pollStatus, 3000);
</script>
</body>
</html>
)HTMLEOF";

// ===== HTTP HANDLERS =====

void handleAuth() {
  addCorsHeaders();
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  String username = doc["username"] | "";
  String password = doc["password"] | "";
  if (username != adminUser || password != adminPass) { server.send(401, "application/json", "{\"error\":\"Invalid credentials\"}"); return; }
  sessionToken = String(millis()) + "-" + String(random(100000, 999999));
  DynamicJsonDocument res(384);
  res["token"] = sessionToken;
  res["deviceId"] = deviceId;
  res["deviceSecretConfigured"] = deviceSecret.length() > 0;
  String out; serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleStatus() {
  addCorsHeaders();
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  if (isAuthorizedRequest()) doc["deviceSecret"] = deviceSecret;
  doc["deviceSecretConfigured"] = deviceSecret.length() > 0;
  doc["money"] = credits;
  doc["moneyInserted"] = credits;
  doc["credits"] = credits;
  doc["remainingTime"] = timeRemaining;
  doc["remainingTimeFormatted"] = formatHHMMSS(timeRemaining);
  doc["totalTime"] = totalTime;
  doc["totalTimeUsed"] = totalTime;
  doc["totalTimeFormatted"] = formatHHMMSS(totalTime);
  doc["isActive"] = isActive;
  doc["isPaused"] = isPaused;
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["minCreditsToStart"] = minCreditsToStart;
  doc["secondsForMinCredits"] = secondsForMinCredits;
  doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  doc["wifiSignal"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  doc["connectionStatus"] = (WiFi.status() == WL_CONNECTED) ? "online" : "setup-ap";
  doc["ip"] = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
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

void handleResetTimer() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  timeRemaining = 0;
  isActive = false;
  isPaused = false;
  updateSSR();
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handlePause() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  isPaused = true;
  updateSSR();
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true,\"isPaused\":true}");
}

void handleResume() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  isPaused = false;
  if (timeRemaining > 0) isActive = true;
  updateSSR();
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true,\"isPaused\":false}");
}

void handleAddTime() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  long seconds = doc["seconds"] | 0;
  if (seconds <= 0) { server.send(400, "application/json", "{\"error\":\"seconds must be positive\"}"); return; }
  timeRemaining += seconds;
  isActive = true;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleRemoveTime() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  long seconds = doc["seconds"] | 0;
  if (seconds <= 0) seconds = 0;
  timeRemaining = (timeRemaining > seconds) ? timeRemaining - seconds : 0;
  if (timeRemaining <= 0) { isActive = false; isPaused = false; }
  updateSSR();
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleUpdateSettings() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  int nextMinCredits = doc["minCreditsToStart"] | minCreditsToStart;
  int nextSeconds = doc["secondsForMinCredits"] | secondsForMinCredits;
  if (doc.containsKey("secondsForMinCredit")) nextSeconds = doc["secondsForMinCredit"];
  if (nextMinCredits < 1 || nextSeconds < 1) { server.send(400, "application/json", "{\"error\":\"Values must be positive\"}"); return; }
  minCreditsToStart = nextMinCredits;
  secondsForMinCredits = nextSeconds;
  saveState();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleWifiControl() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  wifiStaEnabled = doc["enabled"] | true;
  prefs.putBool("wifi_on", wifiStaEnabled);
  if (wifiStaEnabled) { connectStationWifi(); }
  else { WiFi.disconnect(false); inSetupMode = true; if (!setupApStarted) startSetupAP(); }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleDeviceInfo() {
  addCorsHeaders();
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["deviceSecretConfigured"] = deviceSecret.length() > 0;
  doc["credentialsConfigured"] = deviceId.length() > 0 && deviceSecret.length() > 0;
  doc["backendUrl"] = backendUrl;
  doc["ownerUid"] = ownerUid;
  doc["ip"] = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  doc["setupIp"] = WiFi.softAPIP().toString();
  doc["ssid"] = setupApSsid;
  doc["apClients"] = WiFi.softAPgetStationNum();
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleDeviceCredentialsConfig() {
  addCorsHeaders();
  if (deviceSecret.length() > 0 && !isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(768);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  String nextDeviceId = doc["deviceId"] | "";
  String nextDeviceSecret = doc["deviceSecret"] | "";
  String nextBackend = normalizeBackendUrl(doc["backendUrl"] | backendUrl);
  String nextOwnerUid = doc["ownerUid"] | ownerUid;
  if (nextDeviceId.length() == 0 || nextDeviceSecret.length() < 16) { server.send(400, "application/json", "{\"error\":\"Device ID and a secure deviceSecret are required\"}"); return; }
  deviceId = nextDeviceId;
  deviceSecret = nextDeviceSecret;
  backendUrl = nextBackend;
  ownerUid = nextOwnerUid;
  prefs.putString("device_id", deviceId);
  prefs.putString("dev_secret", deviceSecret);
  prefs.putString("backend", backendUrl);
  prefs.putString("owner_uid", ownerUid);
  lastCloudHeartbeat = 0; cloudJwt = ""; cloudAuthenticated = false; lastCloudAuthAttempt = 0;
  DynamicJsonDocument res(384);
  res["ok"] = true; res["deviceId"] = deviceId; res["credentialsConfigured"] = true;
  res["backendUrl"] = backendUrl; res["ownerUid"] = ownerUid;
  res["ip"] = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String out; serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleConfigAuth() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  String nextUser = doc["username"] | adminUser;
  String nextPass = doc["password"] | adminPass;
  String nextBackend = normalizeBackendUrl(doc["backendUrl"] | backendUrl);
  if (nextUser.length() == 0 || nextPass.length() == 0) { server.send(400, "application/json", "{\"error\":\"Username and password are required\"}"); return; }
  adminUser = nextUser; adminPass = nextPass;
  backendUrl = normalizeBackendUrl(nextBackend);
  prefs.putString("admin_user", adminUser);
  prefs.putString("admin_pass", adminPass);
  prefs.putString("backend", backendUrl);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleVendoState() { handleStatus(); }

void handleVendoUpdateTime() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) { server.send(401, "application/json", "{\"error\":\"Unauthorized\"}"); return; }
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  long delta = doc["delta"] | 0;
  if (delta >= 0) { timeRemaining += delta; isActive = true; }
  else { long sec = -delta; timeRemaining = (timeRemaining > sec) ? timeRemaining - sec : 0; if (timeRemaining <= 0) { isActive = false; isPaused = false; } }
  updateSSR(); saveState(); lastLCDUpdate = 0; refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleScanNetworks() {
  addCorsHeaders();
  if (WiFi.getMode() == WIFI_AP) {
    WiFi.mode(WIFI_AP_STA);
    delay(300);
    WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet);
    WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
    delay(500);
  }
  int n = WiFi.scanNetworks(false, true);
  if (n < 0) { server.send(500, "application/json", "{\"error\":\"Scan failed\"}"); return; }
  DynamicJsonDocument doc(3072);
  JsonArray networks = doc.createNestedArray("networks");
  for (int i = 0; i < n; i++) {
    JsonObject net = networks.createNestedObject();
    net["ssid"] = WiFi.SSID(i);
    net["rssi"] = WiFi.RSSI(i);
    net["channel"] = WiFi.channel(i);
    net["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? 1 : 0;
  }
  String out; serializeJson(doc, out);
  WiFi.scanDelete();
  server.send(200, "application/json", out);
}

void handleSetupWifi() {
  addCorsHeaders();
  if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"error\":\"Missing body\"}"); return; }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}"); return; }
  String ssid = doc["ssid"] | "";
  String pass = doc["password"] | "";
  if (ssid.length() == 0) { server.send(400, "application/json", "{\"error\":\"SSID required\"}"); return; }
  wifiStaEnabled = true;
  prefs.putBool("wifi_on", true);
  saveWifiCredentials(ssid, pass);
  DynamicJsonDocument res(256);
  res["ok"] = true; res["message"] = "WiFi credentials saved. Rebooting..."; res["ssid"] = ssid;
  String out; serializeJson(res, out);
  server.send(200, "application/json", out);
  delay(1000);
  ESP.restart();
}

void handleWifiStatus() {
  addCorsHeaders();
  DynamicJsonDocument doc(256);
  bool connected = (WiFi.status() == WL_CONNECTED);
  doc["connected"] = connected;
  if (connected) {
    doc["ip"] = WiFi.localIP().toString();
    doc["ssid"] = WiFi.SSID();
    doc["rssi"] = WiFi.RSSI();
  } else {
    doc["ip"] = WiFi.softAPIP().toString();
    doc["ssid"] = setupApSsid;
    doc["mode"] = "setup";
  }
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleOptions() { addCorsHeaders(); server.send(204); }

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) { handleOptions(); return; }
  if (inSetupMode) { server.sendHeader("Location", "http://192.168.4.1/", true); server.send(302, "text/plain", ""); return; }
  addCorsHeaders();
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

void serveSetupPortal() {
  addCorsHeaders();
  server.send_P(200, "text/html", index_html);
}

void setupHttpServer() {
  server.on("/", HTTP_GET, serveSetupPortal);
  server.on("/generate_204", HTTP_GET, serveSetupPortal);
  server.on("/gen_204", HTTP_GET, serveSetupPortal);
  server.on("/hotspot-detect.html", HTTP_GET, serveSetupPortal);
  server.on("/connecttest.txt", HTTP_GET, serveSetupPortal);
  server.on("/ncsi.txt", HTTP_GET, serveSetupPortal);
  server.on("/redirect", HTTP_GET, serveSetupPortal);

  server.on("/auth", HTTP_POST, handleAuth);
  server.on("/login", HTTP_POST, handleAuth);

  server.on("/status", HTTP_GET, handleStatus);

  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/reset-timer", HTTP_POST, handleResetTimer);
  server.on("/control/add-time", HTTP_POST, handleAddTime);
  server.on("/control/remove-time", HTTP_POST, handleRemoveTime);
  server.on("/control/settings", HTTP_POST, handleUpdateSettings);
  server.on("/control/wifi", HTTP_POST, handleWifiControl);
  server.on("/pause", HTTP_POST, handlePause);
  server.on("/resume", HTTP_POST, handleResume);

  server.on("/device/info", HTTP_GET, handleDeviceInfo);
  server.on("/api/device-info", HTTP_GET, handleDeviceInfo);
  server.on("/api/config-auth", HTTP_POST, handleConfigAuth);
  server.on("/api/device-credentials", HTTP_POST, handleDeviceCredentialsConfig);

  server.on("/vendo/state", HTTP_GET, handleVendoState);
  server.on("/vendo/reset-money", HTTP_POST, handleResetMoney);
  server.on("/vendo/update-time", HTTP_POST, handleVendoUpdateTime);

  server.on("/api/scan-networks", HTTP_GET, handleScanNetworks);
  server.on("/api/setup-wifi", HTTP_POST, handleSetupWifi);
  server.on("/api/wifi-status", HTTP_GET, handleWifiStatus);

  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("[HTTP] Server started on port 80.");
}

// ===== SETUP =====

void setup() {
  Serial.begin(115200);
  pinMode(SSR_PIN, OUTPUT);
  digitalWrite(SSR_PIN, LOW);
  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();

  prefs.begin("pisowash", false);
  loadDeviceIdentity();
  credits = prefs.getLong("credits", 0);
  timeRemaining = prefs.getLong("time", 0);
  totalTime = prefs.getLong("totalTime", 0);
  salesToday = prefs.getInt("sales", 0);
  totalEarnings = prefs.getInt("totalEarn", 0);
  isActive = prefs.getBool("running", false);
  isPaused = prefs.getBool("paused", false);
  minCreditsToStart = prefs.getInt("minC", 50);
  secondsForMinCredits = prefs.getInt("secMin", 3000);

  if (timeRemaining <= 0) { isActive = false; isPaused = false; }

  loadWifiCredentials();

  startSetupAP();

  if (wifiStaEnabled && staSsid.length() > 0) {
    if (connectStationWifi()) { inSetupMode = false; }
    else { inSetupMode = true; if (!setupApStarted) startSetupAP(); }
  } else {
    inSetupMode = true;
  }

  if (WiFi.status() == WL_CONNECTED) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi Connected");
    lcd.setCursor(0, 1); lcd.print(WiFi.localIP().toString());
    delay(1500);
  } else {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Setup AP:");
    lcd.setCursor(0, 1); lcd.print("192.168.4.1");
    delay(1500);
  }

  setupHttpServer();
  updateSSR();
  lastLCDUpdate = 0;
  refreshLCD();
}

// ===== LOOP =====

void loop() {
  server.handleClient();

  if (setupApStarted) {
    dnsServer.processNextRequest();
    ensureSetupAP();
  }

  sendCloudHeartbeat();

  if (wifiStaEnabled && !inSetupMode && millis() - lastWifiCheck > 10000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      wifiFailCount++;
      WiFi.disconnect(false);
      delay(100);
      WiFi.mode(WIFI_AP_STA);
      delay(100);
      WiFi.begin(staSsid.c_str(), staPass.c_str());
      if (wifiFailCount >= 6) { inSetupMode = true; startSetupAP(); }
    } else {
      wifiFailCount = 0;
    }
  }

  // ===== COIN DETECTION =====
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
    if (pulseCount == 1 || pulseCount == 5 || pulseCount == 10) {
      int coinValue = (pulseCount == 1) ? 1 : (pulseCount == 5) ? 5 : 10;
      credits += coinValue;
      salesToday += coinValue;
      totalEarnings += coinValue;
      saveState();
      lastLCDUpdate = 0;
      refreshLCD();
    }
    pulseCount = 0;
  }

  // ===== BUTTON: Start session =====
  if (digitalRead(BTN_PIN) == LOW) {
    delay(200);
    if (credits >= minCreditsToStart) {
      float multiplier = (float)credits / (float)minCreditsToStart;
      long addedTime = (long)(multiplier * secondsForMinCredits);
      timeRemaining += addedTime;
      credits = 0;
      isActive = true;
      isPaused = false;
      lastLCDUpdate = 0;
      refreshLCD();
    }
  }

  // ===== TIMER COUNTDOWN =====
  if (isActive && !isPaused) {
    unsigned long now = millis();
    if (now - lastTick >= 1000) {
      unsigned long elapsed = (now - lastTick) / 1000;
      lastTick = now - ((now - lastTick) % 1000);
      if (timeRemaining > (long)elapsed) {
        timeRemaining -= (long)elapsed;
        totalTime += (long)elapsed;
      } else {
        totalTime += timeRemaining;
        timeRemaining = 0;
      }
      if (timeRemaining <= 0) {
        isActive = false;
        isPaused = false;
        timeRemaining = 0;
      }
      saveState();
      lastLCDUpdate = 0;
      refreshLCD();
    }
  } else if (!isActive) {
    lastTick = millis();
  }

  // ===== LCD SCREEN ROTATION =====
  if (isActive && credits > 0 && millis() - lastLCDSwitch >= 15000) {
    lastLCDSwitch = millis();
    showAltScreen = !showAltScreen;
    lastLCDUpdate = 0;
    refreshLCD();
  }

  // ===== RELAY CONTROL =====
  updateSSR();
}
