#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <time.h>
#include "webpage.h"

const char* ssid = "New Plon Phone";
const char* password = "87654321";

#define DHTPIN 15
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

WebServer server(80);

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -21600;
const int daylightOffset_sec = 0;

int lastLoggedMinute = -1;
float cachedTemperature = 0;
float cachedHumidity = 0;

void printLocalTime();
void logSensorData(struct tm *timeinfo);
float readDHTTemperature();
float readDHTHumidity();

void setup() {
    Serial.begin(115200);
    Serial.setTimeout(1000); // Prevent serial hangs
    Serial.flush(); // Clear boot messages
    delay(20000); // Increased delay to stabilize
    
    dht.begin();
    
    WiFi.begin(ssid, password);
    int wifi_attempts = 0;
    while (WiFi.status() != WL_CONNECTED && wifi_attempts < 30) {
        delay(500);
        Serial.print(".");
        wifi_attempts++;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("ERROR|WiFi connection failed");
        ESP.restart();
        return;
    }
    
    Serial.println("");
    Serial.print("INFO|Connected to ");
    Serial.println(ssid);
    Serial.print("INFO|IP address: ");
    Serial.println(WiFi.localIP());

    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    printLocalTime();

    server.on("/", []() {
        server.send(200, "text/html", htmlPage);
    });
    
    server.on("/data.json", []() {
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        
        if (isnan(t)) t = cachedTemperature;
        if (isnan(h)) h = cachedHumidity;
        
        String json = "{\"temperature\":" + String(t, 2) + 
                     ",\"humidity\":" + String(h, 2) + "}";
        server.send(200, "application/json", json);
    });
    
    server.begin();
    Serial.println("INFO|HTTP server started");
}

void loop() {
    server.handleClient();
    
    static unsigned long lastLoopTime = 0;
    if (millis() - lastLoopTime < 100) return;
    lastLoopTime = millis();

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("ERROR|WiFi disconnected");
        ESP.restart();
        return;
    }

    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("ERROR|Failed to obtain time");
        delay(1000);
        return;
    }

    if (timeinfo.tm_sec == 0 && timeinfo.tm_min != lastLoggedMinute) {
        lastLoggedMinute = timeinfo.tm_min;
        logSensorData(&timeinfo);
    }
    else if (timeinfo.tm_sec < 5 && timeinfo.tm_min != lastLoggedMinute) {
        lastLoggedMinute = timeinfo.tm_min;
        Serial.println("WARNING|Late logging (recovery)");
        logSensorData(&timeinfo);
    }
}

void logSensorData(struct tm *timeinfo) {
    timeinfo->tm_sec = 0;
    time_t exact_minute = mktime(timeinfo);
    gmtime_r(&exact_minute, timeinfo);

    float temperature = readDHTTemperature();
    float humidity = readDHTHumidity();

    if (!isnan(temperature)) cachedTemperature = temperature;
    if (!isnan(humidity)) cachedHumidity = humidity;

    char timeString[30];
    strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", timeinfo);

    Serial.println("===START===");
    Serial.print("Timestamp: ");
    Serial.println(timeString);
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");
    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
    Serial.println("---");

    Serial.print("DATA|");
    Serial.print(timeString);
    Serial.print("|");
    Serial.print(temperature, 2);
    Serial.print("|");
    Serial.print(humidity, 2);
    Serial.println("|Lab 2");
    
    Serial.flush(); // Ensure data is sent
}

float readDHTTemperature() {
    float t = dht.readTemperature();
    if (isnan(t)) {
        Serial.println("ERROR|Failed to read temperature");
        return cachedTemperature;
    }
    return t;
}

float readDHTHumidity() {
    float h = dht.readHumidity();
    if (isnan(h)) {
        Serial.println("ERROR|Failed to read humidity");
        return cachedHumidity;
    }
    return h;
}

void printLocalTime() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("ERROR|Time sync failed");
        return;
    }
    char timeString[30];
    strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.print("INFO|Current time: ");
    Serial.println(timeString);
}