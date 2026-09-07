#include <cmath>
#include <gtest/gtest.h>

#include "sensors/mock_sensor_model.hpp"

namespace sensors
{
    namespace
    {

        // Model under test:
        //   temperature = 24.5 + 3.5 * sin(t / 18)
        //   humidity    = 48.0 + 9.0 * sin(t / 23 + 0.8)
        constexpr float kPi = 3.14159265358979323846f;

        TEST(MockSensorModelTest, ReturnsExpectedBaselineAtZeroSeconds)
        {
            const MockSensorSample sample = MockSensorModel::sampleAt(0.0f);

            EXPECT_FLOAT_EQ(sample.temperature, 24.5f);
            EXPECT_NEAR(sample.humidity, 48.0f + 9.0f * std::sin(0.8f), 0.0001f);
        }

        TEST(MockSensorModelTest, IsDeterministicForTheSameInstant)
        {
            const MockSensorSample first = MockSensorModel::sampleAt(42.0f);
            const MockSensorSample second = MockSensorModel::sampleAt(42.0f);

            EXPECT_FLOAT_EQ(first.temperature, second.temperature);
            EXPECT_FLOAT_EQ(first.humidity, second.humidity);
        }

        TEST(MockSensorModelTest, ProducesValuesInsideExpectedOperatingRange)
        {
            for (float second = 0.0f; second <= 600.0f; second += 5.0f)
            {
                const MockSensorSample sample = MockSensorModel::sampleAt(second);

                EXPECT_GE(sample.temperature, 21.0f);
                EXPECT_LE(sample.temperature, 28.0f);
                EXPECT_GE(sample.humidity, 39.0f);
                EXPECT_LE(sample.humidity, 57.0f);
            }
        }

        TEST(MockSensorModelTest, TemperatureReachesItsAmplitudeExtremes)
        {
            // sin peaks at pi/2 and bottoms at 3*pi/2; t/18 hits those at 9*pi and 27*pi.
            const MockSensorSample peak = MockSensorModel::sampleAt(9.0f * kPi);
            const MockSensorSample trough = MockSensorModel::sampleAt(27.0f * kPi);

            EXPECT_NEAR(peak.temperature, 28.0f, 1e-3f);    // 24.5 + 3.5
            EXPECT_NEAR(trough.temperature, 21.0f, 1e-3f);  // 24.5 - 3.5
        }

        TEST(MockSensorModelTest, HumidityReachesItsAmplitudeExtremes)
        {
            // t/23 + 0.8 hits pi/2 (peak) and 3*pi/2 (trough) at these instants.
            const MockSensorSample peak = MockSensorModel::sampleAt(23.0f * (kPi / 2.0f - 0.8f));
            const MockSensorSample trough = MockSensorModel::sampleAt(23.0f * (3.0f * kPi / 2.0f - 0.8f));

            EXPECT_NEAR(peak.humidity, 57.0f, 1e-3f);    // 48 + 9
            EXPECT_NEAR(trough.humidity, 39.0f, 1e-3f);  // 48 - 9
        }

        TEST(MockSensorModelTest, TemperatureIsPeriodic)
        {
            // Temperature period is 2*pi*18 = 36*pi seconds.
            const float period = 36.0f * kPi;

            EXPECT_NEAR(MockSensorModel::sampleAt(5.0f).temperature,
                        MockSensorModel::sampleAt(5.0f + period).temperature, 1e-2f);
        }

        TEST(MockSensorModelTest, EvolvesOverTime)
        {
            const MockSensorSample initial = MockSensorModel::sampleAt(10.0f);
            const MockSensorSample later = MockSensorModel::sampleAt(120.0f);

            EXPECT_NE(initial.temperature, later.temperature);
            EXPECT_NE(initial.humidity, later.humidity);
        }

    } // namespace
} // namespace sensors

int main(int argc, char** argv)
{
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
