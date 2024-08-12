import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { GetShipmentArgs, ShipmentInput } from '@inputs/shipment.input'
import PaymentModel, { CashDetail } from '@models/payment.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import ShipmentAdditionalServicePriceModel from '@models/shipmentAdditionalServicePrice.model'
import UserModel from '@models/user.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation, FilterQuery } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { get, head, isEmpty, map, omitBy, reduce, tail, values } from 'lodash'
import AdditionalServiceCostPricingModel from '@models/additionalServiceCostPricing.model'
import ShipmentDistancePricingModel from '@models/shipmentDistancePricing.model'
import VehicleCostModel from '@models/vehicleCost.model'
import PrivilegeModel from '@models/privilege.model'
import DirectionsResultModel from '@models/directionResult.model'
import { FileInput } from '@inputs/file.input'
import FileModel from '@models/file.model'
import VehicleTypeModel from '@models/vehicleType.model'
import { DistanceCostPricing } from '@models/distanceCostPricing.model'
import { email_sender } from '@utils/email.utils'
import NotificationModel from '@models/notification.model'
import { ShipmentPaginationPayload, TotalRecordPayload } from '@payloads/shipment.payloads'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'

Aigle.mixin(lodash, {})

@Resolver(Shipment)
export default class ShipmentResolver {
  @Query(() => Shipment)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipment(@Arg('id') id: string): Promise<Shipment> {
    try {
      const shipment = await ShipmentModel.findById(id)
      if (!shipment) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipment
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => Shipment)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async getShipmentByTracking(@Ctx() ctx: GraphQLContext, @Arg('trackingNumber') trackingNumber: string): Promise<Shipment> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const shipment = await ShipmentModel.findOne({ trackingNumber, ...(user_role === 'customer' ? { customer: user_id } : {}) })
      if (!shipment) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipment
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => ShipmentPaginationPayload)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipmentList(
    @Ctx() ctx: GraphQLContext,
    @Args() query: GetShipmentArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<ShipmentPaginationPayload> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      // Pagination
      const pagination = reformPaginate(paginate)
      // Query
      const filterEmptyQuery = omitBy(query, isEmpty)
      const filterQuery: FilterQuery<typeof Shipment> = {
        ...filterEmptyQuery,
        ...(query.trackingNumber
          ? {
            $or: [
              { trackingNumber: { $regex: query.trackingNumber, $options: 'i' } },
              { refId: { $regex: query.trackingNumber, $options: 'i' } },
            ],
          }
          : {}),
        ...(query.vehicleTypeId ? { vehicleId: query.vehicleTypeId } : {}),
        ...(user_role === 'customer' && user_id ? { customer: user_id } : {})
      }

      const shipments = (await ShipmentModel.paginate(filterQuery, pagination)) as ShipmentPaginationPayload
      if (!shipments) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipments
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  shipmentQuery({ dateRangeStart, dateRangeEnd, trackingNumber, vehicleTypeId, status, ...query }: GetShipmentArgs, user_role: string | undefined, user_id: string | undefined): FilterQuery<typeof Shipment> {
    // Status
    const statusFilterOr = status === 'all'
      ? ['idle', 'progressing', 'dilivered', 'cancelled', 'refund']
      : status === 'progress'
        ? ['idle', 'progressing']
        : status === 'finish' ? ['dilivered']
          : status === 'refund'
            ? ['refund']
            : []
    // Query
    const filterEmptyQuery = omitBy(query, isEmpty)
    const regex = new RegExp(trackingNumber, 'i')
    const filterQuery: FilterQuery<typeof Shipment> = {
      ...filterEmptyQuery,
      ...(vehicleTypeId ? { vehicleId: vehicleTypeId } : {}),
      ...(dateRangeStart || dateRangeEnd ? {
        createdAt: {
          ...(dateRangeStart ? { $gte: dateRangeStart } : {}),
          ...(dateRangeEnd ? { $lte: dateRangeEnd } : {}),
        }
      } : {}),
      $or: [
        ...(trackingNumber
          ? [
            { trackingNumber: { $regex: regex }, $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [] },
            { refId: { $regex: regex }, $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [] }
          ]
          : (!isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [])
        )
      ],
      ...(user_role === 'customer' && user_id ? { customer: user_id } : {})
    }
    return filterQuery
  }

  @Query(() => [Shipment])
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipments(
    @Ctx() ctx: GraphQLContext,
    @Args() args: GetShipmentArgs,
    @Args() { skip, ...paginateOpt }: LoadmoreArgs,
  ): Promise<Shipment[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      // Pagination
      const reformSorts = reformPaginate(paginateOpt)
      const paginate = { skip, ...reformSorts }

      const filterQuery = this.shipmentQuery(args, user_role, user_id)

      console.log('---shipments---')
      console.log('paginate: ', paginate)
      console.log('filterQuery: ', filterQuery)

      const shipments = ShipmentModel.find(filterQuery, undefined, paginate)
      if (!shipments) {
        const message = `ไม่สามารถเรียกข้อมูลงานขนส่งได้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return shipments
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => Int)
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async totalShipment(@Ctx() ctx: GraphQLContext, @Args() args: GetShipmentArgs): Promise<number> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      // Query
      const filterQuery = this.shipmentQuery(args, user_role, user_id)
      const numberOfShipments = await ShipmentModel.countDocuments(filterQuery)
      return numberOfShipments
    }
    return 0
  }


  @Query(() => [TotalRecordPayload])
  @UseMiddleware(AuthGuard(["customer", "admin", "driver"]))
  async statusCount(@Ctx() ctx: GraphQLContext, @Args() args: GetShipmentArgs): Promise<TotalRecordPayload[]> {
    const user_role = ctx.req.user_role
    const user_id = ctx.req.user_id
    if (user_id) {
      // Query
      const filterQuery = (status: TCriteriaStatus) => this.shipmentQuery({ ...args, status }, user_role, user_id)

      const allCount = await ShipmentModel.countDocuments(filterQuery('all'))
      const progressingCount = await ShipmentModel.countDocuments(filterQuery('progress'))
      const refundCount = await ShipmentModel.countDocuments(filterQuery('refund'))
      const finishCount = await ShipmentModel.countDocuments(filterQuery('finish'))

      return [
        { label: 'ทั้งหมด', key: 'all', count: allCount },
        { label: 'ดำเนินการ', key: 'progress', count: progressingCount },
        { label: 'คืนเงินแล้ว', key: 'refund', count: refundCount },
        { label: 'เสร็จสิ้น', key: 'finish', count: finishCount },
      ]
    }
    return []
  }

  @Mutation(() => Shipment)
  @UseMiddleware(AuthGuard(['customer', 'admin']))
  async createShipment(
    @Arg('data')
    {
      additionalServices,
      additionalImage,
      directionRoutes,
      discountId,
      locations,
      favoriteDriverId,
      paymentMethod,
      paymentDetail,
      cashPaymentDetail,
      ...data
    }: ShipmentInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<Shipment> {
    try {
      const user_id = ctx.req.user_id
      const customer = await UserModel.findById(user_id)
      if (!customer) {
        const message = 'ไม่สามารถหาข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const vehicle = await VehicleTypeModel.findById(data.vehicleId).lean()
      if (!vehicle) {
        const message = 'ไม่สามารถหาข้อมูลประเภทรถ เนื่องจากไม่พบประเภทรถดังกล่าว'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      // favoriteDriverId

      // Duplicate additional service cost for invoice data
      const serviceBulkOperations = await Aigle.map<string, AnyBulkWriteOperation>(
        additionalServices,
        async (serviceCostId) => {
          const serviceCost = await AdditionalServiceCostPricingModel.findById(serviceCostId).lean()
          return {
            insertOne: {
              document: {
                cost: serviceCost.cost,
                price: serviceCost.price,
                reference: serviceCost._id,
              },
            },
          }
        },
      )

      const serviceBulkResult = await ShipmentAdditionalServicePriceModel.bulkWrite(serviceBulkOperations)
      const _additionalServices = values(serviceBulkResult.insertedIds)

      // Remark: Duplicate distance cost for invoice data
      const vehicleCost = await VehicleCostModel.findByVehicleId(data.vehicleId)
      const distanceBulkOperations = map<DistanceCostPricing, AnyBulkWriteOperation>(
        (vehicleCost.distance || []) as DistanceCostPricing[],
        (distanceCost) => {
          return {
            insertOne: {
              document: {
                from: distanceCost.from,
                to: distanceCost.to,
                cost: distanceCost.cost,
                price: distanceCost.price,
                benefits: distanceCost.benefits,
                unit: distanceCost.unit,
              },
            },
          }
        },
      )
      const diatanceBulkResult = await ShipmentDistancePricingModel.bulkWrite(distanceBulkOperations)
      const _distances = values(diatanceBulkResult.insertedIds)

      let _discountId = null
      if (discountId) {
        const privilege = await PrivilegeModel.findById(discountId).lean()
        _discountId = privilege._id
        if (!privilege) {
          const message = 'ไม่สามารถหาข้อมูลส่วนลดได้ เนื่องจากไม่พบส่วนลดดังกล่าว'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
      }

      // Remark: Add multiple additionals image
      const additionalImagesBulkOperations = map<FileInput, AnyBulkWriteOperation>(additionalImage, (image) => {
        return {
          insertOne: {
            document: image,
          },
        }
      })
      const additionalImagesBulkResult = await FileModel.bulkWrite(additionalImagesBulkOperations)
      const _additionalImages = values(additionalImagesBulkResult.insertedIds)

      const _directionResult = new DirectionsResultModel({
        rawData: directionRoutes,
      })
      await _directionResult.save()

      const isCashPaymentMethod = paymentMethod === 'cash'
      const isCreditPaymentMethod = paymentMethod === 'credit'
      // Remark: Cash payment detail
      let cashDetail: CashDetail | null = null
      if (isCashPaymentMethod && cashPaymentDetail) {
        const { imageEvidence, ...cashDetailInput } = cashPaymentDetail
        const _imageEvidence = new FileModel(imageEvidence)
        await _imageEvidence.save()
        cashDetail = {
          ...cashDetailInput,
          imageEvidence: _imageEvidence._id,
        }
      }

      // Remark: Payment
      const droppoint = locations.length - 1
      const _calculation = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: data.estimatedDistance / 1000,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
      })
      const _invoice = await ShipmentModel.calculate({
        vehicleTypeId: data.vehicleId,
        distanceMeter: data.estimatedDistance,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
        serviceIds: additionalServices,
        discountId: discountId,
      })
      const _payment = new PaymentModel({
        cashDetail,
        creditDetail: paymentDetail,
        invoice: _invoice,
        calculation: _calculation,
        paymentMethod,
        status: isCreditPaymentMethod ? 'invoice' : 'waiting_confirm_payment',
      })

      await _payment.save()

      const status: TShipingStatus = 'idle'
      const adminAcceptanceStatus: TAdminAcceptanceStatus = isCreditPaymentMethod ? 'reach' : 'pending'
      const driverAcceptanceStatus: TDriverAcceptanceStatus = isCreditPaymentMethod ? 'pending' : 'idle'
      // Initial status log
      // const text = isCreditPaymentMethod ? favoriteDriverId ? 'รอคนขับคนโปรดรับงาน' : 'รอคนขับรับงาน' : 'รอเจ้าหน้าที่ยืนยันยอดการชำระ'
      // const startStatus: StatusLog = { status: 'pending', text, createdAt: new Date() }

      const _trackingNumber = await generateTrackingNumber('MMTH', 'tracking')
      const shipment = new ShipmentModel({
        ...data,
        isRoundedReturn: data.isRoundedReturn || false,
        trackingNumber: _trackingNumber,
        customer: user_id,
        destinations: locations,
        additionalServices: _additionalServices,
        distances: _distances,
        discountId: _discountId,
        additionalImages: _additionalImages,
        directionId: _directionResult,
        payment: _payment,
        status,
        adminAcceptanceStatus,
        driverAcceptanceStatus,
        // statusLog: [startStatus]
      })
      await shipment.save()

      const response = await ShipmentModel.findById(shipment._id)
      await response.initialStepDefinition()

      // Notification
      const notiTitle = isCashPaymentMethod ? 'การจองของท่านอยู่ระหว่างการยืนยัน' : 'การจองของท่านรอคนขับตอบรับ'
      const notiMsg = isCashPaymentMethod
        ? `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างดำเนินการยืนยันยอดชำระ`
        : `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างการตอบรับจากคนขับ`
      await NotificationModel.sendNotification({
        userId: customer._id,
        varient: 'info',
        title: notiTitle,
        message: [notiMsg],
        infoText: 'ติดตามการขนส่ง',
        infoLink: `/main/tracking?tracking_number=${_trackingNumber}`,
      })

      // Sent email
      // Prepare email sender
      const emailTranspoter = email_sender()
      const tracking_link = `https://www.movematethailand.com/main/tracking?tracking_number=${response.trackingNumber}`
      const movemate_link = `https://www.movematethailand.com`
      // Email sender
      const email =
        customer.userType === 'individual'
          ? get(customer, 'individualDetail.email', '')
          : customer.userType === 'business'
            ? get(customer, 'businessDetail.businessEmail', '')
            : ''
      const fullname =
        customer.userType === 'individual'
          ? get(customer, 'individualDetail.fullname', '')
          : customer.userType === 'business'
            ? get(customer, 'businessDetail.businessName', '')
            : ''

      const originalText = head(response.destinations)?.name || ''
      const destinationsText = reduce(
        tail(response.destinations),
        (prev, curr) => {
          if (curr.name) {
            return prev ? `${prev}, ${curr.name}` : curr.name
          }
          return prev
        },
        '',
      )

      await emailTranspoter.sendMail({
        from: process.env.NOREPLY_EMAIL,
        to: email,
        subject: 'Movemate Thailand ได้รับการจองรถของคุณแล้ว',
        template:
          paymentMethod === 'cash'
            ? 'booking_cash_success'
            : paymentMethod === 'credit'
              ? 'booking_credit_success'
              : '',
        context: {
          fullname,
          tracking_number: response.trackingNumber,
          original: originalText,
          destination: destinationsText,
          payment:
            paymentMethod === 'cash' ? 'ชำระเงินสด (ผ่านการโอน)' : paymentMethod === 'credit' ? 'ออกใบแจ้งหนี้' : '',
          tracking_link,
          movemate_link,
        },
      })

      return response
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}



// DO-NEXT
// 1. Handle get shipment for driver and favorit
// 2. Handle get shipment count of pending status for show counting
// 3. npm install node-cron
// 4. Setup Cron
// 5. Handle Notification logic - every 10min / 50min / 120min / 120min
// 
// Financial for customer
// DO-NEXT
// 1. Get - payment of shipment of user
// 2. Get sum of month

// Workprogress