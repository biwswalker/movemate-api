import { EShipmentStatus } from '@enums/shipments'
import { EUserType } from '@enums/users'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel, { User } from '@models/user.model'
import { addSeconds } from 'date-fns'
import { GraphQLError } from 'graphql'

export async function getAgentParents(userId: string): Promise<User[]> {
  try {
    const driver = await UserModel.findById(userId).lean()
    const parents = await UserModel.find({ _id: { $in: driver.parents }, userType: EUserType.BUSINESS })
    return parents
  } catch (error) {
    console.log(error)
    throw new GraphQLError('ไม่สามารถเรียกรายการนายหน้าได้ โปรดลองอีกครั้ง')
  }
}

/**
 * ฟังก์ชันใหม่สำหรับตรวจสอบว่าคนขับมีงานซ้อนในช่วงเวลาที่กำหนดหรือไม่
 * @param driverId - ไอดีของคนขับที่ต้องการตรวจสอบ
 * @param newShipment - Object ของงานใหม่ที่ต้องการให้คนขับรับ
 * @returns {Promise<boolean>} - คืนค่า true หากคนขับว่าง, false หากมีงานซ้อน
 */
export async function isDriverAvailableForShipment(driverId: string, newShipment: Shipment): Promise<boolean> {
  // 1. กำหนดช่วงเวลาของงานใหม่
  const newShipmentStartTime = newShipment.bookingDateTime
  const newShipmentEndTime = addSeconds(newShipment.bookingDateTime, newShipment.displayTime)

  // 2. ค้นหางานอื่น (Shipment) ของคนขับคนนี้ที่มีสถานะ PROGRESSING
  // และมีช่วงเวลาคาบเกี่ยวกับงานใหม่
  const conflictingShipmentsCount = await ShipmentModel.countDocuments({
    _id: { $ne: newShipment._id }, // ไม่นับงานตัวเอง
    driver: driverId,
    status: EShipmentStatus.PROGRESSING,
    $or: [
      // กรณีที่ 1: งานเก่าเริ่มต้นก่อนและจบลงระหว่างช่วงเวลางานใหม่
      {
        bookingDateTime: { $lt: newShipmentEndTime },
        $expr: {
          $gt: [{ $add: ['$bookingDateTime', { $multiply: ['$displayTime', 1000] }] }, newShipmentStartTime],
        },
      },
      // กรณีที่ 2: งานเก่าเริ่มต้นระหว่างช่วงเวลางานใหม่
      {
        bookingDateTime: { $gte: newShipmentStartTime, $lt: newShipmentEndTime },
      },
    ],
  })

  // 3. ถ้าไม่พบงานที่คาบเกี่ยวกัน (count === 0) แสดงว่าคนขับว่าง
  return conflictingShipmentsCount === 0
}
