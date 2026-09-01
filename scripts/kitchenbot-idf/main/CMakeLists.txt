idf_component_register(
    SRCS
        "main.c"
        "es8388.c"
    INCLUDE_DIRS "."
    REQUIRES
        driver
        esp_wifi
        esp_http_client
        esp_tls
        nvs_flash
        esp_netif
        esp_event
        heap
        log
)
