#pragma once

#include "esp_err.h"
#include "driver/i2c_master.h"

#define ES8388_I2C_ADDR  0x10   // 7-bit address (CSB pin = GND on AI-Thinker)

/**
 * Initialise the ES8388 codec for microphone recording.
 * Call once after I2C bus and master device are created.
 *
 * @param dev  Opened i2c_master_dev_handle_t for the ES8388
 */
esp_err_t es8388_init_capture(i2c_master_dev_handle_t dev);

/** Mute / un-mute the ADC output. */
esp_err_t es8388_set_adc_mute(i2c_master_dev_handle_t dev, bool mute);
