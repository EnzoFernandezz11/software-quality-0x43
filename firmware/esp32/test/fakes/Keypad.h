// Minimal Keypad fake for native (host) unit tests.
//
// Mirrors the subset of the chris--a/Keypad API used by SensorService so the
// service compiles on the host. getKey() returns a test-controllable value.
#ifndef FIRMWARE_ESP32_TEST_FAKES_KEYPAD_H
#define FIRMWARE_ESP32_TEST_FAKES_KEYPAD_H

#include <Arduino.h>

#define makeKeymap(x) (reinterpret_cast<char*>(x))

// Test-controllable: the key the next getKey() call returns.
inline char fakeKeypadKey = '\0';

class Keypad
{
public:
    Keypad(char*, byte*, byte*, byte, byte) {}
    char getKey() { return fakeKeypadKey; }
};

#endif // FIRMWARE_ESP32_TEST_FAKES_KEYPAD_H
