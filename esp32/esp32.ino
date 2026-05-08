#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>

// ========================================
// ROMERS VENDO - ESP32 WITH DEVICE ID/SECRET AUTHENTICATION
// ========================================

// ========================================
// DEVICE CREDENTIALS (UPDATE THESE)
// ========================================
const char* DEVICE_ID = "romers_001";                                    // Change to your Device ID
const char* DEVICE_SECRET = "your_64_char_hex_secret_here";            // Change to your Device Secret (from provisioning)
const char* BACKEND_URL = "http://192.168.0.100:8080";                 // Change to your backend URL
const char* DEVICE_NAME = "Main Vendo Machine";

// ========================================
// WIFI CONFIGURATION
// ========================================
const char* WIFI_SSID = "RADIUS8E9AA";                  // Change to your WiFi SSID
const char* WIFI_PASSWORD = "9p6fzk5ZEf";             // Change to your WiFi password

// ========================================
// HARDWARE PINS
// ========================================
const int COIN_PIN = 16;           // Coin pulse sensor (input)
const int BTN_PIN = 17;            // Manual button control (input)
const int SSR_PIN = 23;            // Solid State Relay output

// ========================================
// DEVICE STATE
// ========================================
String deviceToken = "";           // JWT token from backend
unsigned long tokenExpiresAt = 0;  // When token expires

int credits = 0;                   // Current credits balance
long timeRemaining = 0;            // Remaining time in seconds
int salesToday = 0;                // Sales count today
int totalEarnings = 0;             // Total earnings

bool isRunning = false;            // Is machine currently running
bool isWiFiConnected = false;
bool isAuthenticated = false;

// ========================================
// TIMING VARIABLES
// ========================================
unsigned long lastTick = 0;
unsigned long lastBackendUpdate = 0;
unsigned long lastCoinPulse = 0;
const unsigned long BACKEND_UPDATE_INTERVAL = 10000;  // Update every 10 seconds
const unsigned long COIN_DEBOUNCE = 200;              // Debounce coin for 200ms
const int MIN_CREDITS_TO_START = 50;
const int SECONDS_FOR_MIN_CREDITS = 300;              // 5 minutes

// ========================================
// PREFERENCES (PERSISTENT STORAGE)
// ========================================
Preferences prefs;
WebServer server(80);

// ===== SAVE =====
void saveState() {
  prefs.putInt("credits", credits);
  prefs.putLong("time", timeRemaining);
  prefs.putInt("sales", salesToday);
  prefs.putInt("totalEarn", totalEarnings); // NEW
  prefs.putBool("running", isRunning);
  prefs.putInt("minC", minCreditsToStart);
  prefs.putInt("secMin", secondsForMinCredits);
}

// ===== LCD =====
void refreshLCD() {
  lcd.setCursor(0,0);
  lcd.print("                ");
  lcd.setCursor(0,1);
  lcd.print("                ");

  if(isRunning){
    if(showAltScreen && credits > 0){
      lcd.setCursor(0,0);
      lcd.print("CREDITS:");
      lcd.setCursor(0,1);
      lcd.print(credits);
    } else {
      lcd.setCursor(0,0);
      lcd.print("RUNNING");
      lcd.setCursor(0,1);
      lcd.printf("%02d:%02d", timeRemaining/60, timeRemaining%60);
    }
  } else {
    lcd.setCursor(0,0);
    lcd.print("Credits:");
    lcd.print(credits);
    lcd.setCursor(0,1);
    lcd.print("Insert Coin");
  }
}

// ===== HTML =====
String htmlPage() {
  String p="<html><head>";
  p+="<meta name='viewport' content='width=device-width, initial-scale=1'>";
  p+="<meta http-equiv='refresh' content='10'>";
  p+="<style>";
  p+="body{font-family:Arial;background:#f0f2f5;text-align:center;}";
  p+="h2{background:#1877f2;color:white;padding:10px;}";
  p+="button{background:#1877f2;color:white;border:none;padding:10px;margin:5px;border-radius:5px;}";
  p+="</style>";
  p+="</head><body>";

  p+="<h2>Admin</h2>";

  p+="<p><b>Credits:</b> "+String(credits)+"</p>";
  p+="<p><b>Time:</b> "+String(timeRemaining)+" sec</p>";
  p+="<p><b>Min Credits:</b> "+String(minCreditsToStart)+"</p>";
  p+="<p><b>Sec/Min Credit:</b> "+String(secondsForMinCredits)+"</p>";
  p+="<p><b>Status:</b> "+String(isRunning?"RUNNING":"STOPPED")+"</p>";

  // NEW
  p+="<p><b>Total Earnings:</b> "+String(totalEarnings)+"</p>";

  p+="<hr>";

  p+="<form action='/set'>";
  p+="Min Credits:<br><input name='minc' type='number' value='"+String(minCreditsToStart)+"'><br>";
  p+="Seconds for Min:<br><input name='sec' type='number' value='"+String(secondsForMinCredits)+"'><br>";
  p+="<button>Save Settings</button></form>";

  p+="<hr>";

  p+="<form action='/time'><input name='t' placeholder='Add seconds'><button>Add Time</button></form>";
  p+="<form action='/pause'><button>Pause / Resume</button></form>";
  p+="<form action='/resetTime'><button>Reset Time</button></form>";
  p+="<form action='/resetSales'><button>Reset Sales</button></form>";
  p+="<form action='/resetCredits'><button>Reset Credits</button></form>";

  // NEW PAGE BUTTON
  p+="<form action='/earnings'><button>View Earnings</button></form>";

  p+="</body></html>";
  return p;
}

// ===== EXTRA PAGE =====
void handleEarnings(){
  if(!isAuthenticated()) return;

  String p="<html><body style='text-align:center;font-family:Arial'>";
  p+="<h2>Total Earnings</h2>";
  p+="<h1>"+String(totalEarnings)+"</h1>";
  p+="<form action='/resetTotal'><button>Reset Total Earnings</button></form>";
  p+="<br><a href='/'>Back</a>";
  p+="</body></html>";

  server.send(200,"text/html",p);
}

void handleResetTotal(){
  if(!isAuthenticated()) return;
  totalEarnings = 0;
  saveState();
  server.sendHeader("Location","/earnings");
  server.send(302,"text/plain","");
}

// ===== RESET CREDITS (FIXED ERROR) =====
void handleResetCredits(){
  if(!isAuthenticated()) return;

  credits = 0;
  saveState();
  if(millis() - lastLCDUpdate > 500){
  lastLCDUpdate = millis();
  refreshLCD();
}

  Blynk.virtualWrite(VPIN_CREDITS, credits);

  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}
BLYNK_WRITE(VPIN_RESET_SALES){
  if(param.asInt() == 1){
    salesToday = 0;
    saveState();

    // update Blynk display instantly
    Blynk.virtualWrite(VPIN_SALES, salesToday);

    // auto reset button (important if switch)
    Blynk.virtualWrite(VPIN_RESET_SALES, 0);
  }
}
// ===== ORIGINAL HANDLERS =====
void handleRoot(){ if(!isAuthenticated()) return; server.send(200,"text/html",htmlPage()); }

void handleSet(){
  if(!isAuthenticated()) return;

  if(server.hasArg("minc")){
    String val = server.arg("minc");
    if(val.length() > 0){
      minCreditsToStart = val.toInt();
    }
  }

  if(server.hasArg("sec")){
    String val = server.arg("sec");
    if(val.length() > 0){
      secondsForMinCredits = val.toInt();
    }
  }

  saveState();
  if(millis() - lastLCDUpdate > 500){
  lastLCDUpdate = millis();
  if(millis() - lastLCDUpdate > 500){
  lastLCDUpdate = millis();
}
}

  // VERY IMPORTANT (this fixes the lag feeling)
  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}
void handleResetSales(){
  if(!isAuthenticated()) return;

  salesToday = 0;
  saveState();

  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}
void handleTime(){
  if(!isAuthenticated()) return;

  if(server.hasArg("t")){
    timeRemaining += server.arg("t").toInt();
    isRunning = true;
  }

  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}
void handlePause(){
  if(!isAuthenticated()) return;

  isRunning = !isRunning;

  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}

void handleResetTime(){
  if(!isAuthenticated()) return;

  timeRemaining = 0;
  isRunning = false;
  saveState();

  lastLCDUpdate = 0;
  refreshLCD();

  Blynk.virtualWrite(VPIN_TIME, timeRemaining);

  server.sendHeader("Location","/");
  server.send(302,"text/plain","");
}

// ===== BLYNK CONTROL =====
BLYNK_WRITE(VPIN_ADD_TIME){
  timeRemaining += param.asInt();
  isRunning = true;
}

BLYNK_WRITE(VPIN_RESET_C){
  if(param.asInt()==1){
    credits = 0;
    saveState();

    // ✅ FORCE INSTANT LCD UPDATE
    lastLCDUpdate = 0;
    refreshLCD();

    // ✅ UPDATE BLYNK IMMEDIATELY
    Blynk.virtualWrite(VPIN_CREDITS, credits);
  }
}
BLYNK_WRITE(VPIN_RESET_TIME){
  if(param.asInt()==1){
    timeRemaining = 0;
    isRunning = false;
    saveState();

    // ✅ INSTANT LCD UPDATE
    lastLCDUpdate = 0;
    refreshLCD();

    // ✅ UPDATE BLYNK
    Blynk.virtualWrite(VPIN_TIME, timeRemaining);
  }
}
BLYNK_WRITE(VPIN_STOP){
  if(param.asInt()==1){
    isRunning = false;
    timeRemaining = 0;
  }
}

// ===== SETUP =====
void setup(){
  Serial.begin(115200);

  pinMode(SSR_PIN,OUTPUT);
  digitalWrite(SSR_PIN,LOW);

  pinMode(COIN_PIN, INPUT_PULLUP);
  pinMode(BTN_PIN,INPUT_PULLUP);

  Wire.begin(21,22);
  lcd.init();
  lcd.backlight();

  prefs.begin("pisowash", false);

  credits = prefs.getInt("credits",0);
  timeRemaining = prefs.getLong("time",0);
  salesToday = prefs.getInt("sales",0);
  totalEarnings = prefs.getInt("totalEarn",0); // NEW
  isRunning = prefs.getBool("running",false);

  minCreditsToStart = prefs.getInt("minC",50);
  secondsForMinCredits = prefs.getInt("secMin",3000);

  if(timeRemaining<=0) isRunning=false;

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("Admin","12345678");
  connectWiFi();

  if(WiFi.status()==WL_CONNECTED){
    Blynk.config(auth);
    Blynk.connect();
  }

  server.on("/",handleRoot);
  server.on("/set",handleSet);
  server.on("/time",handleTime);
  server.on("/pause",handlePause);
  server.on("/resetTime",handleResetTime);
  server.on("/resetSales",handleResetSales);
  server.on("/resetCredits",handleResetCredits);
  server.on("/earnings",handleEarnings);
  server.on("/resetTotal",handleResetTotal);

  server.begin();
  if(millis() - lastLCDUpdate > 500){
  lastLCDUpdate = millis();
  refreshLCD();
}
}

// ===== LOOP =====
void loop(){
  server.handleClient();
  if(WiFi.status()==WL_CONNECTED) Blynk.run();

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

  if(pulseCount != 1 && pulseCount != 5 && pulseCount != 10){
    pulseCount = 0;
  } else {

    int coinValue = 0;

    if(pulseCount == 1) coinValue = 1;
    else if(pulseCount == 5) coinValue = 5;
    else if(pulseCount == 10) coinValue = 10;

    credits += coinValue;
    salesToday += coinValue;
    totalEarnings += coinValue;

    saveState();

    lastLCDUpdate = 0;
    refreshLCD();
  }

  pulseCount = 0;
}

  if(digitalRead(BTN_PIN)==LOW){
    delay(200);

    if(credits >= minCreditsToStart){
      float multiplier = (float)credits / (float)minCreditsToStart;
      long addedTime = multiplier * secondsForMinCredits;

      timeRemaining += addedTime;
      credits = 0;

      isRunning = true;
      if(millis() - lastLCDUpdate > 500){
          lastLCDUpdate = millis();
          refreshLCD();
  	  }
    }
  }

  if(isRunning && millis()-lastTick>=1000){
    lastTick=millis();

    if(timeRemaining>0){
      timeRemaining--;
    }

    if(timeRemaining<=0){
      isRunning=false;
      timeRemaining=0;
    }

    if(millis() - lastLCDUpdate > 500){
      lastLCDUpdate = millis();
      refreshLCD();
    }
  }

  if(isRunning && credits > 0 && millis() - lastLCDSwitch >= 15000){
    lastLCDSwitch = millis();
    showAltScreen = !showAltScreen;
    if(millis() - lastLCDUpdate > 500){
      lastLCDUpdate = millis();
      refreshLCD();
    }
  }

  if(millis() - lastBlynkUpdate >= 15000){
    lastBlynkUpdate = millis();

    Blynk.virtualWrite(VPIN_TIME, timeRemaining);
    Blynk.virtualWrite(VPIN_SALES, salesToday);
    Blynk.virtualWrite(VPIN_CREDITS, credits);
  }

  updateSSR();
}