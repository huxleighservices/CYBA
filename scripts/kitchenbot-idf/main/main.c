/*
 * KitchenBot — ESP32-A1S (AI Thinker Audio Kit) Firmware
 * ESP-IDF 5.5 — uses new I2S + I2C master driver APIs
 *
 * BEHAVIOUR
 *   Press KEY1 (GPIO 36) → red LED   → records 5 s from onboard mics
 *   Recording done       → blue LED  → uploads WAV to KitchenBot API
 *   Success              → green flash × 3
 *   Error                → red flash  × 5
 *
 * BUILD
 *   cd scripts/kitchenbot-idf
 *   idf.py set-target esp32
 *   idf.py build flash monitor
 *
 * FIRST-TIME SETUP
 *   Edit KB_WIFI_SSID, KB_WIFI_PASS, KB_SERVER_HOST, KB_DEVICE_ID
 *   in main/kitchenbot_config.h
 */

#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "esp_err.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include "esp_heap_caps.h"
#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "driver/i2c_master.h"
#include "esp_http_client.h"

#include "kitchenbot_config.h"
#include "es8388.h"

// ─── Logging ─────────────────────────────────────────────────────────────────

static const char *TAG = "kitchenbot";

// ─── WiFi ─────────────────────────────────────────────────────────────────────

#define WIFI_CONNECTED_BIT  BIT0
#define WIFI_FAIL_BIT       BIT1
#define WIFI_MAX_RETRIES    5

static EventGroupHandle_t s_wifi_events;
static int s_retry = 0;

static void wifi_event_handler(void *arg, esp_event_base_t base,
                               int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry < WIFI_MAX_RETRIES) {
            esp_wifi_connect();
            s_retry++;
            ESP_LOGI(TAG, "WiFi retry %d/%d", s_retry, WIFI_MAX_RETRIES);
        } else {
            xEventGroupSetBits(s_wifi_events, WIFI_FAIL_BIT);
        }
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *ev = (ip_event_got_ip_t *)data;
        ESP_LOGI(TAG, "IP: " IPSTR, IP2STR(&ev->ip_info.ip));
        s_retry = 0;
        xEventGroupSetBits(s_wifi_events, WIFI_CONNECTED_BIT);
    }
}

static bool wifi_connect(void)
{
    s_wifi_events = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t h_any, h_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                         &wifi_event_handler, NULL, &h_any));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                                         &wifi_event_handler, NULL, &h_ip));

    wifi_config_t wifi_cfg = {
        .sta = {
            .ssid     = KB_WIFI_SSID,
            .password = KB_WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Connecting to %s …", KB_WIFI_SSID);

    EventBits_t bits = xEventGroupWaitBits(s_wifi_events,
                                           WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
                                           pdFALSE, pdFALSE,
                                           pdMS_TO_TICKS(15000));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "WiFi connected");
        return true;
    }
    ESP_LOGE(TAG, "WiFi failed");
    return false;
}

// ─── LED helpers ──────────────────────────────────────────────────────────────

static void leds_init(void)
{
    gpio_config_t io = {
        .pin_bit_mask = (1ULL << KB_LED_RED) | (1ULL << KB_LED_GREEN) | (1ULL << KB_LED_BLUE),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en   = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&io);
    // Active LOW — start with all off
    gpio_set_level(KB_LED_RED,   1);
    gpio_set_level(KB_LED_GREEN, 1);
    gpio_set_level(KB_LED_BLUE,  1);
}

static inline void led_set(int pin, bool on)  { gpio_set_level(pin, on ? 0 : 1); }
static inline void leds_off(void) {
    gpio_set_level(KB_LED_RED, 1);
    gpio_set_level(KB_LED_GREEN, 1);
    gpio_set_level(KB_LED_BLUE, 1);
}

static void led_flash(int pin, int times, int ms)
{
    for (int i = 0; i < times; i++) {
        led_set(pin, true);  vTaskDelay(pdMS_TO_TICKS(ms));
        led_set(pin, false); vTaskDelay(pdMS_TO_TICKS(ms));
    }
}

// ─── WAV header ───────────────────────────────────────────────────────────────

typedef struct __attribute__((packed)) {
    char     riff[4];        // "RIFF"
    uint32_t file_size;
    char     wave[4];        // "WAVE"
    char     fmt[4];         // "fmt "
    uint32_t fmt_size;       // 16
    uint16_t audio_format;   // 1 = PCM
    uint16_t num_channels;
    uint32_t sample_rate;
    uint32_t byte_rate;
    uint16_t block_align;
    uint16_t bits_per_sample;
    char     data[4];        // "data"
    uint32_t data_size;
} wav_header_t;

static wav_header_t make_wav_header(uint32_t pcm_bytes)
{
    wav_header_t h;
    memcpy(h.riff, "RIFF", 4);
    memcpy(h.wave, "WAVE", 4);
    memcpy(h.fmt,  "fmt ", 4);
    memcpy(h.data, "data", 4);
    h.fmt_size       = 16;
    h.audio_format   = 1;
    h.num_channels   = KB_CHANNELS;
    h.sample_rate    = KB_SAMPLE_RATE;
    h.bits_per_sample = KB_BITS;
    h.byte_rate      = KB_SAMPLE_RATE * KB_CHANNELS * (KB_BITS / 8);
    h.block_align    = KB_CHANNELS * (KB_BITS / 8);
    h.data_size      = pcm_bytes;
    h.file_size      = 36 + pcm_bytes;
    return h;
}

// ─── Base64 encoder ───────────────────────────────────────────────────────────

static const char B64[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static size_t base64_encode(const uint8_t *src, size_t src_len, char *dst)
{
    size_t out = 0;
    for (size_t i = 0; i < src_len; i += 3) {
        uint32_t b = ((uint32_t)src[i] << 16)
                   | ((i + 1 < src_len) ? (uint32_t)src[i + 1] << 8 : 0)
                   | ((i + 2 < src_len) ? (uint32_t)src[i + 2]      : 0);
        dst[out++] = B64[(b >> 18) & 0x3F];
        dst[out++] = B64[(b >> 12) & 0x3F];
        dst[out++] = (i + 1 < src_len) ? B64[(b >> 6) & 0x3F] : '=';
        dst[out++] = (i + 2 < src_len) ? B64[(b     ) & 0x3F] : '=';
    }
    dst[out] = '\0';
    return out;
}

// ─── I2S recording ────────────────────────────────────────────────────────────

static i2s_chan_handle_t s_rx_chan = NULL;

static esp_err_t i2s_init(void)
{
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(KB_I2S_PORT, I2S_ROLE_SLAVE);
    chan_cfg.auto_clear = true;
    ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, NULL, &s_rx_chan));

    i2s_std_config_t std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(KB_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PCM_SLOT_DEFAULT_CONFIG(
                        (i2s_data_bit_width_t)KB_BITS,
                        (i2s_slot_mode_t)KB_CHANNELS),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = KB_I2S_BCLK,
            .ws   = KB_I2S_WS,
            .dout = KB_I2S_DOUT,
            .din  = KB_I2S_DIN,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv   = false,
            },
        },
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(s_rx_chan, &std_cfg));
    ESP_ERROR_CHECK(i2s_channel_enable(s_rx_chan));
    ESP_LOGI(TAG, "I2S RX ready  %d Hz  %d-bit  %dch", KB_SAMPLE_RATE, KB_BITS, KB_CHANNELS);
    return ESP_OK;
}

static size_t record_audio(uint8_t *buf, size_t max_bytes)
{
    size_t total = 0;
    TickType_t deadline = xTaskGetTickCount() + pdMS_TO_TICKS((uint32_t)KB_REC_SECONDS * 1000);

    while (xTaskGetTickCount() < deadline && total < max_bytes) {
        size_t got = 0;
        size_t chunk = (max_bytes - total < 4096) ? (max_bytes - total) : 4096;
        i2s_channel_read(s_rx_chan, buf + total, chunk, &got, pdMS_TO_TICKS(200));
        total += got;
    }
    ESP_LOGI(TAG, "Recorded %u bytes", (unsigned)total);
    return total;
}

// ─── HTTP upload ─────────────────────────────────────────────────────────────

/*
 * HTTP event handler — used only to log response body on errors.
 */
static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    if (evt->event_id == HTTP_EVENT_ON_DATA) {
        ESP_LOGD(TAG, "HTTP data: %.*s", evt->data_len, (char *)evt->data);
    }
    return ESP_OK;
}

static bool upload_audio(const uint8_t *pcm, size_t pcm_len)
{
    /* Build WAV in PSRAM */
    wav_header_t hdr = make_wav_header((uint32_t)pcm_len);
    size_t wav_len = sizeof(hdr) + pcm_len;

    uint8_t *wav = heap_caps_malloc(wav_len, MALLOC_CAP_SPIRAM);
    if (!wav) {
        ESP_LOGE(TAG, "PSRAM alloc failed for WAV (%u bytes)", (unsigned)wav_len);
        return false;
    }
    memcpy(wav, &hdr, sizeof(hdr));
    memcpy(wav + sizeof(hdr), pcm, pcm_len);

    /* Base64 encode — output is ~4/3 × input */
    size_t b64_len = ((wav_len + 2) / 3) * 4 + 1;
    char *b64 = heap_caps_malloc(b64_len, MALLOC_CAP_SPIRAM);
    if (!b64) {
        free(wav);
        ESP_LOGE(TAG, "PSRAM alloc failed for b64 (%u bytes)", (unsigned)b64_len);
        return false;
    }
    base64_encode(wav, wav_len, b64);
    heap_caps_free(wav);

    /* Build JSON: {"audio":"<b64>","sampleRate":16000,"deviceId":"<id>"} */
    size_t prefix_len = strlen("{\"audio\":\"") + strlen("\",\"sampleRate\":") +
                        6 /* sample rate */ + strlen(",\"deviceId\":\"") +
                        strlen(KB_DEVICE_ID) + strlen("\"}") + 1;
    size_t json_len = b64_len + prefix_len;
    char *json = heap_caps_malloc(json_len, MALLOC_CAP_SPIRAM);
    if (!json) {
        heap_caps_free(b64);
        ESP_LOGE(TAG, "PSRAM alloc failed for JSON");
        return false;
    }
    snprintf(json, json_len,
             "{\"audio\":\"%s\",\"sampleRate\":%d,\"deviceId\":\"%s\"}",
             b64, KB_SAMPLE_RATE, KB_DEVICE_ID);
    heap_caps_free(b64);

    ESP_LOGI(TAG, "JSON payload: %u bytes", (unsigned)strlen(json));

    /* POST */
    char url[256];
    snprintf(url, sizeof(url), "%s%s", KB_SERVER_HOST, KB_API_PATH);

    esp_http_client_config_t cfg = {
        .url                        = url,
        .method                     = HTTP_METHOD_POST,
        .timeout_ms                 = KB_HTTP_TIMEOUT_MS,
        .event_handler              = http_event_handler,
        .skip_cert_common_name_check = true,   // dev shortcut — set CA cert in production
        .transport_type             = HTTP_TRANSPORT_OVER_SSL,
        .buffer_size                = 1024,
        .buffer_size_tx             = 4096,
    };

    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json, (int)strlen(json));

    esp_err_t err = esp_http_client_perform(client);
    int code      = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);
    heap_caps_free(json);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "HTTP error: %s", esp_err_to_name(err));
        return false;
    }
    ESP_LOGI(TAG, "HTTP status %d", code);
    return (code == 200);
}

// ─── I2C / ES8388 init ────────────────────────────────────────────────────────

static i2c_master_bus_handle_t s_i2c_bus   = NULL;
static i2c_master_dev_handle_t s_es8388_dev = NULL;

static esp_err_t codec_init(void)
{
    i2c_master_bus_config_t bus_cfg = {
        .i2c_port          = KB_I2C_PORT,
        .sda_io_num        = KB_I2C_SDA,
        .scl_io_num        = KB_I2C_SCL,
        .clk_source        = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_cfg, &s_i2c_bus));

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address  = ES8388_I2C_ADDR,
        .scl_speed_hz    = KB_I2C_FREQ_HZ,
    };
    ESP_ERROR_CHECK(i2c_master_bus_add_device(s_i2c_bus, &dev_cfg, &s_es8388_dev));

    return es8388_init_capture(s_es8388_dev);
}

// ─── app_main ─────────────────────────────────────────────────────────────────

void app_main(void)
{
    ESP_LOGI(TAG, "=== KitchenBot ===");

    /* NVS (required by WiFi) */
    esp_err_t nvs_ret = nvs_flash_init();
    if (nvs_ret == ESP_ERR_NVS_NO_FREE_PAGES || nvs_ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs_ret);

    /* PSRAM check */
    if (heap_caps_get_total_size(MALLOC_CAP_SPIRAM) == 0) {
        ESP_LOGW(TAG, "No PSRAM detected — recording will likely fail");
    } else {
        ESP_LOGI(TAG, "PSRAM: %u KB free",
                 (unsigned)(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024));
    }

    /* LEDs */
    leds_init();

    /* Button — GPIO 36/39 are input-only, no pull-up */
    gpio_set_direction(KB_BTN_RECORD, GPIO_MODE_INPUT);

    /* Codec */
    ESP_ERROR_CHECK(codec_init());

    /* I2S */
    ESP_ERROR_CHECK(i2s_init());

    /* WiFi */
    bool wifi_ok = wifi_connect();
    if (wifi_ok) {
        led_flash(KB_LED_GREEN, 3, 80);
    } else {
        led_flash(KB_LED_RED, 10, 60);
    }

    /* Pre-allocate PCM buffer in PSRAM */
    uint8_t *pcm_buf = heap_caps_malloc(KB_RECORD_BYTES, MALLOC_CAP_SPIRAM);
    if (!pcm_buf) {
        ESP_LOGE(TAG, "Could not allocate PCM buffer (%u bytes) in PSRAM", KB_RECORD_BYTES);
    }

    ESP_LOGI(TAG, "Ready — press KEY1 to record an order");
    led_set(KB_LED_GREEN, true);

    while (1) {
        if (gpio_get_level(KB_BTN_RECORD) == 0) {   // active LOW
            leds_off();
            led_set(KB_LED_RED, true);
            ESP_LOGI(TAG, "Recording …");

            if (!pcm_buf) {
                ESP_LOGE(TAG, "No PCM buffer — aborting");
                led_flash(KB_LED_RED, 8, 60);
                led_set(KB_LED_GREEN, true);
                vTaskDelay(pdMS_TO_TICKS(500));
                continue;
            }

            size_t recorded = record_audio(pcm_buf, KB_RECORD_BYTES);

            leds_off();
            led_set(KB_LED_BLUE, true);
            ESP_LOGI(TAG, "Uploading …");

            bool ok = upload_audio(pcm_buf, recorded);

            leds_off();
            if (ok) {
                led_flash(KB_LED_GREEN, 3, 120);
                ESP_LOGI(TAG, "Done!");
            } else {
                led_flash(KB_LED_RED, 5, 80);
                ESP_LOGE(TAG, "Upload failed");
            }
            led_set(KB_LED_GREEN, true);

            /* Debounce — wait for button release */
            while (gpio_get_level(KB_BTN_RECORD) == 0) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }
            vTaskDelay(pdMS_TO_TICKS(300));
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}
