import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { EDriverAcceptanceStatus, EShipmentMatchingCriteria, EShipmentStatus } from '@enums/shipments'
import { EDriverStatus, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import DriverDetailModel from '@models/driverDetail.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import UserModel from '@models/user.model'
import { addSeconds } from 'date-fns'
import { get, isEmpty, map, reduce, union, uniq } from 'lodash'
import { ClientSession, FilterQuery, Types } from 'mongoose'

export async function getAcceptedShipmentForDriverQuery(status: EShipmentMatchingCriteria, userId: string) {
  const user = await UserModel.findById(userId)
  const isBusinessDriver = user.userType === EUserType.BUSINESS
  const driver = isBusinessDriver ? { agentDriver: new Types.ObjectId(userId) } : { driver: new Types.ObjectId(userId) }

  const statusQuery: FilterQuery<Shipment> =
    status === EShipmentMatchingCriteria.PROGRESSING // Status progressing
      ? {
          status: EShipmentMatchingCriteria.PROGRESSING,
          driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
          ...driver,
        }
      : status === EShipmentMatchingCriteria.CANCELLED // Status cancelled
      ? {
          driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
          ...driver,
          $or: [{ status: EShipmentMatchingCriteria.CANCELLED }, { status: 'refund' }],
        }
      : status === EShipmentMatchingCriteria.DELIVERED // Status complete
      ? {
          status: EShipmentMatchingCriteria.DELIVERED,
          driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
          ...driver,
        }
      : { _id: 'none' } // Not Included status

  return statusQuery
}

export async function getNewAllAvailableShipmentForDriverQuery(session: ClientSession = undefined, driverId?: string) {
  let vehicleIds = null
  let employeeVehiclesIds = []
  let ignoreShipments = []
  if (driverId) {
    const user = await UserModel.findById(driverId).lean().session(session)
    if (user) {
      const isBusinessDriver = user.userType === EUserType.BUSINESS
      if (isBusinessDriver) {
        const childrens = await UserModel.find({
          parents: { $in: [driverId] },
          drivingStatus: { $in: [EDriverStatus.IDLE, EDriverStatus.WORKING] },
          status: EUserStatus.ACTIVE,
          validationStatus: EUserValidationStatus.APPROVE,
        }).session(session)
        if (isEmpty(childrens)) {
          return []
        } else {
          const vehicles = reduce(
            childrens,
            (prev, curr) => {
              const vehicless = get(curr, 'driverDetail.serviceVehicleTypes', [])
              return [...prev, ...map(vehicless, (vehicle) => get(vehicle, '_id', ''))]
            },
            [],
          )
          employeeVehiclesIds = uniq(vehicles || [])
        }
      }
      if (user?.drivingStatus === EDriverStatus.BUSY) return []
      const driverDetail = await DriverDetailModel.findById(user.driverDetail).lean().session(session)
      if (driverDetail.serviceVehicleTypes) {
        vehicleIds = driverDetail.serviceVehicleTypes
        if (isBusinessDriver) {
          vehicleIds = union(vehicleIds || [], employeeVehiclesIds)
        }
      }
      const existingShipments = await ShipmentModel.find({
        ...(isBusinessDriver ? { agentDriver: user._id } : { driver: user._id }),
        status: EShipmentStatus.PROGRESSING,
        driverAcceptanceStatus: EDriverAcceptanceStatus.ACCEPTED,
      })
        .lean()
        .session(session)
      ignoreShipments = isBusinessDriver
        ? []
        : map(existingShipments, (shipment) => {
            const start = shipment.bookingDateTime
            const end = addSeconds(shipment.bookingDateTime, shipment.displayTime)
            return { bookingDateTime: { $gte: start, $lt: end } }
          })
    }
  }

  const query = {
    status: EShipmentStatus.IDLE,
    driverAcceptanceStatus: EDriverAcceptanceStatus.PENDING,
    ...(!isEmpty(vehicleIds) ? { vehicleId: { $in: vehicleIds } } : {}),
    $or: [
      { requestedDriver: { $exists: false } }, // 1. ไม่มี requestedDriver
      { requestedDriver: null }, // 2. requestedDriver เป็น null
      ...(driverId ? [{ requestedDriver: new Types.ObjectId(driverId) }] : []), // 3. requestedDriver ตรงกับ driverId
    ],
    ...(driverId && !isEmpty(ignoreShipments) ? { $nor: ignoreShipments } : {}),
  }

  return query
}

export async function getNewAllAvailableShipmentForDriver(
  driverId?: string,
  options: any = {},
  session: ClientSession = undefined,
) {
  const generatedQuery = await getNewAllAvailableShipmentForDriverQuery(session, driverId)
  const queryOptions = Object.assign(options, { sort: { bookingDateTime: 1 }, session })
  const query = isEmpty(generatedQuery) ? {} : generatedQuery
  const shipments = await ShipmentModel.find(query, undefined, queryOptions).exec()
  if (!shipments) {
    return []
  }
  return shipments
}

export async function publishDriverMatchingShipment(
  driverId?: string,
  options: any = {},
  session: ClientSession = undefined,
) {
  const newShipments = await getNewAllAvailableShipmentForDriver(driverId, options, session)
  await pubsub.publish(SHIPMENTS.GET_MATCHING_SHIPMENT, newShipments)
}
