#pragma once

// ── WiFi ──────────────────────────────────────────────────────────────────────
#define KB_WIFI_SSID      "YourWiFiSSID"
#define KB_WIFI_PASS      "YourWiFiPassword"

// ── Server ────────────────────────────────────────────────────────────────────
// Your Next.js deployment URL — no trailing slash
#define KB_SERVER_HOST    "https://your-app.vercel.app"
#define KB_API_PATH       "/api/kitchenbot"

// Unique name for this device (shows up on tickets)
#define KB_DEVICE_ID      "kitchen-esp32-1"

// ── Audio ─────────────────────────────────────────────────────────────────────
#define KB_SAMPLE_RATE    16000
#define KB_CHANNELS       1
#define KB_BITS           16
#define KB_REC_SECONDS    5

// Derived
#define KB_BYTES_PER_SAMPLE  ((KB_BITS / 8) * KB_CHANNELS)
#define KB_RECORD_BYTES      (KB_SAMPLE_RATE * KB_BYTES_PER_SAMPLE * KB_REC_SECONDS)

// ── Hardware pins (ESP32-A1S AI-Thinker) ─────────────────────────────────────
// I2C (ES8388 codec control)
#define KB_I2C_SDA        33
#define KB_I2C_SCL        32
#define KB_I2C_FREQ_HZ    100000
#define KB_I2C_PORT       I2C_NUM_0

// I2S (audio data)
#define KB_I2S_BCLK       27
#define KB_I2S_WS         25
#define KB_I2S_DIN        35   // data from codec → ESP32 (ADC path)
#define KB_I2S_DOUT       26   // data from ESP32 → codec (DAC path, unused for recording)
#define KB_I2S_PORT       I2S_NUM_0

// Buttons (active LOW — GPIO 36/39 are input-only, no pull-up)
#define KB_BTN_RECORD     36   // KEY1
#define KB_BTN_AUX        39   // KEY2

// LEDs (active LOW)
#define KB_LED_RED        22
#define KB_LED_GREEN      21
#define KB_LED_BLUE       19

// HTTP
#define KB_HTTP_TIMEOUT_MS  30000
