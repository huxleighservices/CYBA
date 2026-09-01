#include "es8388.h"
#include "esp_log.h"

static const char *TAG = "es8388";

/* Write a single register over I2C */
static esp_err_t es_write(i2c_master_dev_handle_t dev, uint8_t reg, uint8_t val)
{
    uint8_t buf[2] = { reg, val };
    esp_err_t ret = i2c_master_transmit(dev, buf, sizeof(buf), pdMS_TO_TICKS(100));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "write reg 0x%02X = 0x%02X failed: %s", reg, val, esp_err_to_name(ret));
    }
    return ret;
}

esp_err_t es8388_init_capture(i2c_master_dev_handle_t dev)
{
    esp_err_t ret = ESP_OK;

    /* Chip reset */
    ret |= es_write(dev, 0x00, 0x80);   // RESET: DAC/ADC reset
    vTaskDelay(pdMS_TO_TICKS(10));
    ret |= es_write(dev, 0x00, 0x00);   // Release reset

    /* Master mode: codec provides BCLK and LRCLK */
    ret |= es_write(dev, 0x08, 0x80);   // MASTERMODE: master

    /* Power management */
    ret |= es_write(dev, 0x01, 0x58);   // PDVDD off, ref power up
    ret |= es_write(dev, 0x02, 0xF3);   // Power down DAC, keep ADC powered
    ret |= es_write(dev, 0x03, 0x00);   // ADC power: PGA/ADC on

    /* ADC clock */
    ret |= es_write(dev, 0x0B, 0x82);   // ADC_CLK: MCLK/2, ADC_OSR=128
    ret |= es_write(dev, 0x0C, 0x0C);   // ADCFSCLK: SCLK/3

    /* ADC control: select LINE2 (onboard mics on AI-Thinker board) */
    ret |= es_write(dev, 0x0A, 0x00);   // ADCCONTROL1: LINSEL=LINE2, RINSEL=LINE2
    ret |= es_write(dev, 0x0D, 0x02);   // ADCCONTROL2: differential off, single-ended

    /* PGA gain ≈ 24 dB — tweak if too quiet/loud */
    ret |= es_write(dev, 0x0E, 0x88);   // L/R PGA: +24 dB each

    /* I2S format: 16-bit, I2S standard */
    ret |= es_write(dev, 0x0F, 0x00);   // ADC I2S: format=I2S, 16-bit

    /* ADC digital volume: 0 dB */
    ret |= es_write(dev, 0x10, 0x00);
    ret |= es_write(dev, 0x11, 0x00);

    /* Enable ADC */
    ret |= es_write(dev, 0x29, 0x00);   // ADCCONTROL14: no mute

    /* DAC control — power down DAC but keep clocks so I2S runs */
    ret |= es_write(dev, 0x04, 0xC0);   // DAC power down

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "ES8388 initialised for capture");
    }
    return ret;
}

esp_err_t es8388_set_adc_mute(i2c_master_dev_handle_t dev, bool mute)
{
    return es_write(dev, 0x29, mute ? 0x03 : 0x00);
}
