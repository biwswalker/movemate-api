import { Mutation, Arg, Ctx, Resolver, UseMiddleware } from 'type-graphql'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { GraphQLContext } from '@configs/graphQL.config'
import ShipmentModel from '@models/shipment.model'
import { EShipmentStatus } from '@enums/shipments'
import { AuthGuard } from '@guards/auth.guards'
import { EUserRole } from '@enums/users'
import redis from '@configs/redis'

@Resolver()
export default class TrackingResolver {
  // ✅ Mutation สำหรับรับตำแหน่งจาก Driver App
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER])) // เฉพาะคนขับเท่านั้น
  async updateDriverLocation(
    @Arg('latitude') latitude: number,
    @Arg('longitude') longitude: number,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const driverId = ctx.req.user_id

    // 1. หาว่าคนขับกำลังทำงานไหนอยู่ (อาจจะต้อง query shipment ที่ active อยู่)
    const activeShipment = await ShipmentModel.findOne({ driver: driverId, status: EShipmentStatus.PROGRESSING }) // เปลี่ยน

    if (activeShipment) {
      const locationData = { latitude, longitude }

      // 2. บันทึกตำแหน่งล่าสุดลง Redis (เร็วมาก!)
      // ตั้งค่าให้ข้อมูลหมดอายุใน 1 วัน
      await redis.set(`driver-location:${driverId}`, JSON.stringify(locationData), 'EX', 86400)

      // 3. Publish ข้อมูลไปยังช่องทาง Subscription
      // ใช้ ID ของ Shipment เพื่อให้ส่งข้อมูลถูกช่อง
      await pubsub.publish(SHIPMENTS.DRIVER_LOCATION, activeShipment._id.toString(), locationData)
    }

    return true
  }
}
