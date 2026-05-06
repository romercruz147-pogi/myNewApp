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

// Device identity and cloud-link metadata (Secure credential extension)
String deviceId = "";
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
  digitalWrite(SSR_PIN, (isActive && timeRemaining > 0));
}

void saveState() {
  prefs.putLong("credits", credits);
  prefs.putLong("time", timeRemaining);
  prefs.putLong("totalTime", totalTime);
  prefs.putInt("sales", salesToday);
  prefs.putInt("totalEarn", totalEarnings);
  prefs.putBool("running", isActive);
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
  if (base.endsWith("/api/devices/heartbeat") && path == "/api/devices/heartbeat") return base;
  if (base.endsWith("/api/devices/auth") && path == "/api/devices/auth") return base;
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

  // Secure credential: the mobile app/Firebase is the authority for
  // deviceId and deviceSecret.  The ESP32 only loads stored credentials here
  // and waits for /api/device-credentials or the setup portal until credentials are configured.
}

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
    Serial.printf("[CloudAuth] Failed with HTTP %d\n", code);
    cloudJwt = "";
    cloudAuthenticated = false;
    return false;
  }

  DynamicJsonDocument res(768);
  if (deserializeJson(res, response)) {
    Serial.println("[CloudAuth] Invalid JSON response");
    cloudJwt = "";
    cloudAuthenticated = false;
    return false;
  }

  cloudJwt = String((const char*)res["token"]);
  cloudAuthenticated = cloudJwt.length() > 0;
  Serial.println(cloudAuthenticated ? "[CloudAuth] Authenticated" : "[CloudAuth] Missing token");
  return cloudAuthenticated;
}

void sendCloudHeartbeat() {
  if (backendUrl.length() == 0 || deviceId.length() == 0 || deviceSecret.length() == 0 || WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastCloudHeartbeat < 15000) return;

  if (!authenticateWithBackend()) return;
  lastCloudHeartbeat = millis();

  HTTPClient http;
  String heartbeatUrl = backendApiUrl("/api/devices/heartbeat");
  http.begin(heartbeatUrl);
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
  doc["wifiConnected"] = true;
  doc["wifiSignal"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  doc["minCreditsToStart"] = minCreditsToStart;
  doc["secondsForMinCredits"] = secondsForMinCredits;
  JsonObject pricing = doc.createNestedObject("pricingSettings");
  pricing["onePesoMinutes"] = max(1, secondsForMinCredits / 60);
  pricing["tenPesoMinutes"] = max(1, (secondsForMinCredits * 10) / 60);
  pricing["minCreditsToStart"] = minCreditsToStart;
  pricing["secondsForMinCredits"] = secondsForMinCredits;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  http.end();

  if (code == 401 || code == 403) {
    Serial.println("[CloudHeartbeat] Token rejected; re-authenticating next loop");
    cloudJwt = "";
    cloudAuthenticated = false;
    lastCloudAuthAttempt = 0;
  }
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
  if (!wifiStaEnabled) {
    Serial.println("[STA] Station WiFi disabled by app setting.");
    return false;
  }

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
        <div class="metric"><strong>Device ID</strong><span id="deviceId">--</span></div>
        <div class="metric"><strong>deviceSecret</strong><span id="deviceSecret">--</span></div>
      </div>
    </section>

    <section class="wifi-card">
      <h2>App Device Credentials</h2>
      <p class="message">Paste the Device ID and deviceSecret generated in the mobile app. The ESP32 stores these credentials and uses them for authenticated heartbeat/control.</p>
      <label for="credentialDeviceId">Device ID from app</label>
      <input id="credentialDeviceId" type="text" autocomplete="off" placeholder="RV-...">
      <label for="credentialDeviceSecret">deviceSecret from app</label>
      <input id="credentialDeviceSecret" type="password" autocomplete="off" placeholder="RVS-...">
      <label for="backendUrl">Heartbeat backend URL (optional)</label>
      <input id="backendUrl" type="text" autocomplete="off" placeholder="https://.../deviceHeartbeat">
      <button type="button" onclick="saveDeviceCredentials()">Save App Device Credentials</button>
      <p id="credentialMessage" class="message"></p>
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

    async function saveDeviceCredentials() {
      const deviceId = document.getElementById('credentialDeviceId').value.trim();
      const deviceSecret = document.getElementById('credentialDeviceSecret').value.trim();
      const backendUrl = document.getElementById('backendUrl').value.trim();
      const message = document.getElementById('credentialMessage');
      if (!deviceId || !deviceSecret) {
        message.textContent = 'Device ID and deviceSecret are required.';
        message.className = 'message error';
        return;
      }
      message.textContent = 'Saving app-generated credentials...';
      message.className = 'message';
      try {
        const response = await fetch('/api/device-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, deviceSecret, backendUrl })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to save device credentials');
        message.textContent = 'Device credentials saved. Reboot or connect WiFi to start heartbeats.';
        pollStatus();
      } catch (error) {
        message.textContent = error.message || 'Credential save failed.';
        message.className = 'message error';
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
        const [statusResponse, wifiResponse, deviceResponse] = await Promise.all([
          fetch('/status'),
          fetch('/api/wifi-status'),
          fetch('/api/device-info')
        ]);
        const status = await statusResponse.json();
        const wifi = await wifiResponse.json();
        const device = await deviceResponse.json();

        document.getElementById('money').textContent = status.money ?? '--';
        document.getElementById('remainingTime').textContent = formatSeconds(status.remainingTime);
        document.getElementById('totalTime').textContent = formatSeconds(status.totalTime);
        document.getElementById('isActive').textContent = status.isActive ? 'Yes' : 'No';
        document.getElementById('ipAddress').textContent = status.ip || wifi.ip || '--';
        document.getElementById('deviceId').textContent = device.deviceId || status.deviceId || '--';
        document.getElementById('deviceSecret').textContent = device.deviceSecretConfigured ? 'Configured' : '--';
        document.getElementById('credentialDeviceId').value = device.deviceId || status.deviceId || '';
        document.getElementById('backendUrl').value = device.backendUrl || '';
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
  DynamicJsonDocument res(384);
  res["token"] = sessionToken;
  res["deviceId"] = deviceId;
  res["deviceSecretConfigured"] = deviceSecret.length() > 0;
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleStatus() {
  addCorsHeaders();
  DynamicJsonDocument doc(768);
  doc["deviceId"] = deviceId;
  if (isAuthorizedRequest()) doc["deviceSecret"] = deviceSecret;
  doc["deviceSecretConfigured"] = deviceSecret.length() > 0;
  doc["money"] = credits;
  doc["moneyInserted"] = credits;
  doc["credits"] = credits;
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
  doc["connectionStatus"] = WiFi.status() == WL_CONNECTED ? "online" : "setup-ap";
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
  int nextMinCredits = doc["minCreditsToStart"] | minCreditsToStart;
  int nextSeconds = doc["secondsForMinCredits"] | secondsForMinCredits;
  if (doc.containsKey("secondsForMinCredit")) nextSeconds = doc["secondsForMinCredit"];
  if (nextMinCredits < 1 || nextSeconds < 1) {
    server.send(400, "application/json", "{\"error\":\"Pricing values must be positive\"}");
    return;
  }
  minCreditsToStart = nextMinCredits;
  secondsForMinCredits = nextSeconds;
  saveState();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleWifiControl() {
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
  wifiStaEnabled = doc["enabled"] | true;
  prefs.putBool("wifi_on", wifiStaEnabled);
  if (wifiStaEnabled) {
    connectStationWifi();
  } else {
    WiFi.disconnect(false);
    inSetupMode = true;
    if (!setupApStarted) startSetupAP();
  }
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
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  doc["setupIp"] = WiFi.softAPIP().toString();
  doc["ssid"] = setupApSsid;
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}


void handleDeviceCredentialsConfig() {
  addCorsHeaders();
  if (deviceSecret.length() > 0 && !isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  DynamicJsonDocument doc(768);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  String nextDeviceId = doc["deviceId"] | "";
  String nextDeviceSecret = doc["deviceSecret"] | "";
  String nextBackend = normalizeBackendUrl(doc["backendUrl"] | backendUrl);
  String nextOwnerUid = doc["ownerUid"] | ownerUid;
  if (nextDeviceId.length() == 0 || nextDeviceSecret.length() < 16) {
    server.send(400, "application/json", "{\"error\":\"Device ID and a secure deviceSecret are required\"}");
    return;
  }
  deviceId = nextDeviceId;
  deviceSecret = nextDeviceSecret;
  backendUrl = nextBackend;
  ownerUid = nextOwnerUid;
  prefs.putString("device_id", deviceId);
  prefs.putString("dev_secret", deviceSecret);
  prefs.putString("backend", backendUrl);
  prefs.putString("owner_uid", ownerUid);
  lastCloudHeartbeat = 0;
  cloudJwt = "";
  cloudAuthenticated = false;
  lastCloudAuthAttempt = 0;

  DynamicJsonDocument res(384);
  res["ok"] = true;
  res["deviceId"] = deviceId;
  res["credentialsConfigured"] = true;
  res["backendUrl"] = backendUrl;
  res["ownerUid"] = ownerUid;
  res["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String out;
  serializeJson(res, out);
  server.send(200, "application/json", out);
}

void handleConfigAuth() {
  addCorsHeaders();
  if (!isAuthorizedRequest()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  String nextUser = doc["username"] | adminUser;
  String nextPass = doc["password"] | adminPass;
  String nextBackend = normalizeBackendUrl(doc["backendUrl"] | backendUrl);
  if (nextUser.length() == 0 || nextPass.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"Username and password are required\"}");
    return;
  }
  adminUser = nextUser;
  adminPass = nextPass;
  backendUrl = normalizeBackendUrl(nextBackend);
  prefs.putString("admin_user", adminUser);
  prefs.putString("admin_pass", adminPass);
  prefs.putString("backend", backendUrl);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleVendoState() {
  handleStatus();
}

void handleVendoUpdateTime() {
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
  long delta = doc["delta"] | 0;
  if (delta >= 0) {
    timeRemaining += delta;
    isActive = true;
  } else {
    long seconds = -delta;
    if (timeRemaining > seconds) {
      timeRemaining -= seconds;
    } else {
      timeRemaining = 0;
    }
    if (timeRemaining <= 0) isActive = false;
  }
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
  wifiStaEnabled = true;
  prefs.putBool("wifi_on", true);
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
  server.on("/login", HTTP_POST, handleAuth);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/add-time", HTTP_POST, handleAddTime);
  server.on("/control/remove-time", HTTP_POST, handleRemoveTime);
  server.on("/control/settings", HTTP_POST, handleUpdateSettings);
  server.on("/control/wifi", HTTP_POST, handleWifiControl);
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
  loadDeviceIdentity();
  credits = prefs.getLong("credits", 0);
  timeRemaining = prefs.getLong("time", 0);
  totalTime = prefs.getLong("totalTime", 0);
  salesToday = prefs.getInt("sales", 0);
  totalEarnings = prefs.getInt("totalEarn", 0);
  isActive = prefs.getBool("running", false);
  minCreditsToStart = prefs.getInt("minC", 50);
  secondsForMinCredits = prefs.getInt("secMin", 3000);

  if (timeRemaining <= 0) isActive = false;

  loadWifiCredentials();

  // FIX: Always start the AP first so a phone can always reach the device.
  //      Then attempt STA join on top of it (AP_STA mode).
  //      This way if STA fails the AP is still broadcasting — no blind spot.
  startSetupAP();

  if (wifiStaEnabled && staSsid.length() > 0) {
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

  sendCloudHeartbeat();

  if (wifiStaEnabled && !inSetupMode && millis() - lastWifiCheck > 10000) {
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
      totalTime++;
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
