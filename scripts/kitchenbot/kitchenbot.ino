/*
 * KitchenBot — ESP32-A1S (AI Thinker Audio Kit) Firmware
 *
 * BEHAVIOUR
 *   Press KEY1 (GPIO 36) → red LED on → record 5 s of audio from onboard mics
 *   Release recording    → blue LED blink → upload WAV to KitchenBot API
 *   Success              → green LED flash × 3
 *   Error                → red LED rapid-blink × 5
 *
 * REQUIRED LIBRARIES  (install via Arduino Library Manager)
 *   • ESP32 board package  ≥ 2.0.x   (espressif/arduino-esp32)
 *   • ArduinoJson          ≥ 7.x      (bblanchon)
 *   • arduino-audiokit     latest     (pschatzmann/arduino-audiokit)
 *
 * BOARD SETTINGS  (Arduino IDE → Tools)
 *   Board:       ESP32 Dev Module  (or AI Thinker ESP32-A1S)
 *   Partition:   Huge APP (3MB / No OTA)   ← needed for PSRAM + large sketch
 *   PSRAM:       Enabled
 *
 * SETUP
 *   1. Edit WIFI_SSID, WIFI_PASS, SERVER_HOST, DEVICE_ID below.
 *   2. Flash to your ESP32-A1S.
 *   3. Open the kitchen dashboard at  https://your-domain.com/kitchen
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "AudioKitHAL.h"   // pschatzmann/arduino-audiokit

// ── Configuration ───────────────────────────────────────────────────────────

#define WIFI_SSID    "YourWiFiSSID"
#define WIFI_PASS    "YourWiFiPassword"

// Your Next.js deployment URL (no trailing slash)
#define SERVER_HOST  "https://your-app.vercel.app"
#define API_PATH     "/api/kitchenbot"

// Unique name for this device (shows up on tickets)
#define DEVICE_ID    "kitchen-esp32-1"

// ── Hardware pins (ESP32-A1S AI-Thinker) ───────────────────────────────────

#define BTN_RECORD   36    // KEY1 — active LOW (boot-mode pull-up)
#define BTN_AUX      39    // KEY2 — active LOW
#define LED_RED      22    // Status LED (some boards use GPIO 19)
#define LED_GREEN    21    // Ready  LED
#define LED_BLUE     19    // Upload LED

// ── Audio config ────────────────────────────────────────────────────────────

#define SAMPLE_RATE  16000
#define CHANNELS     1         // mono
#define BITS         16
#define REC_SECONDS  5
#define BYTES_PER_SAMPLE (BITS / 8 * CHANNELS)
#define RECORD_BYTES  (SAMPLE_RATE * BYTES_PER_SAMPLE * REC_SECONDS)

// ── Globals ──────────────────────────────────────────────────────────────────

AudioKit kit;

// We allocate the PCM buffer in PSRAM (essential — 160 KB for 5 s mono 16-bit)
uint8_t* pcmBuffer  = nullptr;

// ── WAV header builder ───────────────────────────────────────────────────────

struct WavHeader {
  char     riff[4]        = {'R','I','F','F'};
  uint32_t fileSize;
  char     wave[4]        = {'W','A','V','E'};
  char     fmt[4]         = {'f','m','t',' '};
  uint32_t fmtSize        = 16;
  uint16_t audioFormat    = 1;      // PCM
  uint16_t numChannels;
  uint32_t sampleRate;
  uint32_t byteRate;
  uint16_t blockAlign;
  uint16_t bitsPerSample;
  char     data[4]        = {'d','a','t','a'};
  uint32_t dataSize;
};

WavHeader makeWavHeader(uint32_t pcmBytes) {
  WavHeader h;
  h.numChannels  = CHANNELS;
  h.sampleRate   = SAMPLE_RATE;
  h.bitsPerSample = BITS;
  h.byteRate     = SAMPLE_RATE * CHANNELS * (BITS / 8);
  h.blockAlign   = CHANNELS * (BITS / 8);
  h.dataSize     = pcmBytes;
  h.fileSize     = 36 + pcmBytes;
  return h;
}

// ── Base64 encoder ────────────────────────────────────────────────────────────

static const char B64[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Returns number of chars written (excluding null terminator)
size_t base64Encode(const uint8_t* src, size_t srcLen, char* dst) {
  size_t out = 0;
  for (size_t i = 0; i < srcLen; i += 3) {
    uint32_t b = ((uint32_t)src[i] << 16)
               | ((i+1 < srcLen) ? (uint32_t)src[i+1] << 8 : 0)
               | ((i+2 < srcLen) ? (uint32_t)src[i+2]      : 0);
    dst[out++] = B64[(b >> 18) & 0x3F];
    dst[out++] = B64[(b >> 12) & 0x3F];
    dst[out++] = (i+1 < srcLen) ? B64[(b >>  6) & 0x3F] : '=';
    dst[out++] = (i+2 < srcLen) ? B64[(b      ) & 0x3F] : '=';
  }
  dst[out] = '\0';
  return out;
}

// ── LED helpers ───────────────────────────────────────────────────────────────

void ledsOff() {
  digitalWrite(LED_RED,   HIGH);  // active LOW
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_BLUE,  HIGH);
}

void ledSet(int pin, bool on) { digitalWrite(pin, on ? LOW : HIGH); }

void flashLed(int pin, int times, int ms = 120) {
  for (int i = 0; i < times; i++) {
    ledSet(pin, true);  delay(ms);
    ledSet(pin, false); delay(ms);
  }
}

// ── WiFi ──────────────────────────────────────────────────────────────────────

void connectWifi() {
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());
    flashLed(LED_GREEN, 3, 80);
  } else {
    Serial.println("\nWiFi failed!");
    flashLed(LED_RED, 10, 60);
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

bool uploadAudio(const uint8_t* pcm, size_t pcmLen) {
  if (WiFi.status() != WL_CONNECTED) connectWifi();

  // Build WAV in PSRAM
  WavHeader hdr = makeWavHeader(pcmLen);
  size_t wavLen = sizeof(hdr) + pcmLen;
  uint8_t* wav = (uint8_t*)ps_malloc(wavLen);
  if (!wav) { Serial.println("ps_malloc failed for WAV"); return false; }
  memcpy(wav, &hdr, sizeof(hdr));
  memcpy(wav + sizeof(hdr), pcm, pcmLen);

  // Base64 encode (output ~4/3 × input)
  size_t b64Len = ((wavLen + 2) / 3) * 4 + 1;
  char* b64 = (char*)ps_malloc(b64Len);
  if (!b64) { free(wav); Serial.println("ps_malloc failed for b64"); return false; }
  base64Encode(wav, wavLen, b64);
  free(wav);

  // Build JSON payload — stream it to avoid another large allocation
  // {"audio":"...","sampleRate":16000,"deviceId":"..."}
  String url = String(SERVER_HOST) + API_PATH;

  WiFiClientSecure client;
  client.setInsecure();   // Skip cert verification for simplicity
                          // Replace with a proper CA cert in production

  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(30000);

  // Stream body to avoid one giant String
  // We build: {"audio":"<b64>","sampleRate":16000,"deviceId":"<id>"}
  String body;
  body.reserve(32);
  body = "{\"audio\":\"";

  // HTTPClient.POST(String) — for large payloads use streaming
  // Build full JSON string (b64 is already in PSRAM)
  String fullBody = "{\"audio\":\"";
  fullBody += b64;
  fullBody += "\",\"sampleRate\":";
  fullBody += String(SAMPLE_RATE);
  fullBody += ",\"deviceId\":\"";
  fullBody += DEVICE_ID;
  fullBody += "\"}";
  free(b64);

  Serial.printf("Uploading %u bytes WAV → %u chars JSON\n", (unsigned)wavLen, fullBody.length());
  int code = http.POST(fullBody);

  bool ok = false;
  if (code == 200) {
    String resp = http.getString();
    Serial.println("Server: " + resp);

    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, resp)) {
      Serial.printf("Ticket #%03d created: %s\n",
        (int)doc["ticketNumber"], doc["transcript"].as<const char*>());
      ok = true;
    }
  } else {
    Serial.printf("HTTP error %d: %s\n", code, http.getString().c_str());
  }
  http.end();
  return ok;
}

// ── Record ────────────────────────────────────────────────────────────────────

size_t recordAudio(uint8_t* buf, size_t maxBytes) {
  size_t total = 0;
  unsigned long deadline = millis() + (unsigned long)REC_SECONDS * 1000UL;

  while (millis() < deadline && total < maxBytes) {
    size_t got = 0;
    size_t chunk = min((size_t)4096, maxBytes - total);
    kit.read(buf + total, chunk, got);
    total += got;
    yield();
  }
  return total;
}

// ── Setup / Loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== KitchenBot ===");

  // LEDs
  pinMode(LED_RED,   OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE,  OUTPUT);
  ledsOff();

  // Button
  pinMode(BTN_RECORD, INPUT);  // GPIO 36/39 have no internal pull-up

  // PSRAM check
  if (!psramFound()) {
    Serial.println("WARNING: No PSRAM detected. Recording may fail.");
  } else {
    Serial.printf("PSRAM: %u KB free\n", (unsigned)ESP.getFreePsram() / 1024);
    pcmBuffer = (uint8_t*)ps_malloc(RECORD_BYTES);
    if (!pcmBuffer) Serial.println("ERROR: Could not allocate PCM buffer in PSRAM!");
  }

  // AudioKit
  auto cfg          = kit.defaultConfig(RX_MODE);
  cfg.sample_rate   = SAMPLE_RATE;
  cfg.bits_per_sample = BITS;
  cfg.channels      = CHANNELS;
  cfg.input_device  = AUDIO_HAL_ADC_INPUT_LINE2; // onboard mics
  kit.begin(cfg);
  kit.setInputVolume(75);

  // WiFi
  WiFi.mode(WIFI_STA);
  connectWifi();

  Serial.println("Ready — press KEY1 to record an order.");
  ledSet(LED_GREEN, true);
}

void loop() {
  if (digitalRead(BTN_RECORD) == LOW) {
    ledsOff();
    ledSet(LED_RED, true);
    Serial.println("Recording…");

    if (!pcmBuffer) {
      Serial.println("No PCM buffer — aborting");
      flashLed(LED_RED, 8, 60);
      return;
    }

    size_t recorded = recordAudio(pcmBuffer, RECORD_BYTES);
    Serial.printf("Recorded %u bytes\n", (unsigned)recorded);

    ledsOff();
    ledSet(LED_BLUE, true);
    Serial.println("Uploading…");

    bool ok = uploadAudio(pcmBuffer, recorded);

    ledsOff();
    if (ok) {
      flashLed(LED_GREEN, 3, 120);
      Serial.println("Done!");
    } else {
      flashLed(LED_RED, 5, 80);
      Serial.println("Upload failed.");
    }
    ledSet(LED_GREEN, true);

    // Debounce
    while (digitalRead(BTN_RECORD) == LOW) delay(10);
    delay(300);
  }
}
