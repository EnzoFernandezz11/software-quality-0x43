#include "network/networkClient.hpp"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

auto constexpr WIFI_CONNECTION_TIMEOUT_MS = 15000UL;
auto constexpr HTTP_STATUS_OK = 200;
auto constexpr HTTP_STATUS_MULTIPLE_CHOICES = 300;

namespace network
{

    NetworkClient::NetworkClient(const app::AppConfig& config)
        : config_(config)
    {
    }

    void NetworkClient::begin()
    {
        connectToWifi();
    }

    void NetworkClient::ensureWifiConnection()
    {
        if (WiFi.status() != WL_CONNECTED)
        {
            connectToWifi();
        }
    }

    bool NetworkClient::isConnected() const
    {
        return WiFi.status() == WL_CONNECTED;
    }

    bool NetworkClient::postSensorReading(const sensors::SensorReading& reading)
    {
        if (!isConnected())
        {
            return false;
        }

        HTTPClient http;
        const String endpoint = String(config_.backendBaseUrl) + "/api/telemetry";

        if (!http.begin(endpoint))
        {
            logMessage("Could not open telemetry endpoint.");
            return false;
        }

        http.addHeader("Content-Type", "application/json");

        JsonDocument payload;
        payload["sensor_id"] = reading.sensorId;
        payload["raw_temperature"] = reading.rawTemperature;
        payload["motion_detected"] = reading.motionDetected;

        String body;
        serializeJson(payload, body);

        const int statusCode = http.POST(body);
        const String responseBody = http.getString();
        http.end();

        if (statusCode >= HTTP_STATUS_OK && statusCode < HTTP_STATUS_MULTIPLE_CHOICES)
        {
            logMessage("Telemetry sent. temp=" + String(reading.rawTemperature, 1) +
                       "C motion=" + String(reading.motionDetected ? "detected" : "none"));
            return true;
        }

        logMessage("Telemetry failed. HTTP " + String(statusCode) + " body=" + responseBody);
        return false;
    }

    NetworkClient::AuthResponse NetworkClient::validatePin(const String& pin, const String& strategy)
    {
        AuthResponse response {false, "", ""};

        if (!isConnected())
        {
            response.message = "Wi-Fi disconnected";
            return response;
        }

        HTTPClient http;
        const String endpoint = String(config_.backendBaseUrl) + "/api/auth/validate";

        if (!http.begin(endpoint))
        {
            logMessage("Could not open auth endpoint.");
            response.message = "Connection error";
            return response;
        }

        http.addHeader("Content-Type", "application/json");

        JsonDocument payload;
        payload["pin"] = pin;
        if (!strategy.isEmpty())
        {
            payload["strategy"] = strategy;
        }

        String body;
        serializeJson(payload, body);

        const int statusCode = http.POST(body);
        const String responseBody = http.getString();
        http.end();

        if (statusCode >= HTTP_STATUS_OK && statusCode < HTTP_STATUS_MULTIPLE_CHOICES)
        {
            JsonDocument responseJson;
            const DeserializationError error = deserializeJson(responseJson, responseBody);
            if (!error)
            {
                response.authenticated = responseJson["authenticated"] | false;
                response.currentMode = responseJson["current_mode"] | "";
                response.message = responseJson["message"] | "";
            }
            else
            {
                logMessage("Auth response JSON parse failed.");
                response.message = "Failed to parse response";
            }
        }
        else if (statusCode == 401 || statusCode == 400)
        {
            JsonDocument responseJson;
            const DeserializationError error = deserializeJson(responseJson, responseBody);
            if (!error)
            {
                response.authenticated = responseJson["authenticated"] | false;
                response.message = responseJson["message"] | "";
            }
            else
            {
                response.message = "Auth failed (HTTP " + String(statusCode) + ")";
            }
        }
        else
        {
            logMessage("Auth request failed. HTTP " + String(statusCode));
            response.message = "HTTP error " + String(statusCode);
        }

        return response;
    }

    void NetworkClient::connectToWifi()
    {
        if (WiFi.status() == WL_CONNECTED)
        {
            return;
        }

        logMessage("Connecting to Wi-Fi...");
        WiFi.mode(WIFI_STA);
        WiFi.begin(config_.wifiSsid, config_.wifiPassword);

        const unsigned long startedAt = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_CONNECTION_TIMEOUT_MS)
        {
            delay(500);
            Serial.print('.');
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED)
        {
            logMessage("Wi-Fi connected. IP: " + WiFi.localIP().toString());
            return;
        }

        logMessage("Wi-Fi connection failed. Will retry on next loop.");
    }

    void NetworkClient::logMessage(const String& message)
    {
        Serial.println(String("[ESP32] ") + message);
    }

} // namespace network
