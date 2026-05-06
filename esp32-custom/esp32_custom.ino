#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

/*
  Romers Vendo (Blynk-free) connectivity layer
  ------------------------------------------------
  IMPORTANT:
  - This file is designed so your existing vendo logic can be dropped in unchanged.
  - Keep your original coin handling, relay control, timers, and variables EXACTLY as-is.
  - Only Blynk transport calls are replaced by HTTP handlers.
*/

// Keep your original WiFi credentials logic as-is.
const char* ssid = "YOUR_WIFI_SSID";
const char* pass = "YOUR_WIFI_PASSWORD";

// Local auth credentials for app login.
const char* espUser = "admin";
const char* espPass = "1234";
String sessionToken = "";

WebServer server(80);

// -----------------------------------------------------------------------------
// Existing core variables (keep same names as your original firmware)
// Replace with your actual variables from original code and do not rename.
volatile long money = 0;
volatile long remainingTime = 0;
volatile long totalTime = 0;
volatile bool isActive = false;

// -----------------------------------------------------------------------------
// Existing core logic functions (paste your original implementations)
// Do not change behavior; only remove Blynk dependencies from inside.
void setupVendoLogic() {
  // TODO: paste your original setup logic here (relay pin modes, interrupts, etc.)
}

void runVendoLogicNonBlocking() {
  // TODO: paste your original loop logic here (timing, coin checks, relay states).
  // Must remain non-blocking.
}

void resetMoneyExactLogic() {
  // TODO: call your original money reset function/logic.
  money = 0;
}

void addTimeExactLogic(long seconds) {
  // TODO: call your original add/subtract time logic.
  remainingTime += seconds;
  if (remainingTime < 0) remainingTime = 0;
}

// -----------------------------------------------------------------------------
// Connectivity helpers
void addCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

bool isAuthorized() {
  String auth = server.header("Authorization");
  if (sessionToken.length() == 0) return false;
  return auth == ("Bearer " + sessionToken);
}

void handleOptions() {
  addCors();
  server.send(204);
}

void handleStatus() {
  addCors();
  DynamicJsonDocument doc(256);
  doc["money"] = money;
  doc["remainingTime"] = remainingTime;
  doc["totalTime"] = totalTime;
  doc["isActive"] = isActive;

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleAuth() {
  addCors();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument body(256);
  if (deserializeJson(body, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  String username = body["username"] | "";
  String password = body["password"] | "";

  if (username != espUser || password != espPass) {
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

void handleResetMoney() {
  addCors();
  if (!isAuthorized()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }

  resetMoneyExactLogic();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleAddTime() {
  addCors();
  if (!isAuthorized()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\"}");
    return;
  }
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }

  DynamicJsonDocument body(256);
  if (deserializeJson(body, server.arg("plain"))) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }

  long seconds = body["seconds"] | 0;
  addTimeExactLogic(seconds);
  server.send(200, "application/json", "{\"ok\":true}");
}

void beginHttpBridge() {
  server.on("/", HTTP_GET, []() {
    addCors();
    server.send(200, "application/json", "{\"service\":\"romers-vendo\"}");
  });

  // Endpoint mapping from old Blynk states/controls:
  // - Blynk virtual writes/reads -> these REST endpoints.
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/auth", HTTP_POST, handleAuth);
  server.on("/control/reset-money", HTTP_POST, handleResetMoney);
  server.on("/control/add-time", HTTP_POST, handleAddTime);

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
      return;
    }
    addCors();
    server.send(404, "application/json", "{\"error\":\"Not found\"}");
  });

  server.begin();
}

void setup() {
  Serial.begin(115200);
  randomSeed(esp_random());

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);

  // Keep non-blocking behavior for production; this bounded wait is just bootstrap feedback.
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(100);
  }

  setupVendoLogic();
  beginHttpBridge();
}

void loop() {
  // Replaces Blynk.run()
  server.handleClient();

  // Keep your original logic running whether app is connected or not.
  runVendoLogicNonBlocking();
}
