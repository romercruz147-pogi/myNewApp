#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Wire.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

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
const int setupApChannel = 6;           // FIX: Channel 6 is more universally detectable
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


// ========================================
// BACKEND DEVICE AUTHENTICATION CONFIG
// ========================================
// TODO: Update these with your actual values
String deviceId = "romers_001";         // Device identifier (must match backend)
String deviceSecret = "your_device_secret_min_32_chars_long_random_hex_string_here";  // Secure token (min 32 chars)
String backendUrl = "http://192.168.0.100:8080";  // Backend URL (change IP to your PC)
String backendToken = "";                // JWT token from backend (auto-generated)
unsigned long lastBackendAuthAttempt = 0;
unsigned long lastHeartbeatSent = 0;
const unsigned long backendAuthRetryMs = 15000;    // Retry auth every 15 seconds
const unsigned long heartbeatIntervalMs = 10000;   // Send heartbeat every 10 seconds

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
volatile unsigned long isrPulseCount = 0;
volatile unsigned long isrLastPulseMicros = 0;

void IRAM_ATTR onCoinPulse() {
  unsigned long nowMicros = micros();
  if (nowMicros - isrLastPulseMicros < 80000) return; // 80ms debounce for noisy coin lines
  isrPulseCount++;
  isrLastPulseMicros = nowMicros;
}

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

// FIX: Dedicated function to reliably bring up AP-only mode
// The root cause of phones not detecting the AP was:
// 1. WiFi.persistent(true) could store conflicting STA config
// 2. Switching modes too fast without enough settle delays
// 3. softAPConfig() called before mode was stable
void startSetupAP() {
  Serial.println("[AP] Starting Setup Access Point...");

  inSetupMode = true;
  setupApStarted = false;

  // FIX: Stop DNS server first to avoid port conflict on retry
  dnsServer.stop();

  // FIX: Disable persistent storage so old STA credentials
  //      don't fight with our AP config on boot
  WiFi.persistent(false);
  WiFi.setSleep(false);

  // Fully tear down any existing WiFi state
  WiFi.disconnect(true);
  WiFi.softAPdisconnect(true);
  delay(300);
  WiFi.mode(WIFI_OFF);
  delay(500);  // FIX: Give the radio time to fully power down

  // Bring up AP mode only
  WiFi.mode(WIFI_AP);
  delay(500);  // FIX: Must wait for mode to stabilise before softAPConfig

  // Configure AP network
  if (!WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet)) {
    Serial.println("[AP] WARNING: softAPConfig failed, using defaults.");
  }
  delay(200);

  // Start the AP
  bool started = WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);

  // FIX: Longer settle delay — phones need the beacon to be broadcast
  //      for ~500 ms before they detect the network during a scan
  delay(1000);

  IPAddress currentIp = WiFi.softAPIP();
  bool ipOk = (currentIp == setupApIp);

  if (!started || !ipOk) {
    // One automatic retry
    Serial.println("[AP] First attempt failed. Retrying...");
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
    // Start captive-portal DNS — redirect every domain to our IP
    dnsServer.start(DNS_PORT, "*", setupApIp);
    Serial.println("[AP] Setup hotspot started successfully.");
    Serial.print("[AP] SSID: "); Serial.println(setupApSsid);
    Serial.print("[AP] IP:   http://"); Serial.println(WiFi.softAPIP());
  } else {
    Serial.println("[AP] ERROR: Setup hotspot failed to start.");
  }
}

bool connectStationWifi() {
  if (staSsid.length() == 0) {
    Serial.println("[STA] No saved credentials.");
    return false;
  }

  Serial.print("[STA] Connecting to: ");
  Serial.println(staSsid);

  // FIX: Use AP+STA mode so the setup AP stays reachable while
  //      we attempt to join the user's router
  WiFi.mode(WIFI_AP_STA);
  delay(300);

  // Re-apply AP config so it doesn't drop while in AP_STA mode
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
    Serial.print("[STA] Connected! IP: http://");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("[STA] Connection failed.");
  WiFi.disconnect(false);
  return false;
}

void ensureSetupAP() {
  if (millis() - lastApHealthCheck < 30000) return;
  lastApHealthCheck = millis();

  IPAddress currentIp = WiFi.softAPIP();
  bool ipOk = (currentIp == setupApIp);

  if (!setupApStarted || !ipOk) {
    Serial.println("[AP] Health check failed. Restarting hotspot.");
    bool wasInSetupMode = inSetupMode;

    // FIX: In AP_STA mode we need to restart just the AP portion
    //      without tearing down the STA connection
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
  } else {
    Serial.print("[AP] Hotspot OK — clients: ");
    Serial.println(WiFi.softAPgetStationNum());
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
    setInterval(pollStatus, 2000);
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
  doc["moneyInserted"] = credits;
  doc["remainingTime"] = timeRemaining;
  doc["totalTime"] = totalTime;
  doc["totalTimeUsed"] = totalTime;
  doc["isActive"] = isActive;
  doc["salesToday"] = salesToday;
  doc["totalEarnings"] = totalEarnings;
  doc["minCreditsToStart"] = minCreditsToStart;
  doc["secondsForMinCredits"] = secondsForMinCredits;
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["wifiSignal"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
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
  // FIX: In WIFI_AP mode switch to AP_STA for scanning, then restore AP config
  if (WiFi.getMode() == WIFI_AP) {
    WiFi.mode(WIFI_AP_STA);
    delay(300);
    // Re-apply AP config so it stays up during the scan
    WiFi.softAPConfig(setupApIp, setupApGateway, setupApSubnet);
    WiFi.softAP(setupApSsid, setupApPass, setupApChannel, setupApHidden, setupApMaxConnections);
    delay(500);
  }

  int n = WiFi.scanNetworks(false, true);
  if (n < 0) {
    Serial.print("[SCAN] Failed: ");
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
  // FIX: Captive portal redirect — iOS/Android will auto-open the browser
  //      when they detect a redirect from a known captive portal probe URL
  if (inSetupMode) {
    String redirectUrl = "http://192.168.4.1/";
    server.sendHeader("Location", redirectUrl, true);
    server.send(302, "text/plain", "");
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
  // Captive portal probe URLs for Android, iOS, Windows
  server.on("/generate_204", HTTP_GET, serveSetupPortal);
  server.on("/gen_204", HTTP_GET, serveSetupPortal);
  server.on("/hotspot-detect.html", HTTP_GET, serveSetupPortal);
  server.on("/connecttest.txt", HTTP_GET, serveSetupPortal);
  server.on("/ncsi.txt", HTTP_GET, serveSetupPortal);
  server.on("/redirect", HTTP_GET, serveSetupPortal);
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
  Serial.println("[HTTP] Server started on port 80.");
}


bool backendAuthenticate() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[AUTH] Cannot authenticate: WiFi not connected");
    return false;
  }
  
  Serial.println("[AUTH] Attempting authentication with backend...");
  Serial.print("[AUTH] URL: "); Serial.println(backendUrl + "/api/device/connect");
  Serial.print("[AUTH] Device ID: "); Serial.println(deviceId);
  
  // Use HTTPClient for both HTTP and HTTPS
  HTTPClient http;
  String url = backendUrl + "/api/device/connect";
  
  if (!http.begin(url)) {
    Serial.println("[AUTH] Failed to create HTTP connection");
    return false;
  }
  
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument req(256);
  req["deviceId"] = deviceId;
  req["deviceSecret"] = deviceSecret;
  String body;
  serializeJson(req, body);
  
  Serial.println("[AUTH] Sending request...");
  int code = http.POST(body);
  
  if (code <= 0) {
    Serial.print("[AUTH] Connection failed: ");
    Serial.println(http.errorToString(code));
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();
  
  Serial.print("[AUTH] Response code: "); Serial.println(code);
  Serial.print("[AUTH] Response: "); Serial.println(response);
  
  if (code != 200) {
    Serial.print("[AUTH] Authentication failed with code: ");
    Serial.println(code);
    return false;
  }

  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, response)) {
    Serial.println("[AUTH] Failed to parse response JSON");
    return false;
  }
  
  backendToken = String((const char*)(doc["token"] | ""));
  
  if (backendToken.length() > 0) {
    Serial.println("[AUTH] ✓ Authentication successful!");
    Serial.print("[AUTH] Token: ");
    Serial.println(backendToken.substring(0, 20) + "...");
    return true;
  }
  
  Serial.println("[AUTH] Token not received in response");
  return false;
}

void sendHeartbeatToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return;  // Silently skip if no WiFi
  }
  
  if (backendToken.length() == 0) {
    return;  // No token yet, skip heartbeat
  }

  HTTPClient http;
  String url = backendUrl + "/api/devices/heartbeat";
  
  if (!http.begin(url)) {
    Serial.println("[HB] Failed to create HTTP connection");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + backendToken);

  // Payload with field names matching backend expectations
  DynamicJsonDocument payload(768);
  payload["credits"] = credits;                    // Current credits
  payload["remainingTime"] = timeRemaining;        // Time left in current session
  payload["salesToday"] = salesToday;              // Total sales today
  payload["totalEarnings"] = totalEarnings;        // Total earnings
  payload["isActive"] = isActive;                  // Machine running?
  payload["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  payload["wifiSignal"] = WiFi.RSSI();             // WiFi signal strength (dBm)
  payload["ip"] = WiFi.localIP().toString();       // ESP32 IP address
  payload["minCreditsToStart"] = minCreditsToStart;
  payload["secondsForMinCredits"] = secondsForMinCredits;

  String body;
  serializeJson(payload, body);
  
  int code = http.POST(body);
  http.end();
  
  if (code == 401 || code == 403) {
    // Token expired or invalid, clear it for re-authentication
    Serial.println("[HB] Token invalid (" + String(code) + "), will re-authenticate");
    backendToken = "";
  } else if (code == 200) {
    // Heartbeat accepted
    Serial.println("[HB] ✓ Heartbeat sent successfully");
  } else {
    Serial.print("[HB] Heartbeat failed with code: ");
    Serial.println(code);
  }
}

// ===== MAIN SETUP =====

void setup() {
  Serial.begin(115200);
  delay(500);  // Allow serial to stabilize
  
  // ===== STARTUP DIAGNOSTICS =====
  Serial.println("\n\n========================================");
  Serial.println("Romers Vendo ESP32 - Initializing");
  Serial.println("========================================");
  Serial.print("Device ID: ");
  Serial.println(deviceId);
  Serial.print("Backend URL: ");
  Serial.println(backendUrl);
  Serial.print("Heartbeat Interval: ");
  Serial.print(heartbeatIntervalMs / 1000);
  Serial.println(" seconds");
  
  pinMode(SSR_PIN, OUTPUT);
  digitalWrite(SSR_PIN, LOW);
  Serial.println("✓ SSR/Relay initialized");
  
  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(COIN_PIN), onCoinPulse, FALLING);
  Serial.println("✓ Coin sensor and button initialized");

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  Serial.println("✓ LCD initialized");

  prefs.begin("pisowash", false);
  credits = prefs.getLong("credits", 0);
  timeRemaining = prefs.getLong("time", 0);
  salesToday = prefs.getInt("sales", 0);
  totalEarnings = prefs.getInt("totalEarn", 0);
  isActive = prefs.getBool("running", false);
  minCreditsToStart = prefs.getInt("minC", 50);
  secondsForMinCredits = prefs.getInt("secMin", 3000);
  Serial.println("✓ Preferences loaded");

  if (timeRemaining <= 0) isActive = false;

  loadWifiCredentials();

  // FIX: Always start the AP first so a phone can always reach the device.
  //      Then attempt STA join on top of it (AP_STA mode).
  //      This way if STA fails the AP is still broadcasting — no blind spot.
  startSetupAP();

  if (staSsid.length() > 0) {
    if (connectStationWifi()) {
      inSetupMode = false;
    } else {
      inSetupMode = true;
      // AP was already started; re-verify it's still healthy
      if (!setupApStarted) startSetupAP();
    }
  } else {
    inSetupMode = true;
  }

  if (WiFi.status() == WL_CONNECTED) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    delay(1500);
  } else {
    // FIX: Show AP info on LCD so the user knows what to connect to
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Setup AP:");
    lcd.setCursor(0, 1);
    lcd.print("192.168.4.1");
    delay(1500);
  }

  setupHttpServer();
  lastLCDUpdate = 0;
  refreshLCD();
}

// ===== MAIN LOOP =====

void loop() {
  server.handleClient();

  if (setupApStarted) {
    dnsServer.processNextRequest();
    ensureSetupAP();
  }

  if (!inSetupMode && millis() - lastWifiCheck > 10000) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      wifiFailCount++;
      WiFi.disconnect(false);
      delay(100);
      // FIX: Keep WIFI_AP_STA so the setup AP stays alive during reconnect
      WiFi.mode(WIFI_AP_STA);
      delay(100);
      WiFi.begin(staSsid.c_str(), staPass.c_str());
      if (wifiFailCount >= 6) {
        inSetupMode = true;
        startSetupAP();
      }
    } else {
      wifiFailCount = 0;
    }
  }


  if (WiFi.status() == WL_CONNECTED) {
    if (backendToken.length() == 0 && millis() - lastBackendAuthAttempt > backendAuthRetryMs) {
      lastBackendAuthAttempt = millis();
      backendAuthenticate();
    }
    if (backendToken.length() > 0 && millis() - lastHeartbeatSent > heartbeatIntervalMs) {
      lastHeartbeatSent = millis();
      sendHeartbeatToBackend();
    }
  }

  // ===== COIN DETECTION =====
  noInterrupts();
  unsigned long pendingPulses = isrPulseCount;
  isrPulseCount = 0;
  interrupts();
  if (pendingPulses > 0) {
    pulseCount += (int)pendingPulses;
    lastPulseTime = millis();
    lastValidPulse = millis();
  }

  if (pulseCount > 0 && millis() - lastPulseTime > 280) {
    if (pulseCount != 1 && pulseCount != 5 && pulseCount != 10 && pulseCount != 20) {
      pulseCount = 0;
    } else {
      int coinValue = 0;
      if (pulseCount == 1) coinValue = 1;
      else if (pulseCount == 5) coinValue = 5;
      else if (pulseCount == 10) coinValue = 10;
      else if (pulseCount == 20) coinValue = 20;
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
