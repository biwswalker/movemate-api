import { Arg, Resolver, Mutation, UseMiddleware, Query } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import VehicleTypeModel, { VehicleType } from '@models/vehicleType.model'
import { VehicleTypeInput } from '@inputs/vehicle-type.input'
import { VehicleTypeSchema } from '@validations/vehicletype.validations'
import FileModel from '@models/file.model'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { GraphQLError } from 'graphql'
import { VehicleTypeConfigureStatusPayload } from '@payloads/vehicleType.payloads'
import { GET_VEHICLE_CONFIG } from '@pipelines/vehicletype.pipeline'

@Resolver(VehicleType)
export default class VehicleTypeResolver {
  @Mutation(() => VehicleType)
  @UseMiddleware(AuthGuard(['admin']))
  async addVehicleType(@Arg('data') data: VehicleTypeInput): Promise<VehicleType> {
    const { image, ...values } = data
    try {
      await VehicleTypeSchema().validate(data, { abortEarly: false })

      const imageModel = new FileModel(image)
      await imageModel.save()

      const vehicleTypeModel = new VehicleTypeModel({
        ...values,
        image: imageModel,
      })
      await vehicleTypeModel.save()

      return vehicleTypeModel
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
  @Mutation(() => VehicleType)
  @UseMiddleware(AuthGuard(['admin']))
  async updateVehicleType(@Arg('id') id: string, @Arg('data') data: VehicleTypeInput): Promise<VehicleType> {
    const { image, ...values } = data
    try {
      await VehicleTypeSchema(true).validate(data, { abortEarly: false })

      const imageModel = image ? new FileModel(image) : null
      if (imageModel) {
        await imageModel.save()
      }

      await VehicleTypeModel.findByIdAndUpdate(id, {
        ...values,
        ...(imageModel ? { image: imageModel } : {}),
      })

      const vehicleType = await VehicleTypeModel.findById(id)

      return vehicleType
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }
  @Query(() => [VehicleType])
  @UseMiddleware(AuthGuard(['admin']))
  async getVehicleTypes(): Promise<VehicleType[]> {
    try {
      const vehicleTypes = await VehicleTypeModel.find()
      if (!vehicleTypes) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return vehicleTypes
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => VehicleType)
  @UseMiddleware(AuthGuard(['admin']))
  async getVehicleType(@Arg('name') name: string): Promise<VehicleType> {
    try {
      const vehicleType = await VehicleTypeModel.findOne({ name })
      if (!vehicleType) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return vehicleType
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => VehicleType)
  // @UseMiddleware(AuthGuard(["customer", "driver"]))
  async getVehicleTypeById(@Arg('id') id: string): Promise<VehicleType> {
    try {
      const vehicleType = await VehicleTypeModel.findById(id)
      if (!vehicleType) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return vehicleType
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => [VehicleTypeConfigureStatusPayload])
  async getVehicleTypeAvailable(): Promise<VehicleTypeConfigureStatusPayload[]> {
    try {
      const vehicleTypes = await VehicleTypeModel.aggregate([
        ...GET_VEHICLE_CONFIG,
        { $match: { isPublic: true } },
        // { $match: { isConfigured: true, isPublic: true } },
        // { $project: { isAdditionalServicesConfigured: 0, isDistancesConfigured: 0, isConfigured: 0 } },
      ])
      if (!vehicleTypes) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      console.log('vehicleTypes-==', vehicleTypes)
      return vehicleTypes
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }
  @Query(() => [VehicleTypeConfigureStatusPayload])
  @UseMiddleware(AuthGuard(['admin']))
  async getVehicleTypeConfigs(): Promise<VehicleTypeConfigureStatusPayload[]> {
    try {
      const vehicleTypes = await VehicleTypeModel.aggregate(GET_VEHICLE_CONFIG)
      if (!vehicleTypes) {
        const message = `ไม่สามารถเรียกข้อมูลประเภทรถได้`
        throw new GraphQLError(message, {
          extensions: { code: 'NOT_FOUND', errors: [{ message }] },
        })
      }
      return vehicleTypes
    } catch (error) {
      console.log('error: ', error)
      throw new GraphQLError('ไม่สามารถเรียกข้อมูลประเภทรถได้ โปรดลองอีกครั้ง')
    }
  }
}
