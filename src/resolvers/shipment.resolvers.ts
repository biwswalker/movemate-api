import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { GetShipmentArgs, ShipmentInput } from '@inputs/shipment.input'
import PaymentModel, { CashDetail, EPaymentMethod } from '@models/payment.model'
import ShipmentModel, { EDriverAcceptanceStatus, EShipingStatus, Shipment } from '@models/shipment.model'
import ShipmentAdditionalServicePriceModel from '@models/shipmentAdditionalServicePrice.model'
import UserModel, { EUserRole, User } from '@models/user.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation, FilterQuery, PaginateOptions, Types } from 'mongoose'
import { Arg, Args, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { filter, get, head, isEmpty, map, omitBy, reduce, sum, tail, toNumber, values } from 'lodash'
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
import NotificationModel, { ENotificationVarient } from '@models/notification.model'
import { ShipmentPaginationAggregatePayload, ShipmentPaginationPayload, TotalRecordPayload } from '@payloads/shipment.payloads'
import { LoadmoreArgs, PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { SHIPMENT_LIST } from '@pipelines/shipment.pipeline'
import { format, parse } from 'date-fns'
import { th } from 'date-fns/locale'
import BillingCycleModel, { EBillingStatus } from '@models/billingCycle.model'
import { clearLimiter, ELimiterType } from '@configs/rateLimit'
import BusinessCustomerCreditPaymentModel from '@models/customerBusinessCreditPayment.model'
import { REPONSE_NAME } from 'constants/status'
import { generateInvoice } from 'reports/invoice'
import { cancelShipmentQueue, FCMShipmentPayload, monitorShipmentQueue, ShipmentPayload } from '@configs/jobQueue'
import { Job } from 'bull'
import { Message } from 'firebase-admin/messaging'

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

  shipmentQuery({ dateRangeStart, dateRangeEnd, trackingNumber, vehicleTypeId, status, startWorkingDate, endWorkingDate }: GetShipmentArgs, user_role: string | undefined, user_id: string | undefined): FilterQuery<typeof Shipment> {
    // Status
    const statusFilterOr = status === 'all'
      ? ['idle', 'progressing', 'dilivered', 'cancelled', 'refund']
      : status === 'progress'
        ? ['idle', 'progressing']
        : status === 'finish' ? ['dilivered']
          : status === 'refund'
            ? ['refund']
            : []


    // Create at
    const startOfCreated = dateRangeStart ? new Date(new Date(dateRangeStart).setHours(0, 0, 0, 0)) : null;
    const endOfCreated = dateRangeEnd ? new Date(new Date(dateRangeEnd).setHours(23, 59, 59, 999)) : null;
    // Working
    const startOfWorking = startWorkingDate ? new Date(new Date(startWorkingDate).setHours(0, 0, 0, 0)) : null;
    const endOfWorking = endWorkingDate ? new Date(new Date(endWorkingDate).setHours(23, 59, 59, 999)) : null;

    // Query
    const regex = new RegExp(trackingNumber, 'i')
    const orQuery = [
      ...(trackingNumber
        ? [
          { trackingNumber: { $regex: regex }, $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [] },
          { refId: { $regex: regex }, $or: !isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [] }
        ]
        : (!isEmpty(statusFilterOr) ? [{ status: { $in: statusFilterOr } }] : [])
      )
    ]
    const filterQuery: FilterQuery<typeof Shipment> = {
      ...(vehicleTypeId ? { vehicleId: vehicleTypeId } : {}),
      ...(startOfCreated || endOfCreated ? {
        createdAt: {
          ...(startOfCreated ? { $gte: startOfCreated } : {}),
          ...(endOfCreated ? { $lte: endOfCreated } : {}),
        }
      } : {}),
      ...(startOfWorking && endOfWorking ? {
        bookingDateTime: {
          ...(startOfWorking ? { $gte: startOfWorking } : {}),
          ...(endOfWorking ? { $lte: endOfWorking } : {}),
        }
      } : {}),
      ...(!isEmpty(orQuery) ? { $or: orQuery } : {}),
      ...(user_role === 'customer' && user_id ? { customer: user_id } : {})
    }
    return filterQuery
  }


  @Query(() => ShipmentPaginationPayload)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipmentList(
    @Ctx() ctx: GraphQLContext,
    @Args() { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<ShipmentPaginationPayload> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const reformSorts: PaginateOptions = reformPaginate(paginate)
      const filterQuery = omitBy(query, isEmpty)
      console.log('raw: ', JSON.stringify(SHIPMENT_LIST({ startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery }, user_role, user_id)))
      const aggregate = ShipmentModel.aggregate(SHIPMENT_LIST({ startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery }, user_role, user_id))
      const shipments = (await ShipmentModel.aggregatePaginate(aggregate, reformSorts)) as ShipmentPaginationAggregatePayload
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

  @Query(() => [String])
  @UseMiddleware(AuthGuard(["admin"]))
  async allshipmentIds(
    @Ctx() ctx: GraphQLContext,
    @Args() { startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...query }: GetShipmentArgs): Promise<string[]> {
    const user_id = ctx.req.user_id
    const user_role = ctx.req.user_role
    try {
      const filterQuery = omitBy(query, isEmpty)
      console.log('raw: ', JSON.stringify(SHIPMENT_LIST({ startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery }, user_role, user_id)))
      const shipments = await ShipmentModel.aggregate(SHIPMENT_LIST({ startWorkingDate, endWorkingDate, dateRangeStart, dateRangeEnd, ...filterQuery }, user_role, user_id))
      const ids = map(shipments, ({ _id }) => _id)
      console.log('users: ', shipments, ids)

      return ids;
    } catch (error) {
      console.log(error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง");
    }
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
      if (user_role === 'admin') {
        const all = await ShipmentModel.countDocuments()
        const idle = await ShipmentModel.countDocuments({ status: 'idle' })
        const progressing = await ShipmentModel.countDocuments({ status: 'progressing' })
        const dilivered = await ShipmentModel.countDocuments({ status: 'dilivered' })
        const cancelled = await ShipmentModel.countDocuments({ status: 'cancelled' })
        const refund = await ShipmentModel.countDocuments({ status: 'refund' })
        const expire = await ShipmentModel.countDocuments({ status: 'expire' })

        return [
          { label: 'ทั้งหมด', key: 'all', count: all },
          { label: 'รอตรวจสอบการชำระ/รอคนขับตอบรับ', key: 'idle', count: idle },
          { label: 'กำลังดำเนินการขนส่ง', key: 'progressing', count: progressing },
          { label: 'เสร็จสิ้น', key: 'dilivered', count: dilivered },
          { label: 'ยกเลิก', key: 'cancelled', count: cancelled },
          { label: 'คืนเงิน', key: 'refund', count: refund },
          { label: 'หมดอายุ', key: 'expire', count: expire },
        ];
      } else {
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

      const creditPaymentId = get(customer, 'businessDetail.creditPayment._id', '')
      const creditPayment = creditPaymentId ? await BusinessCustomerCreditPaymentModel.findById(creditPaymentId) : null

      const vehicle = await VehicleTypeModel.findById(data.vehicleId).lean()
      if (!vehicle) {
        const message = 'ไม่สามารถหาข้อมูลประเภทรถ เนื่องจากไม่พบประเภทรถดังกล่าว'
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const isCashPaymentMethod = paymentMethod === 'cash'
      const isCreditPaymentMethod = paymentMethod === 'credit'

      // Make calculate pricing and for check credit usage
      const droppoint = locations.length - 1
      const _invoice = await ShipmentModel.calculate({
        vehicleTypeId: data.vehicleId,
        distanceMeter: data.distance,
        distanceReturnMeter: data.returnDistance,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
        serviceIds: additionalServices,
        discountId: discountId,
        isBusinessCashPayment: customer.userType === 'business' && isCashPaymentMethod
      }, true)

      // 
      const newCreditBalance = sum([creditPayment.creditUsage, _invoice.totalPrice])
      if (isCreditPaymentMethod) {
        if (newCreditBalance > creditPayment.creditLimit) {
          const message = `วงเงินของคุณไม่พอ กรุณาติดต่อเจ้าหน้าที่`
          throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.INSUFFICIENT_FUNDS, errors: [{ message }] },
          })
        }
      }

      // Prepare email
      const emailTranspoter = email_sender()

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
        const privilege = await PrivilegeModel.findOne({ _id: discountId, usedUser: { $nin: user_id } }).lean()
        if (!privilege) {
          const message = 'ไม่สามารถหาข้อมูลส่วนลดได้ เนื่องจากไม่พบส่วนลดดังกล่าว'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        await PrivilegeModel.findByIdAndUpdate(privilege._id, { $push: { usedUser: user_id } })
        _discountId = privilege._id
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

      // Payment
      const _calculation = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: data.distance / 1000,
        returnedDistance: data.returnDistance / 1000,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
      })
      const _paymentNumber = await generateTrackingNumber(isCreditPaymentMethod ? 'MMPAYCE' : 'MMPAYCA', 'payment')
      const _payment = new PaymentModel({
        cashDetail,
        paymentNumber: _paymentNumber,
        creditDetail: paymentDetail,
        invoice: _invoice,
        calculation: _calculation,
        paymentMethod,
        status: isCreditPaymentMethod ? 'invoice' : 'waiting_confirm_payment',
      })

      await _payment.save()

      // Create shipment id before
      const shipmentId = new Types.ObjectId()

      const status: TShipingStatus = 'idle'
      const adminAcceptanceStatus: TAdminAcceptanceStatus = isCreditPaymentMethod ? 'reach' : 'pending'
      const driverAcceptanceStatus: TDriverAcceptanceStatus = isCreditPaymentMethod ? 'pending' : 'idle'
      // Initial status log
      // const text = isCreditPaymentMethod ? favoriteDriverId ? 'รอคนขับคนโปรดรับงาน' : 'รอคนขับรับงาน' : 'รอเจ้าหน้าที่ยืนยันยอดการชำระ'
      // const startStatus: StatusLog = { status: 'pending', text, createdAt: new Date() }

      const _trackingNumber = await generateTrackingNumber('MMTH', 'tracking')
      const shipment = new ShipmentModel({
        ...data,
        _id: shipmentId,
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

      // Remark: Create billing cycle and billing payment
      if (isCashPaymentMethod && cashDetail) {
        const today = new Date()
        const _monthyear = format(today, 'yyMM')
        const _billingNumber = await generateTrackingNumber(`IV${_monthyear}`, 'invoice')

        const paydate = format(cashDetail.paymentDate, 'ddMMyyyy')
        const paytime = format(cashDetail.paymentTime, 'HH:mm')
        const paymentDate = parse(`${paydate}-${paytime}`, 'ddMMyyyy-HH:mm', new Date(), { locale: th })
        const taxAmount = reduce(_invoice.taxs, (prev, curr) => {
          return sum([prev, curr.price])
        }, 0)
        const _billingCycle = new BillingCycleModel({
          user: user_id,
          billingNumber: _billingNumber,
          issueDate: today,
          billingStartDate: today,
          billingEndDate: today,
          shipments: [shipment._id],
          subTotalAmount: _invoice.subTotalPrice,
          taxAmount,
          totalAmount: _invoice.totalPrice,
          paymentDueDate: today,
          billingStatus: EBillingStatus.VERIFY,
          paymentMethod: EPaymentMethod.CASH,
          // emailSendedTime: today
        })

        await _billingCycle.save()
        await BillingCycleModel.processPayment({
          billingCycleId: _billingCycle._id,
          paymentNumber: _payment.paymentNumber,
          paymentAmount: _invoice.totalPrice,
          paymentDate,
          imageEvidenceId: cashDetail.imageEvidence as string,
          bank: cashDetail.bank,
          bankName: cashDetail.bankName,
          bankNumber: cashDetail.bankNumber,
          userId: user_id,
        })

        const billingCycleData = await BillingCycleModel.findById(_billingCycle._id)
        await generateInvoice(billingCycleData)

      } else if (isCreditPaymentMethod) {
        if (!creditPayment) {
          await ShipmentModel.findByIdAndDelete(shipment._id)
          const message = 'ไม่สามารถจองรถขนส่งได้ เนื่องจากไม่พบการข้อมูลการออกใบแจ้งหนี้'
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        // Update balance
        await creditPayment.updateOne({ creditUsage: newCreditBalance })
      }

      const response = await ShipmentModel.findById(shipment._id)
      await response.initialStepDefinition()

      // Clear redis seach limiter
      await clearLimiter(ctx.ip, ELimiterType.LOCATION, user_id || '')

      // Notification
      const notiTitle = isCashPaymentMethod ? 'การจองของท่านอยู่ระหว่างการยืนยัน' : 'การจองของท่านรอคนขับตอบรับ'
      const notiMsg = isCashPaymentMethod
        ? `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างดำเนินการยืนยันยอดชำระ`
        : `หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างการตอบรับจากคนขับ`
      await NotificationModel.sendNotification({
        userId: customer._id,
        varient: ENotificationVarient.INFO,
        title: notiTitle,
        message: [notiMsg],
        infoText: 'ติดตามการขนส่ง',
        infoLink: `/main/tracking?tracking_number=${_trackingNumber}`,
      })

      // Sent email
      // Prepare email sender
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

  async monitorShipmentStatus(shipmentId: string, requestDriverId: string) {
    const tenMin = 10 * 60 * 1000
    const oneThousanAndTwentyMin = 120 * 60 * 1000
    const twoThousanAndFourtyMin = 240 * 60 * 1000
    if (requestDriverId) {
      // // เพิ่ม job สำหรับตรวจสอบ shipment ทุกๆ 10 นาที
      monitorShipmentQueue.add({ shipmentId, driverId: requestDriverId }, { repeat: { every: tenMin } });  // ทำซ้ำทุกๆ 10 นาที
      monitorShipmentQueue.add({ shipmentId }, { delay: oneThousanAndTwentyMin + tenMin, repeat: { every: tenMin } }); // ทำซ้ำทุกๆ 10 นาที
      // // เพิ่ม job สำหรับยกเลิก shipment หลังจาก 240 นาที
      cancelShipmentQueue.add({ shipmentId: shipmentId }, { delay: twoThousanAndFourtyMin + tenMin });
    } else {
      // // เพิ่ม job สำหรับตรวจสอบ shipment ทุกๆ 10 นาที
      monitorShipmentQueue.add({ shipmentId }, { repeat: { every: tenMin } }); // ทำซ้ำทุกๆ 10 นาที
      // // เพิ่ม job สำหรับยกเลิก shipment หลังจาก 240 นาที
      cancelShipmentQueue.add({ shipmentId: shipmentId }, { delay: oneThousanAndTwentyMin + tenMin });
    }
  }
}

export const checkShipmentStatus = async (shipmentId: string, requestDriverId: string) => {
  const oneThousanAndTwentyMin = 120 * 60 * 1000
  const twoThousanAndFourtyMin = 240 * 60 * 1000
  const shipment = await ShipmentModel.findById(shipmentId);

  if (shipment.driverAcceptanceStatus === EDriverAcceptanceStatus.PENDING) {
    const currentTime = new Date().getTime();
    const createdTime = new Date(shipment.createdAt).getTime();

    // ถ้าผ่านไป 120 นาทีแล้วยังไม่มี driver รับงาน
    if ((currentTime - createdTime) >= oneThousanAndTwentyMin) {
      const paymentMethod = get(shipment, 'payment.paymentMethod', '')
      // TODO: Make refund
      await shipment.updateOne({
        status: paymentMethod === EPaymentMethod.CREDIT ? EShipingStatus.CANCELLED : EShipingStatus.REFUND,
        driverAcceptanceStatus: EDriverAcceptanceStatus.UNINTERESTED,
        rejectedReason: 'uninterested_driver',
        rejectedDetail: 'ไม่มีคนขับตอบรับงานนี้',
      });
      // TODO: Handle refund
      console.log(`'Shipment' ${shipmentId} is cancelled.`);
    } else {
      // ส่ง FCM Notification
      if (requestDriverId) {
        const driver = await UserModel.findOne({ _id: shipment.requestedDriver, userRole: EUserRole.DRIVER });
        if (driver && driver.fcmToken) {
          await NotificationModel.sendFCMNotification({
            token: driver.fcmToken,
            condition: '',
            topic: '',
            data: {
              navigationId: 'home',
              trackingNumber: shipment.trackingNumber
            },
            notification: {
              title: 'MovemateTH',
              body: '📦 มีงานขนส่งใหม่สำหรับคุณ',
            }
          });
        }

      } else {
        const drivers = await UserModel.find({ userRole: EUserRole.DRIVER });
        const messages = map<User, Message>(filter(drivers, ({ fcmToken }) => !isEmpty(fcmToken)), (driver) => {
          if (driver.fcmToken) {
            return {
              token: driver.fcmToken,
              topic: '',
              data: {
                navigationId: 'home',
                trackingNumber: shipment.trackingNumber
              },
              notification: {
                title: 'MovemateTH',
                body: '📦 มีงานขนส่งใหม่สำหรับคุณ',
              }
            }
          }
          return
        })
        await NotificationModel.sendFCMNotification(messages);
      }
    }
  }
};


// ประมวลผล job monitorShipment แบบ Type-safe
monitorShipmentQueue.process(async (job: Job<FCMShipmentPayload>) => {
  const { shipmentId, driverId } = job.data;
  // await checkShipmentStatus(shipmentId, notifyAllDrivers);
});

// ประมวลผล job cancelShipment แบบ Type-safe
cancelShipmentQueue.process(async (job: Job<ShipmentPayload>) => {
  const { shipmentId } = job.data;
  // await cancelShipmentIfIdle(shipmentId);
});