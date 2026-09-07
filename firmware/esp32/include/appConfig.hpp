#ifndef FIRMWARE_ESP32_INCLUDE_APP_CONFIG_HPP
#define FIRMWARE_ESP32_INCLUDE_APP_CONFIG_HPP

#include <Arduino.h>
#include <stdint.h>

namespace app
{

    /**
     * @brief Runtime configuration for the ESP32 firmware.
     *
     * This structure centralizes device identity, network settings,
     * GPIO selection, and polling intervals used by the application.
     */
    struct AppConfig
    {
        const char* wifiSsid;
        const char* wifiPassword;
        const char* backendBaseUrl;
        const char* deviceId;
        const char* sensorId;
        uint8_t ledPin;
        unsigned long telemetryIntervalMs;
        unsigned long ledPollIntervalMs;
    };

/**
 * @brief Default firmware configuration.
 *
 * Replace these placeholder values with your local Wi-Fi credentials,
 * backend base URL, and device identifiers before deploying.
 */
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

    inline constexpr AppConfig CONFIG {
        "WIFI_SSID",
        "WIFI_PASSWORD",
        "http://192.168.100.3:5000",
        "esp32-lab-01",
        "temperature-sensor-01",
        LED_BUILTIN,
        10000UL,
        3000UL,
    };

} // namespace app

#endif // FIRMWARE_ESP32_INCLUDE_APP_CONFIG_HPP
