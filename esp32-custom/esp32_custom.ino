#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Wire.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>

// LCD initialization
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

// Authentication
String adminUser = "admin";
String adminPass = "1234";
String sessionToken = "";

// WiFi Configuration
const char* setupApSsid = "Romers-Vendo-Setup";
const char* setupApPass = "12345678";
const byte DNS_PORT = 53;
IPAddress setupApIp(192, 168, 4, 1);
IPAddress setupApGateway(192, 168, 4, 1);
IPAddress setupApSubnet(255, 255, 255, 0);
bool inSetupMode = false;
bool setupApStarted = false;
int wifiFailCount = 0;
unsigned long lastWifiCheck = 0;

String staSsid = "";
String staPass = "";

// Pin Definitions
const int COIN_PIN = 16;
const int BTN_PIN = 17;
const int SSR_PIN = 23;

// Core State Variables (UNCHANGED LOGIC)
long credits = 0;
long timeRemaining = 0;
long totalTime = 0;
bool isActive = false;

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

// ===== HELPER FUNCTIONS =====

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

bool connectStationWifi() {
  if (staSsid.length() == 0) {
    Serial.println("No saved WiFi credentials. Starting setup hotspot.");
    return false;
  }

  inSetupMode = false;
  setupApStarted = false;
  WiFi.setSleep(false);
  WiFi.mode(WIFI_STA);
  delay(200);
  WiFi.disconnect(false);
  delay(200);
  WiFi.begin(staSsid.c_str(), staPass.c_str());

  Serial.print("Connecting to WiFi SSID: ");
  Serial.println(staSsid);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiFailCount = 0;
    Serial.print("Connected IP: http://");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("WiFi connection failed. Setup hotspot fallback required.");
  WiFi.disconnect(false);
  return false;
}

bool startSoftAPWithCurrentMode() {
  if (!WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet)) {
    Serial.println("WARNING: softAPConfig failed; continuing with default AP network.");
  }

  if (String(setupApPass).length() >= 8) {
    return WiFi.softAP(setupApSsid, setupApPass);
  }

  return WiFi.softAP(setupApSsid);
}

void startSetupAP() {
  inSetupMode = true;
  WiFi.setSleep(false);
  WiFi.disconnect(false);
  WiFi.mode(WIFI_AP_STA);
  delay(500);

  Serial.print("Starting setup hotspot: ");
  Serial.println(setupApSsid);

  setupApStarted = startSoftAPWithCurrentMode();
  if (!setupApStarted) {
    Serial.println("WARNING: WIFI_AP_STA hotspot start failed. Retrying in WIFI_AP mode.");
    WiFi.softAPdisconnect(true);
    delay(500);
    WiFi.mode(WIFI_AP);
    delay(500);
    setupApStarted = startSoftAPWithCurrentMode();
  }

  delay(500);
  if (setupApStarted) {
    dnsServer.stop();
    dnsServer.start(DNS_PORT, "*", setupApIp);
    Serial.println("Setup hotspot started successfully.");
    Serial.print("Setup AP SSID: ");
    Serial.println(setupApSsid);
    Serial.print("Setup AP IP: http://");
    Serial.println(WiFi.softAPIP());
    Serial.print("Setup AP clients: ");
    Serial.println(WiFi.softAPgetStationNum());
  } else {
    Serial.println("ERROR: Setup hotspot failed to start.");
  }
}


// ===== EMBEDDED WEB INTERFACE =====

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Romers Vendo Setup</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Arial, Helvetica, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    main {
      width: min(680px, 100%);
      background: #111827;
      border: 1px solid #334155;
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      padding: 28px;
    }

    h1, h2 {
      margin-top: 0;
    }

    .status-card, .wifi-card {
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 18px;
      margin-top: 18px;
      background: rgba(15, 23, 42, 0.72);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .metric {
      padding: 12px;
      border-radius: 12px;
      background: #1e293b;
    }

    .metric strong {
      display: block;
      font-size: 0.78rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric span {
      display: block;
      margin-top: 8px;
      font-size: 1.25rem;
      font-weight: 700;
    }

    button, input, select {
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 1rem;
    }

    button {
      margin-top: 12px;
      cursor: pointer;
      color: #082f49;
      background: #38bdf8;
      font-weight: 700;
    }

    button.secondary {
      background: #cbd5e1;
      color: #0f172a;
    }

    input, select {
      margin-top: 8px;
      background: #0f172a;
      border: 1px solid #475569;
      color: #f8fafc;
    }

    label {
      display: block;
      margin-top: 14px;
      color: #cbd5e1;
      font-weight: 700;
    }

    .message {
      min-height: 1.4em;
      color: #93c5fd;
      margin-top: 14px;
      word-break: break-word;
    }

    .error {
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <main>
    <h1>Romers Vendo</h1>
    <p>ESP32 web interface and WiFi setup portal.</p>

    <section class="status-card">
      <h2>Machine Status</h2>
      <div class="grid">
        <div class="metric"><strong>Money</strong><span id="money">--</span></div>
        <div class="metric"><strong>Remaining Time</strong><span id="remainingTime">--</span></div>
        <div class="metric"><strong>Total Time</strong><span id="totalTime">--</span></div>
        <div class="metric"><strong>Active</strong><span id="isActive">--</span></div>
        <div class="metric"><strong>IP</strong><span id="ipAddress">--</span></div>
      </div>
    </section>

    <section class="wifi-card">
      <h2>WiFi Setup</h2>
      <p id="wifiStatus" class="message">Checking WiFi status...</p>
      <button type="button" onclick="scanNetworks()">Scan Networks</button>

      <label for="ssidSelect">Network</label>
      <select id="ssidSelect" onchange="copySelectedSsid()">
        <option value="">Scan or enter SSID manually</option>
      </select>

      <label for="ssid">SSID</label>
      <input id="ssid" type="text" autocomplete="off" placeholder="WiFi SSID">

      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" placeholder="WiFi password">

      <button type="button" onclick="connectWifi()">Save WiFi and Reboot</button>
      <button class="secondary" type="button" onclick="pollStatus()">Refresh Status</button>
      <p id="setupMessage" class="message"></p>
    </section>
  </main>

  <script>
    function formatSeconds(seconds) {
      seconds = Number(seconds || 0);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function setMessage(text, isError = false) {
      const message = document.getElementById('setupMessage');
      message.textContent = text;
      message.className = isError ? 'message error' : 'message';
    }

    function copySelectedSsid() {
      const selected = document.getElementById('ssidSelect').value;
      if (selected) {
        document.getElementById('ssid').value = selected;
      }
    }

    async function scanNetworks() {
      setMessage('Scanning WiFi networks...');
      try {
        const response = await fetch('/api/scan-networks');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Unable to scan networks');
        }

        const select = document.getElementById('ssidSelect');
        select.innerHTML = '<option value="">Select a network</option>';
        (data.networks || []).forEach((network) => {
          const option = document.createElement('option');
          option.value = network.ssid;
          option.textContent = `${network.ssid} (${network.rssi} dBm${network.secure ? ', secured' : ', open'})`;
          select.appendChild(option);
        });
        setMessage(`Found ${(data.networks || []).length} network(s).`);
      } catch (error) {
        setMessage(error.message || 'Network scan failed.', true);
      }
    }

    async function connectWifi() {
      const ssid = document.getElementById('ssid').value.trim();
      const password = document.getElementById('password').value;
      if (!ssid) {
        setMessage('SSID is required.', true);
        return;
      }

      setMessage('Saving WiFi credentials...');
      try {
        const response = await fetch('/api/setup-wifi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ssid, password })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Unable to save WiFi credentials');
        }
        setMessage(data.message || 'WiFi credentials saved. Device will reboot.');
      } catch (error) {
        setMessage(error.message || 'WiFi setup failed.', true);
      }
    }

    async function pollStatus() {
      try {
        const [statusResponse, wifiResponse] = await Promise.all([
          fetch('/status'),
          fetch('/api/wifi-status')
        ]);
        const status = await statusResponse.json();
        const wifi = await wifiResponse.json();

        document.getElementById('money').textContent = status.money ?? '--';
        document.getElementById('remainingTime').textContent = formatSeconds(status.remainingTime);
        document.getElementById('totalTime').textContent = formatSeconds(status.totalTime);
        document.getElementById('isActive').textContent = status.isActive ? 'Yes' : 'No';
        document.getElementById('ipAddress').textContent = status.ip || wifi.ip || '--';
        document.getElementById('wifiStatus').textContent = wifi.connected
          ? `Connected to ${wifi.ssid} at ${wifi.ip}`
          : `Setup mode: connect to ${wifi.ssid} at ${wifi.ip}`;
      } catch (error) {
        document.getElementById('wifiStatus').textContent = 'Unable to load current status.';
      }
    }

    pollStatus();
    setInterval(pollStatus, 5000);
  </script>
</body>
</html>
)rawliteral";

// ===== HTTP HANDLERS =====

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
  sessionToken = String(millis()) + "-" + String(random(100000, 999999));
  DynamicJsonDocument res(128);
  res["token"] = sessionToken;
  String out;
  serializeJson(res, out);
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
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleResetMoney() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  credits = 0;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

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
  timeRemaining += seconds;
  isActive = true;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleRemoveTime() {
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
  if (seconds < 0) seconds = 0;
  if (timeRemaining > seconds) {
    timeRemaining -= seconds;
  } else {
    timeRemaining = 0;
  }
  if (timeRemaining <= 0) isActive = false;
  saveState();
  lastLCDUpdate = 0;
  refreshLCD();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleScanNetworks() {
  addCorsHeaders();
  if (inSetupMode && WiFi.getMode() == WIFI_AP) {
    WiFi.mode(WIFI_AP_STA);
    delay(300);
    if (!setupApStarted) {
      setupApStarted = startSoftAPWithCurrentMode();
      delay(300);
    }
  }

  int n = WiFi.scanNetworks(false, true);
  if (n < 0) {
    Serial.print("WiFi scan failed: ");
    Serial.println(n);
    server.send(500, "application/json", "{\"error\":\"Network scan failed\"}");
    return;
  }

  DynamicJsonDocument doc(3072);
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
  WiFi.scanDelete();
  server.send(200, "application/json", out);
}

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

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }
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
  server.on("/hotspot-detect.html", HTTP_GET, serveSetupPortal);
  server.on("/connecttest.txt", HTTP_GET, serveSetupPortal);
  server.on("/auth", HTTP_POST, handleAuth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/add-time", HTTP_POST, handleAddTime);
  server.on("/control/remove-time", HTTP_POST, handleRemoveTime);
  server.on("/api/scan-networks", HTTP_GET, handleScanNetworks);
  server.on("/api/setup-wifi", HTTP_POST, handleSetupWifi);
  server.on("/api/wifi-status", HTTP_GET, handleWifiStatus);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("HTTP server started on port 80.");
}

// ===== MAIN SETUP =====

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
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    delay(1500);
  }

  setupHttpServer();
  lastLCDUpdate = 0;
  refreshLCD();
}

// ===== MAIN LOOP =====

void loop() {
  server.handleClient();

  if (inSetupMode) {
    dnsServer.processNextRequest();
  }

  if (!inSetupMode && millis() - lastWifiCheck > 10000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      wifiFailCount++;
      WiFi.disconnect(false);
      delay(100);
      WiFi.begin(staSsid.c_str(), staPass.c_str());
      if (wifiFailCount >= 6) {
        startSetupAP();
      }
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

  // ===== BUTTON OPERATION =====
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

  // ===== TIMER COUNTDOWN =====
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
