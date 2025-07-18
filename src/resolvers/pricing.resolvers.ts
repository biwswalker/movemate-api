import { Arg, Resolver, UseMiddleware, Query, Mutation, Ctx, Args } from 'type-graphql'
import { AllowGuard, AuthGuard } from '@guards/auth.guards'
import VehicleTypeModel, { VehicleType } from '@models/vehicleType.model'
import { GraphQLError } from 'graphql'
import VehicleCostModel, { VehicleCost } from '@models/vehicleCost.model'
import {
  AdditionalServiceCostInput,
  DistanceCostPricingInput,
  PricingCalculationMethodArgs,
} from '@inputs/vehicle-cost.input'
import {
  AdditionalServiceCostSchema,
  DistanceCostPricingSchema,
  PricingCalculationMethodSchema,
} from '@validations/vehiclecost.validations'
import AdditionalServiceCostPricingModel, {
  AdditionalServiceCostPricing,
} from '@models/additionalServiceCostPricing.model'
import lodash, { filter, forEach, get, isEmpty, isEqual, map, omit, some, sortBy } from 'lodash'
import Aigle from 'aigle'
import { AnyBulkWriteOperation, ClientSession, Types, startSession, connection } from 'mongoose'
import AdditionalServiceModel from '@models/additionalService.model'
import DistanceCostPricingModel from '@models/distanceCostPricing.model'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { GraphQLContext } from '@configs/graphQL.config'
import UpdateHistoryModel, { UpdateHistory } from '@models/updateHistory.model'
import { DocumentType } from '@typegoose/typegoose'
import { PricingCalculationMethodPayload, VehicleCostCalculationPayload } from '@payloads/pricing.payloads'
import { EUserRole } from '@enums/users'
import { VALUES } from 'constants/values'
import RetryTransactionMiddleware, { WithTransaction } from '@middlewares/RetryTransaction'

Aigle.mixin(lodash, {})

@Resolver()
export default class PricingResolver {
  @Query(() => VehicleCost)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getVehicleCost(@Arg('vehicleTypeId') vehicleTypeId: string): Promise<VehicleCost> {
    try {
      const vehicleCost = await VehicleCostModel.findOne({ vehicleType: vehicleTypeId })

      if (!vehicleCost) {
        const vehicleType = await VehicleTypeModel.findById(vehicleTypeId)
        if (!vehicleType) {
          const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        const vehicleCostTemporary = new VehicleCostModel({
          vehicleType,
          additionalServices: [],
          distance: [],
        })

        return vehicleCostTemporary
      }

      return vehicleCost
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateAdditionalServiceCost(
    @Arg('id') id: string,
    @Arg('data', () => [AdditionalServiceCostInput])
    data: AdditionalServiceCostInput[],
  ): Promise<boolean> {
    try {
      await AdditionalServiceCostSchema.validate({ additionalServices: data })

      const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] = map(data, ({ _id, ...service }) => {
        const _oid = _id === '-' ? new Types.ObjectId() : new Types.ObjectId(_id)
        return {
          updateOne: {
            filter: { _id: _oid },
            update: { $set: { _id: _oid, ...service } },
            upsert: true,
          },
        }
      })
      const serviceIds = map(bulkOps, (opt) => get(opt, 'updateOne.filter._id', ''))

      await AdditionalServiceCostPricingModel.bulkWrite(bulkOps)

      await VehicleCostModel.findByIdAndUpdate(id, {
        additionalServices: serviceIds,
      })

      // TODO: Recheck again
      // await AdditionalServiceCostPricingModel.deleteMany({
      //   _id: { $nin: serviceIds },
      //   vehicleCost: id, // TODO: Recheck again
      // });

      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @WithTransaction()
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async updateDistanceCost(
    @Arg('id') id: string,
    @Arg('data', () => [DistanceCostPricingInput])
    data: DistanceCostPricingInput[],
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const session = ctx.session
    try {
      await DistanceCostPricingSchema.validate({ distanceCostPricings: data })

      const bulkOperations = []
      const updateHistories: DocumentType<UpdateHistory>[] = []

      const _sortedData = sortBy(data, ['from'])
      await Aigle.forEach(_sortedData, async ({ _id, ...distanceConfig }) => {
        let distanceCostPricing = _id
          ? _id !== '-'
            ? await DistanceCostPricingModel.findById(_id).session(session)
            : null
          : null

        const beforeUpdate = distanceCostPricing ? distanceCostPricing.toObject() : {}
        const beforeUpdateOmit = omit(beforeUpdate, ['createdAt', 'updatedAt'])

        if (!distanceCostPricing) {
          distanceCostPricing = new DistanceCostPricingModel()
        }

        Object.assign(distanceCostPricing, distanceConfig)

        const afterUpdateOmit = omit(distanceCostPricing, ['createdAt', 'updatedAt'])

        const hasChanged = JSON.stringify(beforeUpdateOmit) !== JSON.stringify(afterUpdateOmit)

        const userId = ctx.req.user_id
        // const user = await UserModel.findById(userId).session(session);
        let updateHistory = undefined
        if (hasChanged) {
          updateHistory = new UpdateHistoryModel({
            referenceId: distanceCostPricing._id.toString(),
            referenceType: 'DistanceCostPricing',
            who: userId,
            beforeUpdate,
            afterUpdate: afterUpdateOmit.toObject(),
          })

          updateHistories.push(updateHistory)
        }
        bulkOperations.push({
          updateOne: {
            filter: {
              _id: distanceCostPricing._id ? distanceCostPricing._id : new Types.ObjectId(),
            },
            update: {
              $set: distanceConfig,
              ...(updateHistory ? { $push: { history: updateHistory } } : {}),
            },
            upsert: true,
          },
        })
      })

      if (bulkOperations.length > 0) {
        const distanceIds = map(bulkOperations, (opt) => get(opt, 'updateOne.filter._id', ''))
        await DistanceCostPricingModel.bulkWrite(bulkOperations, { session })
        await UpdateHistoryModel.insertMany(updateHistories, { session })
        await VehicleCostModel.findByIdAndUpdate(id, { distance: distanceIds }, { session })
        // await DistanceCostPricingModel.deleteMany({ _id: { $nin: distanceIds } });
      }

      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async initialVehicleCost(
    @Ctx() ctx: GraphQLContext,
    @Arg('vehicleTypeId') vehicleTypeId: string,
    @Arg('withAdditionalService', { nullable: true })
    withAdditionalService: boolean = false,
  ): Promise<string> {
    const session = ctx.session
    try {
      let additionalServicesIds = []
      if (withAdditionalService) {
        const vehicleType = await VehicleTypeModel.findById(vehicleTypeId).session(session)
        const additionalServices = await AdditionalServiceModel.findByVehicleTypeID(vehicleTypeId, session)

        if (isEmpty(additionalServices)) {
          const message = `ไม่พบข้อมูลบริการเสริม กรุณาตรวจสอบหน้าบริการเสริมว่าสามารถเพิ่มรายละเอียดสำหรับรถประเภทนี้ได้`
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }
        const additionalServicesFilter = filter(additionalServices, (service) => {
          if (service.name === VALUES.LARGE_TRUCK) {
            return vehicleType.isLarger
          }
          return true
        })
        const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] = map(
          additionalServicesFilter,
          (service) => {
            const _oid = new Types.ObjectId()
            const type = isEqual(service.name, VALUES.ROUNDED_RETURN) ? 'percent' : 'currency'
            const available = service.permanent
            return {
              updateOne: {
                filter: { _id: _oid },
                update: {
                  $set: {
                    _id: _oid,
                    additionalService: service,
                    available,
                    cost: 0,
                    price: 0,
                    type,
                  },
                },
                upsert: true,
              },
            }
          },
        )
        await AdditionalServiceCostPricingModel.bulkWrite(bulkOps, { session })
        additionalServicesIds = map(bulkOps, (opt) => get(opt, 'updateOne.filter._id', ''))
      }

      const newVehicleCost = new VehicleCostModel({
        vehicleType: vehicleTypeId,
        additionalServices: additionalServicesIds,
        distance: [],
      })
      await newVehicleCost.save({ session })

      return newVehicleCost._id
    } catch (error) {
      console.log('error: ', error)
      const message = get(error, 'message', '')
      throw new GraphQLError(message || 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง')
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async initialAdditionalService(
    @Ctx() ctx: GraphQLContext,
    @Arg('vehicleCostId') vehicleCostId: string,
  ): Promise<boolean> {
    const session = ctx.session
    try {
      const vehicleCost = await VehicleCostModel.findById(vehicleCostId).session(session)
      const vehicleType = get(vehicleCost, 'vehicleType', undefined) as VehicleType | undefined

      let additionalServicesIds = []
      if (vehicleType) {
        const additionalServices = await AdditionalServiceModel.findByVehicleTypeID(vehicleType._id, session)

        if (isEmpty(additionalServices)) {
          const message = `ไม่พบข้อมูลบริการเสริม กรุณาตรวจสอบหน้าบริการเสริมว่าสามารถเพิ่มรายละเอียดสำหรับรถประเภทนี้ได้`
          throw new GraphQLError(message, {
            extensions: { code: 'NOT_FOUND', errors: [{ message }] },
          })
        }

        const additionalServicesFilter = filter(additionalServices, (service) => {
          // Change this additional service included VehicleType descriptions
          if (service.name === VALUES.LARGE_TRUCK) {
            return vehicleType.isLarger
          }
          return true
        })

        const bulkOps: AnyBulkWriteOperation<AdditionalServiceCostPricing>[] = map(
          additionalServicesFilter,
          (service) => {
            const _oid = new Types.ObjectId()
            const type = isEqual(service.name, VALUES.ROUNDED_RETURN) ? 'percent' : 'currency'
            const available = service.permanent
            return {
              updateOne: {
                filter: { _id: _oid },
                update: {
                  $set: {
                    _id: _oid,
                    additionalService: service,
                    available,
                    cost: 0,
                    price: 0,
                    type,
                  },
                },
                upsert: true,
              },
            }
          },
        )

        await AdditionalServiceCostPricingModel.bulkWrite(bulkOps, { session })
        additionalServicesIds = map(bulkOps, (opt) => get(opt, 'updateOne.filter._id', ''))
      }

      await vehicleCost.updateOne({ additionalServices: additionalServicesIds }, { session })

      return true
    } catch (error) {
      console.log('error: ', error)
      const message = get(error, 'message', '')
      throw new GraphQLError(message || 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง')
    }
  }

  @Query(() => VehicleCost)
  @UseMiddleware(AllowGuard)
  async getVehicleCostByVehicleType(@Ctx() ctx: GraphQLContext, @Arg('id') id: string): Promise<VehicleCost> {
    try {
      // To using login user or not
      // ctx.req.user_id
      // const isAuthorized = !isEmpty(ctx.req.user_id);

      const vehicleCost = await VehicleCostModel.findOne({ vehicleType: id })
        .populate({
          path: 'additionalServices',
          match: { available: true },
          populate: {
            path: 'additionalService',
            model: 'AdditionalService',
            populate: {
              path: 'descriptions',
              model: 'AdditionalServiceDescription',
              populate: {
                path: 'vehicleTypes',
                model: 'VehicleType',
                populate: {
                  path: 'image',
                  model: 'File',
                },
              },
            },
          },
        })
        .populate({
          path: 'vehicleType',
          model: 'VehicleType',
          populate: {
            path: 'image',
            model: 'File',
          },
        })
        .populate({
          path: 'distance',
          model: 'DistanceCostPricing',
          populate: {
            path: 'history',
            model: 'UpdateHistory',
            populate: {
              path: 'who',
              model: 'User',
            },
          },
        })
        .lean()

      if (!vehicleCost) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const services = get(vehicleCost, 'additionalServices', [])
      forEach(services, (service) => {
        service.additionalService.descriptions = get(service, 'additionalService.descriptions', [])
          .filter((description) => some(description.vehicleTypes, (type) => type._id.toString() === id))
          .map((description) => {
            description.vehicleTypes = filter(
              get(description, 'vehicleTypes', []),
              (type) => type._id.toString() === id,
            )
            return description
          })
      })

      return vehicleCost
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => [VehicleCost])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getVehicleCosts(): Promise<VehicleCost[]> {
    try {
      const vehicleCosts = await VehicleCostModel.findByAvailableConfig()

      if (!vehicleCosts) {
        const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      return vehicleCosts
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => PricingCalculationMethodPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPricingCalculationMethod(
    @Arg('vehicleCostId') vehicleCostId: string,
    @Args() data: PricingCalculationMethodArgs,
  ): Promise<PricingCalculationMethodPayload> {
    try {
      await PricingCalculationMethodSchema.validate(data)
      const vehicleCost = await VehicleCostModel.calculatePricing(vehicleCostId, data)

      if (!vehicleCost) {
        const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      return vehicleCost
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Query(() => [VehicleCostCalculationPayload])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getPricingCalculationMethodAvailableVehicle(
    @Args() data: PricingCalculationMethodArgs,
  ): Promise<VehicleCostCalculationPayload[]> {
    try {
      const vehicleCosts = await VehicleCostModel.findByAvailableConfig()
      if (data.distance <= 0 || data.distance === undefined || data.dropPoint <= 0 || data.dropPoint === undefined) {
        return vehicleCosts
      }

      if (!vehicleCosts) {
        const message = `ไม่สามารถเรียกข้อมูลต้นทุนขนส่งได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }

      const results = await Aigle.map(vehicleCosts, async (vehicleCost) => {
        const calculated = await VehicleCostModel.calculatePricing(vehicleCost._id, data)
        return Object.assign(vehicleCost, calculated)
      })

      return results
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
}
