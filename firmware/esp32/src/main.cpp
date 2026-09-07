#include <Arduino.h>

#include "appConfig.hpp"
#include "network/networkClient.hpp"
#include "network/networkTypes.hpp"
#include "sensors/sensorService.hpp"

auto constexpr SERIAL_BAUD_RATE = 115200;
auto constexpr DELAY_BETWEEN_TASKS_MS = 100;

namespace
{

    network::NetworkClient networkClient(app::CONFIG);
    sensors::SensorService sensorService(app::CONFIG);

    unsigned long lastTelemetryAt = 0;

    void handleTelemetryTask()
    {
        if (millis() - lastTelemetryAt < app::CONFIG.telemetryIntervalMs)
        {
            return;
        }

        lastTelemetryAt = millis();
        networkClient.ensureWifiConnection();

        if (!networkClient.isConnected())
        {
            Serial.println("[ESP32] Skipping telemetry because Wi-Fi is offline.");
            return;
        }

        const sensors::SensorReading reading = sensorService.read();
        networkClient.postSensorReading(reading);
    }

    // Two-step authentication flow driven by the matrix keypad:
    //   Step 1 (pick strategy): 'A' = LocalMemory, 'B' = ExternalApi, confirm with '#'.
    //   Step 2 (enter PIN): digits are accumulated and validated with '#'.
    // '*' cancels at any point and restarts the flow from step 1.
    enum class AuthStep { SelectStrategy, EnterPin };

    AuthStep authStep = AuthStep::SelectStrategy;
    String selectedStrategy;  // empty until the user picks A or B
    String pinBuffer;

    void resetAuthFlow()
    {
        authStep = AuthStep::SelectStrategy;
        selectedStrategy = "";
        pinBuffer = "";
        Serial.println("[Keypad] Seleccione estrategia: A=Local, B=External, luego #.");
    }

    void handleKeypadTask()
    {
        const char key = sensorService.readKey();
        if (key == '\0') return;

        if (key == '*') {
            Serial.println("[Keypad] Flujo cancelado.");
            resetAuthFlow();
            return;
        }

        if (authStep == AuthStep::SelectStrategy) {
            if (key == 'A') {
                selectedStrategy = "LocalMemoryAuthStrategy";
                Serial.println("[Keypad] Estrategia: Local (A). Presione # para confirmar.");
            } else if (key == 'B') {
                selectedStrategy = "ExternalApiAuthStrategy";
                Serial.println("[Keypad] Estrategia: External (B). Presione # para confirmar.");
            } else if (key == '#') {
                if (selectedStrategy.isEmpty()) {
                    Serial.println("[Keypad] Elija A o B antes de confirmar.");
                    return;
                }
                authStep = AuthStep::EnterPin;
                Serial.println("[Keypad] Ingrese PIN y presione #.");
            } else {
                Serial.println("[Keypad] Opcion invalida. Use A (Local) o B (External).");
            }
            return;
        }

        // authStep == EnterPin
        if (key == '#') {
            if (pinBuffer.isEmpty()) return;
            Serial.print("[Keypad] Validando PIN con estrategia "); Serial.println(selectedStrategy);
            const auto result = networkClient.validatePin(pinBuffer, selectedStrategy);
            Serial.println(result.authenticated ? "[Keypad] PIN correcto." : "[Keypad] PIN incorrecto.");
            resetAuthFlow();
            return;
        }

        pinBuffer += key;
        Serial.print("[Keypad] Tecla: "); Serial.println(key);
    }

}  // namespace

void setup()
{
    Serial.begin(SERIAL_BAUD_RATE);
    pinMode(app::CONFIG.ledPin, OUTPUT);
    digitalWrite(app::CONFIG.ledPin, LOW);

    delay(DELAY_BETWEEN_TASKS_MS * 10); // Allow time for the serial monitor to connect before printing logs.
    Serial.println("[ESP32] Booting firmware...");

    sensorService.begin();
    networkClient.begin();
}

void loop()
{
    sensorService.pollMotion();  // sample the PIR every ~100 ms so short pulses aren't missed
    handleTelemetryTask();
    handleKeypadTask();
    delay(DELAY_BETWEEN_TASKS_MS);
}
