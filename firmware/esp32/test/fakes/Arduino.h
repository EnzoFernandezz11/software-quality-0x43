// Minimal Arduino.h fake for native (host) unit tests.
//
// Replaces the ESP32 Arduino core so SensorService and friends can be compiled
// and exercised on the host. Hardware reads are backed by the globals below so
// tests can drive them deterministically.
#ifndef FIRMWARE_ESP32_TEST_FAKES_ARDUINO_H
#define FIRMWARE_ESP32_TEST_FAKES_ARDUINO_H

#include <cstdint>
#include <string>

// --- Arduino type aliases ---
using byte = uint8_t;
using String = std::string;

// --- Digital levels and pin modes ---
constexpr int LOW = 0;
constexpr int HIGH = 1;
constexpr int INPUT = 0;
constexpr int OUTPUT = 1;
constexpr int INPUT_PULLUP = 2;

// --- Test-controllable hardware state ---
// Tests assign these to drive the fake reads performed by the stubs below.
inline uint32_t fakeAnalogMilliVolts = 0;
inline int fakeDigitalLevel = LOW;
inline unsigned long fakeMillis = 0;

// --- Arduino API stubs backed by the globals above ---
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, int) {}
inline int digitalRead(uint8_t) { return fakeDigitalLevel; }
inline int analogRead(uint8_t) { return 0; }
inline uint32_t analogReadMilliVolts(uint8_t) { return fakeAnalogMilliVolts; }
inline unsigned long millis() { return fakeMillis; }

#endif // FIRMWARE_ESP32_TEST_FAKES_ARDUINO_H
