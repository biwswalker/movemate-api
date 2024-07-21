import { GraphQLContext } from '@configs/graphQL.config'
import { AuthGuard } from '@guards/auth.guards'
import { ShipmentInput } from '@inputs/shipment.input'
import PaymentModel, { CashDetail } from '@models/payment.model'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import ShipmentAdditionalServicePriceModel from '@models/shipmentAdditionalServicePrice.model'
import UserModel from '@models/user.model'
import { generateTrackingNumber } from '@utils/string.utils'
import Aigle from 'aigle'
import { GraphQLError } from 'graphql'
import { AnyBulkWriteOperation } from 'mongoose'
import { Arg, Ctx, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import lodash, { get, head, map, reduce, tail, values } from 'lodash'
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

Aigle.mixin(lodash, {})

@Resolver(Shipment)
export default class ShipmentResolver {
  @Query(() => Shipment)
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipment(@Arg('id') id: string): Promise<Shipment> {
    try {
      const shipment = await ShipmentModel.findById(id)
      return shipment
    } catch (error) {
      console.log(error)
      throw new Error('Failed to get shipment')
    }
  }

  @Query(() => [Shipment])
  @UseMiddleware(AuthGuard(['customer', 'admin', 'driver']))
  async shipments(): Promise<Shipment[]> {
    try {
      const shipment = await ShipmentModel.find()
      return shipment
    } catch (error) {
      console.log(error)
      throw new Error('Failed to get shipments')
    }
  }

  @Query(() => [Shipment])
  async customerShipments(@Arg('customerId') customerId: string): Promise<Shipment[]> {
    try {
      const shipments = await ShipmentModel.find({ customer: customerId })
      return shipments
    } catch (error) {
      console.error('Error fetching shipments:', error)
      return []
    }
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
      const additionalImagesBulkResult = await ShipmentDistancePricingModel.bulkWrite(additionalImagesBulkOperations)
      const _additionalImages = values(additionalImagesBulkResult.insertedIds)

      const _directionResult = new DirectionsResultModel({
        rawData: directionRoutes,
      })
      await _directionResult.save()

      // Remark: Cash payment detail
      let cashDetail: CashDetail | null = null
      if (paymentMethod === 'cash' && cashPaymentDetail) {
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
      const pricingDetail = await VehicleCostModel.calculatePricing(vehicleCost._id, {
        distance: data.estimatedDistance,
        dropPoint: droppoint,
        isRounded: data.isRoundedReturn,
      })
      const _payment = new PaymentModel({
        cashDetail,
        invoiceDetail: paymentDetail,
        detail: pricingDetail,
        paymentMethod,
        status:
          paymentMethod === 'cash' ? 'WAITING_CONFIRM_PAYMENT' : paymentMethod === 'credit' ? 'INVOICE' : 'CANCELLED',
      })
      await _payment.save()

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
      })
      await shipment.save()

      const response = await ShipmentModel.findById(shipment._id)

      // Notification
      await NotificationModel.sendNotification({
        userId: customer._id,
        varient: 'info',
        title: 'การจองของท่านอยู่ระหว่างการยืนยัน',
        message: [`หมายเลขการจองขนส่ง ${_trackingNumber} เราได้รับการจองรถของท่านเรียบร้อยแล้ว ขณะนี้การจองของท่านอยู่ระหว่างดำเนินการยืนยันยอดชำระ`],
        infoText: 'ติดตามการขนส่ง',
        infoLink: `/main/tracking/${_trackingNumber}`,
      })

      // Sent email
      // Prepare email sender
      const emailTranspoter = email_sender()
      const tracking_link = `https://www.movematethailand.com/main/tracking/${response.trackingNumber}`
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
          if (curr.name) { return prev ? `${prev}, ${curr.name}` : curr.name }
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
            paymentMethod === 'cash'
              ? 'ชำระเงินสด (ผ่านการโอน)'
              : paymentMethod === 'credit'
                ? 'ออกใบแจ้งหนี้'
                : '',
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
