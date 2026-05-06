// ===== BLYNK =====
#define BLYNK_TEMPLATE_ID "TMPL63NvxXowK"
#define BLYNK_TEMPLATE_NAME "pisowash"
#define BLYNK_AUTH_TOKEN "ZwFShvxwes-4N9w9i0ZLbB-DmCrB_t3J"

#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <BlynkSimpleEsp32.h>
#include "esp_wifi.h"

LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);
Preferences prefs;

char auth[] = BLYNK_AUTH_TOKEN;

// ===== LOGIN =====
const char* adminUser = "admin";
const char* adminPass = "1234";

// ===== WIFI =====
const char* ssidList[] = {"RADIUS8E9AA","Infinix NOTE 40 5G","Infinix HOT 50 Pro+"};
const char* passList[] = {"9p6fzk5ZEf","romer13456","geconnect"};

// ===== BLYNK PINS =====
#define VPIN_TIME     V1
#define VPIN_SALES    V0
#define VPIN_CREDITS  V2
#define VPIN_MINC     V3
#define VPIN_SECMIN   V4

// ===== NEW BLYNK CONTROL =====
#define VPIN_ADD_TIME V5
#define VPIN_RESET_C  V6
#define VPIN_STOP     V7
#define VPIN_RESET_TIME V8
#define VPIN_RESET_SALES V9
// ===== PINS =====
const int COIN_PIN = 16;
const int BTN_PIN  = 17;
const int SSR_PIN  = 23;

// ===== STATE =====
int credits = 0;
long timeRemaining = 0;

int minCreditsToStart = 50;
int secondsForMinCredits = 3000;

int salesToday = 0;
int totalEarnings = 0; // NEW

bool isRunning = false;

unsigned long lastTick = 0;
unsigned long lastBlynkUpdate = 0;


// ===== LCD ROTATION =====
unsigned long lastLCDSwitch = 0;
unsigned long lastLCDUpdate = 0;
bool showAltScreen = false;

// ===== COIN =====
int coinState = HIGH;
int lastCoinState = HIGH;
int pulseCount = 0;
unsigned long lastPulseTime = 0;
static unsigned long lastValidPulse = 0;


// ===== AUTH =====
bool isAuthenticated(){
  if(!server.authenticate(adminUser, adminPass)){
    server.requestAuthentication();
    return false;
  }
  return true;
}

// ===== SSR =====
void updateSSR() {
  digitalWrite(SSR_PIN, (isRunning && timeRemaining > 0));
}

// ===== WIFI =====
void connectWiFi() {
  for(int i=0;i<3;i++){
    WiFi.begin(ssidList[i], passList[i]);
    unsigned long t=millis();
    while(WiFi.status()!=WL_CONNECTED && millis()-t<6000){
      delay(300);
    }
    if(WiFi.status()==WL_CONNECTED) break;
  }
}

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