/**
 * COMPLETE SMART CAR PACKAGE
 * Includes: MPU6050 Driver + Smart Turning + Speed Control
 */

//% color="#E63022" weight=100 icon="\uf1b9" block="Smart Car"
namespace smartCar {

    // --- INTERNAL VARIABLES ---
    let gyro_offset = 0
    let last_time = 0
    let current_angle = 0

    // Safety Correction Speed (Always keep this low!)
    const CORRECTION_SPEED = 25
    const BRAKE_DURATION = 100

    // MPU6050 I2C Constants
    const MPU_ADDR = 0x68
    const PWR_MGMT_1 = 0x6B
    const GYRO_Z_H = 0x47

    let is_initialized = false

    /**
     * Wakes up the MPU6050 and calibrates it.
     * MUST be called at 'On Start' while car is still!
     */
    //% block="setup and calibrate gyro"
    //% weight=100
    export function setupAndCalibrate() {
        basic.showIcon(IconNames.No) // "Don't Move!"

        // 1. WAKE UP SENSOR 
        pins.i2cWriteNumber(MPU_ADDR, PWR_MGMT_1, NumberFormat.UInt8BE)
        pins.i2cWriteNumber(MPU_ADDR, 0x00, NumberFormat.UInt8BE)
        is_initialized = true
        basic.pause(100)

        // 2. CALIBRATE 
        let sum = 0
        for (let i = 0; i < 20; i++) {
            sum += readRawGyroZ()
            basic.pause(50)
        }
        gyro_offset = sum / 20

        basic.showIcon(IconNames.Yes) // Ready
        basic.pause(500)
    }

    /**
     * Turns the robot to a specific angle.
     * @param direction Left or Right
     * @param target_angle Angle in degrees (e.g. 90)
     * @param speed Motor speed (20-100)
     */
    //% block="turn %direction by %target_angle degrees at speed %speed"
    //% target_angle.defl=90
    //% speed.min=20 speed.max=100 speed.defl=50
    //% weight=90
    export function turn(direction: TurnDirection, target_angle: number, speed: number) {
        if (!is_initialized) return;

        current_angle = 0
        last_time = control.millis()

        // Ensure speed is positive and within safety limits
        speed = Math.abs(speed)
        if (speed < 20) speed = 20
        if (speed > 100) speed = 100

        // Determine Motor Directions
        // Left Turn: Left Motor Reverse (-), Right Motor Forward (+)
        // Right Turn: Left Motor Forward (+), Right Motor Reverse (-)

        let left_motor_val = 0
        let right_motor_val = 0

        if (direction == TurnDirection.Left) {
            left_motor_val = -speed
            right_motor_val = speed
        } else {
            left_motor_val = speed
            right_motor_val = -speed
        }

        // --- PHASE 1: ROUGH TURN (User Speed) ---
        // Stop a bit early (approx 15 degrees early) to account for momentum
        // If speed is very low, we don't need to stop as early
        let stop_early_buffer = 15
        if (speed < 40) stop_early_buffer = 8

        let rough_target = target_angle - stop_early_buffer

        wuKong.setAllMotor(left_motor_val, right_motor_val)

        while (Math.abs(current_angle) < rough_target) {
            updateAngle()
            basic.pause(10)
        }

        // Active Brake (Reverse motors briefly)
        wuKong.setAllMotor(-left_motor_val, -right_motor_val)
        basic.pause(BRAKE_DURATION)
        wuKong.stopAllMotor()
        basic.pause(200)

        // --- PHASE 2: PRECISE CORRECTION (Fixed Slow Speed) ---
        let start_fix = control.millis()

        // Loop until error is less than 1 degree OR 3 seconds have passed
        while (Math.abs(Math.abs(current_angle) - target_angle) > 1 && (control.millis() - start_fix < 3000)) {
            updateAngle()

            let current_abs = Math.abs(current_angle)

            // Logic: Do we need to turn MORE or LESS?
            if (current_abs < target_angle) {
                // Undershot -> Continue in same direction at slow speed
                if (direction == TurnDirection.Left) {
                    wuKong.setAllMotor(-CORRECTION_SPEED, CORRECTION_SPEED)
                } else {
                    wuKong.setAllMotor(CORRECTION_SPEED, -CORRECTION_SPEED)
                }
            } else {
                // Overshot -> Reverse direction at slow speed
                if (direction == TurnDirection.Left) {
                    wuKong.setAllMotor(CORRECTION_SPEED, -CORRECTION_SPEED)
                } else {
                    wuKong.setAllMotor(-CORRECTION_SPEED, CORRECTION_SPEED)
                }
            }
            basic.pause(20)
        }
        wuKong.stopAllMotor()
        basic.clearScreen()
    }

    // --- INTERNAL HELPERS ---

    function updateAngle() {
        let now = control.millis()
        let dt = (now - last_time) / 1000
        last_time = now

        let gyro_reading = readRawGyroZ() - gyro_offset
        current_angle += gyro_reading * dt
    }

    function readRawGyroZ(): number {
        pins.i2cWriteNumber(MPU_ADDR, GYRO_Z_H, NumberFormat.UInt8BE);
        let raw_data = pins.i2cReadBuffer(MPU_ADDR, 2);
        let h = raw_data[0]
        let l = raw_data[1]
        let value = (h << 8) | l

        if (value >= 0x8000) {
            value = value - 0x10000
        }
        // Scale 250dps range to degrees
        return value / 131.0
    }
}

// Enum for dropdown menu
enum TurnDirection {
    Left,
    Right
}