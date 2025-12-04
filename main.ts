smartCar.setupAndCalibrate()
for (let index = 0; index < 3; index++) {
    wuKong.setAllMotor(100, 100)
    basic.pause(3000)
    smartCar.turn(TurnDirection.Right, 90, 50)
}
smartCar.turn(TurnDirection.Right, 90, 50)
