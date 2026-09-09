#include "sensors/sensorService.hpp"

#include <Arduino.h>
#include <Keypad.h>

// #include "sensors/mock_sensor_model.hpp"  // Uncomment to use the mock model

namespace sensors
{

    // Physical sensor pin assignments
    namespace
    {
        constexpr uint8_t PIN_LM35 = 36; // ADC1_CH0, analog temperature sensor
        constexpr uint8_t PIN_PIR = 35;  // digital input, motion sensor

        // 4x4 matrix keypad wiring: row and column GPIOs
        byte rowPins[4] = {12, 14, 27, 26};
        byte colPins[4] = {25, 32, 19, 33};
        char keymap[4][4] = {
            {'1', '2', '3', 'A'},
            {'4', '5', '6', 'B'},
            {'7', '8', '9', 'C'},
            {'*', '0', '#', 'D'},
        };
        Keypad teclado = Keypad(makeKeymap(keymap), rowPins, colPins, 4, 4);
    } // namespace

    SensorService::SensorService(const app::AppConfig& config)
        : config_(config)
    {
    }

    void SensorService::begin()
    {
        pinMode(PIN_LM35, INPUT); // ADC, GPIO 36
        pinMode(PIN_PIR, INPUT);  // Digital, GPIO 35
    }

    void SensorService::pollMotion()
    {
        // PIR: HIGH means motion. We latch it because the pulse only lasts a
        // few seconds while telemetry is sent every several seconds, so a single
        // read at send time would usually miss the event.
        if (digitalRead(PIN_PIR) == HIGH)
        {
            motionLatched_ = true;
        }
    }

    SensorReading SensorService::read()
    {
        // --- REAL SENSORS ---
        // LM35: analogReadMilliVolts() applies the ESP32 ADC factory calibration,
        // which corrects the non-linearity in the low range. The LM35 outputs
        // 10 mV per degree C, so temperature = mV / 10.
        const uint32_t milliVolts = analogReadMilliVolts(PIN_LM35);
        const float temperature = milliVolts / 10.0f;

        // Report any motion latched during the interval and clear the latch for
        // the next one. The pollMotion() call also samples the PIR right now, so
        // motion happening at read time is not lost.
        pollMotion();
        const bool motionDetected = motionLatched_;
        motionLatched_ = false;

        return {
            config_.sensorId,
            temperature,
            motionDetected,
        };

        // --- MOCK MODEL ---
        // Drop-in replacement for the real readings above: useful for testing
        // the telemetry pipeline without wiring up physical sensors.
        // const float elapsedSeconds = millis() / 1000.0f;
        // const MockSensorSample sample = MockSensorModel::sampleAt(elapsedSeconds);
        // const bool motionDetected = (static_cast<int>(elapsedSeconds) % 20) < 10;
        // return {
        //     config_.sensorId,
        //     sample.temperature,
        //     motionDetected,
        // };
    }

    char SensorService::readKey() const
    {
        return teclado.getKey();
    }

} // namespace sensors
