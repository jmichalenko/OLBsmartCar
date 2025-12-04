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
    const CORRECTION_SPEED = 25
    const BRAKE_DURATION = 100
    const MPU_ADDR = 0x68
    const PWR_MGMT_1 = 0x6B
    const GYRO_Z_H = 0x47
    
    // Calibrate this number using a tape measure! (cm per second at speed 60)
    const CM_PER_SECOND = 30 

    let is_initialized = false

    /**
     * Wakes up the MPU6050 and calibrates it.
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
        
        basic.showIcon(IconNames.Yes) // "Ready!"
        basic.pause(500)
    }

    /**
     * Drives distance in cm (Approximate!)
     */
    //% block="drive forward %cm cm"
    //% weight=80
    export function driveDistance(cm: number) {
        let seconds_needed = cm / CM_PER_SECOND
        let ms_needed = seconds_needed * 1000
        wuKong.setAllMotor(60, 60)
        basic.pause(ms_needed)
        wuKong.stopAllMotor()
    }

    /**
     * Turns the robot to a specific angle.
     */
    //% block="turn %direction by %target_angle degrees at speed %speed"
    //% target_angle.defl=90
    //% speed.min=20 speed.max=100 speed.defl=50
    //% weight=90
    export function turn(direction: TurnDirection, target_angle: number, speed: number) {
        if (!is_initialized) return; 
        current_angle = 0
        last_time = control.millis()
        speed = Math.abs(speed)
        if (speed < 20) speed = 20
        if (speed > 100) speed = 100

        let left_motor_val = 0
        let right_motor_val = 0

        if (direction == TurnDirection.Left) {
            left_motor_val = -speed
            right_motor_val = speed
        } else {
            left_motor_val = speed
            right_motor_val = -speed
        }

        let stop_early_buffer = 15
        if (speed < 40) stop_early_buffer = 8
        let rough_target = target_angle - stop_early_buffer 
        
        wuKong.setAllMotor(left_motor_val, right_motor_val)

        while (Math.abs(current_angle) < rough_target) {
            updateAngle()
            basic.pause(10)
        }

        wuKong.setAllMotor(-left_motor_val, -right_motor_val)
        basic.pause(BRAKE_DURATION)
        wuKong.stopAllMotor()
        basic.pause(200)

        let start_fix = control.millis()
        while (Math.abs(Math.abs(current_angle) - target_angle) > 1 && (control.millis() - start_fix < 3000)) {
            updateAngle()
            let current_abs = Math.abs(current_angle)
            if (current_abs < target_angle) {
                if (direction == TurnDirection.Left) wuKong.setAllMotor(-CORRECTION_SPEED, CORRECTION_SPEED)
                else wuKong.setAllMotor(CORRECTION_SPEED, -CORRECTION_SPEED)
            } else {
                if (direction == TurnDirection.Left) wuKong.setAllMotor(CORRECTION_SPEED, -CORRECTION_SPEED)
                else wuKong.setAllMotor(-CORRECTION_SPEED, CORRECTION_SPEED)
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
        pins.i2cWriteNumber(
