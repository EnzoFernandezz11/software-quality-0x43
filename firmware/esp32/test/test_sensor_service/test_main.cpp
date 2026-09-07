#include <gtest/gtest.h>

#include "Arduino.h"
#include "Keypad.h"
#include "sensors/sensorService.hpp"

namespace sensors
{
    namespace
    {

        class SensorServiceTest : public ::testing::Test
        {
        protected:
            void SetUp() override
            {
                fakeAnalogMilliVolts = 0;
                fakeDigitalLevel = LOW;
                fakeKeypadKey = '\0';
                service.begin();
            }

            sensors::SensorService service{app::CONFIG};
        };

        TEST_F(SensorServiceTest, ConvertsMilliVoltsToCelsius)
        {
            fakeAnalogMilliVolts = 250;  // LM35: 10 mV/°C -> 25.0 °C
            const SensorReading reading = service.read();
            EXPECT_FLOAT_EQ(reading.rawTemperature, 25.0f);
        }

        TEST_F(SensorServiceTest, ReportsNoMotionWhenPirStaysLow)
        {
            fakeDigitalLevel = LOW;
            service.pollMotion();
            const SensorReading reading = service.read();
            EXPECT_FALSE(reading.motionDetected);
        }

        TEST_F(SensorServiceTest, LatchesMotionBetweenReads)
        {
            // PIR pulses HIGH briefly...
            fakeDigitalLevel = HIGH;
            service.pollMotion();
            // ...then drops LOW before telemetry is sent.
            fakeDigitalLevel = LOW;

            const SensorReading reading = service.read();
            EXPECT_TRUE(reading.motionDetected);
        }

        TEST_F(SensorServiceTest, ClearsMotionLatchAfterReporting)
        {
            fakeDigitalLevel = HIGH;
            service.pollMotion();
            fakeDigitalLevel = LOW;
            (void) service.read();  // consumes and clears the latch

            const SensorReading second = service.read();
            EXPECT_FALSE(second.motionDetected);
        }

        TEST_F(SensorServiceTest, DetectsMotionPresentAtReadTime)
        {
            // No prior pollMotion(); PIR is HIGH exactly at read time.
            fakeDigitalLevel = HIGH;
            const SensorReading reading = service.read();
            EXPECT_TRUE(reading.motionDetected);
        }

        TEST_F(SensorServiceTest, TagsReadingWithConfiguredSensorId)
        {
            const SensorReading reading = service.read();
            EXPECT_EQ(reading.sensorId, app::CONFIG.sensorId);
        }

        TEST_F(SensorServiceTest, ReadKeyReturnsPressedKey)
        {
            fakeKeypadKey = '7';
            EXPECT_EQ(service.readKey(), '7');
        }

        TEST_F(SensorServiceTest, ReadKeyReturnsNullWhenNoKeyPressed)
        {
            fakeKeypadKey = '\0';
            EXPECT_EQ(service.readKey(), '\0');
        }

    } // namespace
} // namespace sensors

int main(int argc, char** argv)
{
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
