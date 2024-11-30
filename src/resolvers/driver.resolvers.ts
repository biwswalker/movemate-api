import { Resolver, Mutation, Arg, Ctx, UseMiddleware, Query } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import bcrypt from 'bcrypt'
import { GraphQLContext } from '@configs/graphQL.config'
import { get, includes, isEmpty } from 'lodash'
import { generateId, generateRef } from '@utils/string.utils'
import FileModel from '@models/file.model'
import { decryption } from '@utils/encryption'
import {
  DriverDetailInput,
  DriverRegisterInput,
  DriverReRegisterInput,
  EmployeeDetailInput,
  EmployeeRegisterInput,
} from '@inputs/driver.input'
import { BusinessDriverScema, EmployeeDriverScema, IndividualDriverScema } from '@validations/driver.validations'
import { verifyOTP } from './otp.resolvers'
import DriverDetailModel, { DriverDetail } from '@models/driverDetail.model'
import DriverDocumentModel from '@models/driverDocument.model'
import NotificationModel, {
  ENavigationType,
  ENotificationVarient,
  NOTIFICATION_TITLE,
} from '@models/notification.model'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { DriverVerifiedPayload, EmployeeDetailPayload, RegisterPayload } from '@payloads/driver.payloads'
import { GraphQLError } from 'graphql'
import { EDriverStatus, EDriverType, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel from '@models/shipment.model'
import { REPONSE_NAME } from 'constants/status'
import { addSeconds } from 'date-fns'
import { Types } from 'mongoose'

@Resolver(User)
export default class DriverResolver {
  @Mutation(() => DriverVerifiedPayload)
  async verifyDriverData(
    @Arg('data') data: DriverDetailInput,
    @Arg('driverId', { nullable: true }) driverId: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<DriverVerifiedPayload> {
    try {
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }
      if (data.driverType === EDriverType.BUSINESS) {
        await BusinessDriverScema(driverId).validate(data, { abortEarly: false })
      } else if (data.driverType === EDriverType.INDIVIDUAL_DRIVER) {
        await IndividualDriverScema(driverId).validate(data, { abortEarly: false })
      } else {
        throw new GraphQLError('ไม่รองรับประเภทคนขับรถนี้')
      }
      return data
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async addExitingEmployee(@Arg('driverId') driverId: string, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const agent = await UserModel.findById(userId)
      const driver = await UserModel.findById(driverId)
      if (!driver) {
        const message = 'ไม่พบคนขับ'
        throw new GraphQLError(message)
      }
      const existingParent = await UserModel.findOne({
        _id: driverId,
        $or: [{ parents: { $in: [userId] } }, { requestedParents: { $in: [userId] } }],
      })
      if (existingParent) {
        const message = 'ท่านได้เพิ่มคนขับคนนี้ไปแล้ว'
        throw new GraphQLError(message)
      }

      await UserModel.findByIdAndUpdate(driver._id, { $push: { requestedParents: userId } })

      /**
       * Notification
       */
      const title = 'คำขอร่วมงานเป็นคนขับของนายหน้า'
      const message = `${agent.fullname} เพิ่มชื่อของคุณเข้าในรายชื่อคนขับของภายใต้บริษัท`
      await NotificationModel.sendNotification({
        userId: driverId,
        varient: ENotificationVarient.INFO,
        title: title,
        message: [message],
      })
      if (driver.fcmToken) {
        const token = decryption(driver.fcmToken)
        await NotificationModel.sendFCMNotification({
          token,
          data: { navigation: ENavigationType.INDEX },
          notification: { title: NOTIFICATION_TITLE, body: `${title}จาก ${driver.fullname}` },
        })
      }

      return true
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async acceptationEmployee(
    @Arg('result') result: 'accept' | 'reject',
    @Arg('agentId') agentId: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const driver = await UserModel.findById(userId)
      const agent = await UserModel.findById(agentId)
      if (!agent) {
        const message = 'ไม่พบคนขับ'
        throw new GraphQLError(message)
      }

      const existingParent = await UserModel.findOne({ _id: userId, parents: { $in: [agentId] } })
      if (existingParent) {
        const message = `คุณเป็นคนขับของ ${agent.fullname} อยู่แล้ว`
        throw new GraphQLError(message)
      }

      if (result === 'accept') {
        await driver.updateOne({ $pull: { requestedParents: agentId }, $push: { parents: agentId } })
      } else if (result === 'reject') {
        await driver.updateOne({ $pull: { requestedParents: agentId } })
      } else {
        const message = 'ไม่มีสถานะการยืนยันนี้'
        throw new GraphQLError(message)
      }

      /**
       * Notification to Agent
       */
      const title = result === 'accept' ? 'คนขับตอบรับเป็นคนขับภายได้สังกัด' : 'คนขับปฏิเสธเป็นคนขับภายได้สังกัด'
      const message =
        result === 'accept'
          ? `${driver.fullname} ได้ตอบรับการเป็นคนขับภายใต้สังกัดบริษัทของคุณแล้ว`
          : `${driver.fullname} ปฏิเสธการเป็นคนขับภายใต้สังกัดบริษัทของคุณ`
      await NotificationModel.sendNotification({
        userId: agentId,
        varient: result === 'accept' ? ENotificationVarient.MASTER : ENotificationVarient.WRANING,
        title: title,
        message: [message],
      })
      if (agent.fcmToken) {
        const token = decryption(agent.fcmToken)
        await NotificationModel.sendFCMNotification({
          token,
          data: { navigation: ENavigationType.EMPLOYEE, driverId: result === 'accept' ? driver._id : '' },
          notification: { title: NOTIFICATION_TITLE, body: title },
        })
      }

      return result === 'accept'
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getEmployeeRequest(@Ctx() ctx: GraphQLContext): Promise<User> {
    try {
      const userId = ctx.req.user_id
      const driver = await UserModel.findById(userId).lean()
      if (!driver) {
        const message = 'ไม่พบข้อมูลของท่าน'
        throw new GraphQLError(message, {
          extensions: {
            code: 'NOT_FOUND',
            errors: [{ message }],
          },
        })
      }

      const agentId = get(driver, 'requestedParents.0', '')
      if (agentId) {
        const agent = await UserModel.findById(agentId)
        return agent
      }

      return null
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => RegisterPayload)
  async driverRegister(@Arg('data') data: DriverRegisterInput, @Ctx() ctx: GraphQLContext): Promise<RegisterPayload> {
    const { detail, documents, otp } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      if (detail.driverType === EDriverType.BUSINESS) {
        await BusinessDriverScema().validate(detail, { abortEarly: false })
      } else if (detail.driverType === EDriverType.INDIVIDUAL_DRIVER) {
        await IndividualDriverScema().validate(detail, { abortEarly: false })
      } else {
        throw new GraphQLError('ไม่รองรับประเภทคนขับรถนี้')
      }

      // 1. OTP Driver checker
      await verifyOTP(otp.phoneNumber, otp.otp, otp.ref)

      // 2. Document
      const frontOfVehicle = documents.frontOfVehicle ? new FileModel({ ...documents.frontOfVehicle }) : null
      const backOfVehicle = documents.backOfVehicle ? new FileModel({ ...documents.backOfVehicle }) : null
      const leftOfVehicle = documents.leftOfVehicle ? new FileModel({ ...documents.leftOfVehicle }) : null
      const rigthOfVehicle = documents.rigthOfVehicle ? new FileModel({ ...documents.rigthOfVehicle }) : null
      const copyVehicleRegistration = documents.copyVehicleRegistration
        ? new FileModel({ ...documents.copyVehicleRegistration })
        : null
      const copyIDCard = documents.copyIDCard ? new FileModel({ ...documents.copyIDCard }) : null
      const copyDrivingLicense = documents.copyDrivingLicense
        ? new FileModel({ ...documents.copyDrivingLicense })
        : null
      const copyBookBank = documents.copyBookBank ? new FileModel({ ...documents.copyBookBank }) : null
      const copyHouseRegistration = documents.copyHouseRegistration
        ? new FileModel({ ...documents.copyHouseRegistration })
        : null
      const insurancePolicy = documents.insurancePolicy ? new FileModel({ ...documents.insurancePolicy }) : null
      const criminalRecordCheckCert = documents.criminalRecordCheckCert
        ? new FileModel({ ...documents.criminalRecordCheckCert })
        : null
      const businessRegistrationCertificate = documents.businessRegistrationCertificate
        ? new FileModel({ ...documents.businessRegistrationCertificate })
        : null
      const certificateValueAddedTaxRegistration = documents.certificateValueAddedTaxRegistration
        ? new FileModel({ ...documents.certificateValueAddedTaxRegistration })
        : null
      frontOfVehicle && (await frontOfVehicle.save())
      backOfVehicle && (await backOfVehicle.save())
      leftOfVehicle && (await leftOfVehicle.save())
      rigthOfVehicle && (await rigthOfVehicle.save())
      copyVehicleRegistration && (await copyVehicleRegistration.save())
      copyIDCard && (await copyIDCard.save())
      copyDrivingLicense && (await copyDrivingLicense.save())
      copyBookBank && (await copyBookBank.save())
      copyHouseRegistration && (await copyHouseRegistration.save())
      insurancePolicy && (await insurancePolicy.save())
      criminalRecordCheckCert && (await criminalRecordCheckCert.save())
      businessRegistrationCertificate && (await businessRegistrationCertificate.save())
      certificateValueAddedTaxRegistration && (await certificateValueAddedTaxRegistration.save())
      const driverDocument = new DriverDocumentModel({
        frontOfVehicle,
        backOfVehicle,
        leftOfVehicle,
        rigthOfVehicle,
        copyVehicleRegistration,
        copyIDCard,
        copyDrivingLicense,
        copyBookBank,
        copyHouseRegistration,
        insurancePolicy,
        criminalRecordCheckCert,
        businessRegistrationCertificate,
        certificateValueAddedTaxRegistration,
      })
      await driverDocument.save()

      // 3. Detail
      const driverDetailModel = new DriverDetailModel({
        driverType: [detail.driverType],
        title: detail.title,
        otherTitle: detail.otherTitle,
        firstname: detail.firstname,
        lastname: detail.lastname,
        businessName: detail.businessName,
        businessBranch: detail.businessBranch,
        taxNumber: detail.taxNumber,
        phoneNumber: detail.phoneNumber,
        lineId: detail.lineId,
        address: detail.address,
        province: detail.province,
        district: detail.district,
        subDistrict: detail.subDistrict,
        postcode: detail.postcode,
        bank: detail.bank,
        bankBranch: detail.bankBranch,
        bankName: detail.bankName,
        bankNumber: detail.bankNumber,
        serviceVehicleTypes: detail.serviceVehicleTypes,
        documents: driverDocument,
      })
      await driverDetailModel.save()

      // 4. User
      const password_decryption = decryption(detail.password)
      const hashedPassword = await bcrypt.hash(password_decryption, 10)
      const userNumber = await generateId(detail.driverType === EDriverType.BUSINESS ? 'MMDB' : 'MMDI', 'driver')

      const currentDate = new Date()
      const user = new UserModel({
        userNumber: userNumber,
        userRole: EUserRole.DRIVER,
        userType: detail.driverType === EDriverType.BUSINESS ? EUserType.BUSINESS : EUserType.INDIVIDUAL,
        username: detail.phoneNumber,
        password: hashedPassword,
        status: EUserStatus.PENDING,
        validationStatus: EUserValidationStatus.PENDING,
        registration: platform,
        lastestOTP: otp.otp,
        lastestOTPRef: otp.ref,
        isVerifiedEmail: true, // Set true becuase Driver no email property
        isVerifiedPhoneNumber: true,
        acceptPolicyVersion: detail.policyVersion,
        acceptPolicyTime: currentDate.toISOString(),
        driverDetail: driverDetailModel,
        isChangePasswordRequire: false,
        drivingStatus: EDriverStatus.IDLE,
      })
      await user.save()

      // Notification
      await NotificationModel.sendNotification({
        userId: user._id,
        varient: ENotificationVarient.MASTER,
        title: 'ยินดีต้อนรับเข้าสู่คนขับ Movemate',
        message: [
          `ยินดีต้อนรับ คุณ ${driverDetailModel.fullname} เข้าสู่ทีมขับรถของเรา โปรดรอเจ้าหน้าที่ตรวจสอบบัญชีของท่าน`,
        ],
      })

      return {
        phoneNumber: detail.phoneNumber,
        driverType: detail.driverType,
      }
    } catch (error) {
      console.log('error: ', JSON.stringify(error, undefined, 2))
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async driverReRegister(
    @Arg('data') data: DriverReRegisterInput,
    @Arg('driverId', { nullable: true }) driverId: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<boolean> {
    const userId = ctx.req.user_id
    const { detail, documents } = data
    try {
      if (driverId) {
        const isEmployee = await UserModel.findOne({ _id: new Types.ObjectId(driverId), parents: { $in: [userId] } })
        if (!isEmployee) {
          throw new GraphQLError('คุณไม่มีสิทธิ์เปลี่ยนแปลงข้่อมูลคนขับคนนี้')
        }
      }
      const driver = await UserModel.findById(driverId || userId).lean()
      if (!driver) {
        throw new GraphQLError('ไม่พบข้อมูลของท่าน')
      }

      const driverDetail = await DriverDetailModel.findById(driver.driverDetail).lean()
      if (!driverDetail) {
        throw new GraphQLError('ไม่พบข้อมูลของท่าน')
      }

      const driverDocuments = await DriverDocumentModel.findById(driverDetail.documents)
      if (!driverDetail) {
        throw new GraphQLError('ไม่พบข้อมูลของท่าน')
      }

      // 2. Document
      const frontOfVehicle = documents.frontOfVehicle ? new FileModel({ ...documents.frontOfVehicle }) : null
      const backOfVehicle = documents.backOfVehicle ? new FileModel({ ...documents.backOfVehicle }) : null
      const leftOfVehicle = documents.leftOfVehicle ? new FileModel({ ...documents.leftOfVehicle }) : null
      const rigthOfVehicle = documents.rigthOfVehicle ? new FileModel({ ...documents.rigthOfVehicle }) : null
      const copyVehicleRegistration = documents.copyVehicleRegistration
        ? new FileModel({ ...documents.copyVehicleRegistration })
        : null
      const copyIDCard = documents.copyIDCard ? new FileModel({ ...documents.copyIDCard }) : null
      const copyDrivingLicense = documents.copyDrivingLicense
        ? new FileModel({ ...documents.copyDrivingLicense })
        : null
      const copyBookBank = documents.copyBookBank ? new FileModel({ ...documents.copyBookBank }) : null
      const copyHouseRegistration = documents.copyHouseRegistration
        ? new FileModel({ ...documents.copyHouseRegistration })
        : null
      const insurancePolicy = documents.insurancePolicy ? new FileModel({ ...documents.insurancePolicy }) : null
      const criminalRecordCheckCert = documents.criminalRecordCheckCert
        ? new FileModel({ ...documents.criminalRecordCheckCert })
        : null
      const businessRegistrationCertificate = documents.businessRegistrationCertificate
        ? new FileModel({ ...documents.businessRegistrationCertificate })
        : null
      const certificateValueAddedTaxRegistration = documents.certificateValueAddedTaxRegistration
        ? new FileModel({ ...documents.certificateValueAddedTaxRegistration })
        : null
      frontOfVehicle && (await frontOfVehicle.save())
      backOfVehicle && (await backOfVehicle.save())
      leftOfVehicle && (await leftOfVehicle.save())
      rigthOfVehicle && (await rigthOfVehicle.save())
      copyVehicleRegistration && (await copyVehicleRegistration.save())
      copyIDCard && (await copyIDCard.save())
      copyDrivingLicense && (await copyDrivingLicense.save())
      copyBookBank && (await copyBookBank.save())
      copyHouseRegistration && (await copyHouseRegistration.save())
      insurancePolicy && (await insurancePolicy.save())
      criminalRecordCheckCert && (await criminalRecordCheckCert.save())
      businessRegistrationCertificate && (await businessRegistrationCertificate.save())
      certificateValueAddedTaxRegistration && (await certificateValueAddedTaxRegistration.save())
      await DriverDocumentModel.findByIdAndUpdate(driverDocuments._id, {
        ...(frontOfVehicle ? { frontOfVehicle } : {}),
        ...(backOfVehicle ? { backOfVehicle } : {}),
        ...(leftOfVehicle ? { leftOfVehicle } : {}),
        ...(rigthOfVehicle ? { rigthOfVehicle } : {}),
        ...(copyVehicleRegistration ? { copyVehicleRegistration } : {}),
        ...(copyIDCard ? { copyIDCard } : {}),
        ...(copyDrivingLicense ? { copyDrivingLicense } : {}),
        ...(copyBookBank ? { copyBookBank } : {}),
        ...(copyHouseRegistration ? { copyHouseRegistration } : {}),
        ...(insurancePolicy ? { insurancePolicy } : {}),
        ...(criminalRecordCheckCert ? { criminalRecordCheckCert } : {}),
        ...(businessRegistrationCertificate ? { businessRegistrationCertificate } : {}),
        ...(certificateValueAddedTaxRegistration ? { certificateValueAddedTaxRegistration } : {}),
      })

      // 3. Detail
      await DriverDetailModel.findByIdAndUpdate(driverDetail._id, {
        title: detail.title,
        otherTitle: detail.otherTitle,
        firstname: detail.firstname,
        lastname: detail.lastname,
        businessName: detail.businessName,
        businessBranch: detail.businessBranch,
        taxNumber: detail.taxNumber,
        lineId: detail.lineId,
        address: detail.address,
        province: detail.province,
        district: detail.district,
        subDistrict: detail.subDistrict,
        postcode: detail.postcode,
        bank: detail.bank,
        bankBranch: detail.bankBranch,
        bankName: detail.bankName,
        bankNumber: detail.bankNumber,
        serviceVehicleTypes: detail.serviceVehicleTypes,
      })

      // 4. User
      await UserModel.findByIdAndUpdate(driver._id, {
        status: EUserStatus.PENDING,
        validationStatus: EUserValidationStatus.PENDING,
        drivingStatus: EDriverStatus.IDLE,
      })

      // Notification
      await NotificationModel.sendNotification({
        userId: driver._id,
        varient: ENotificationVarient.INFO,
        title: 'ขอบคุณที่ส่งข้อมูล',
        message: [`คุณได้ส่งข้อมูลเพื่อสมัคคนขับ Movemate อีกครั้ง โปรดรอเจ้าหน้าที่ตรวจสอบบัญชีของท่าน`],
      })

      return true
    } catch (error) {
      console.log('error: ', JSON.stringify(error, undefined, 2))
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => EmployeeDetailPayload)
  async verifyEmployeeData(
    @Arg('data') data: EmployeeDetailInput,
    @Arg('driverId', { nullable: true }) driverId: string,
    @Ctx() ctx: GraphQLContext,
  ): Promise<EmployeeDetailPayload> {
    try {
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }
      await EmployeeDriverScema(driverId).validate(data, { abortEarly: false })
      return data
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => RegisterPayload)
  async employeeRegister(
    @Arg('data') data: EmployeeRegisterInput,
    @Ctx() ctx: GraphQLContext,
  ): Promise<RegisterPayload> {
    const { detail, documents } = data
    try {
      const userId = ctx.req.user_id
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      await EmployeeDriverScema().validate(detail, { abortEarly: false })

      // 2. Document
      const frontOfVehicle = documents.frontOfVehicle ? new FileModel({ ...documents.frontOfVehicle }) : null
      const backOfVehicle = documents.backOfVehicle ? new FileModel({ ...documents.backOfVehicle }) : null
      const leftOfVehicle = documents.leftOfVehicle ? new FileModel({ ...documents.leftOfVehicle }) : null
      const rigthOfVehicle = documents.rigthOfVehicle ? new FileModel({ ...documents.rigthOfVehicle }) : null
      const copyVehicleRegistration = documents.copyVehicleRegistration
        ? new FileModel({ ...documents.copyVehicleRegistration })
        : null
      const copyIDCard = documents.copyIDCard ? new FileModel({ ...documents.copyIDCard }) : null
      const copyDrivingLicense = documents.copyDrivingLicense
        ? new FileModel({ ...documents.copyDrivingLicense })
        : null
      const copyBookBank = documents.copyBookBank ? new FileModel({ ...documents.copyBookBank }) : null
      const copyHouseRegistration = documents.copyHouseRegistration
        ? new FileModel({ ...documents.copyHouseRegistration })
        : null
      const insurancePolicy = documents.insurancePolicy ? new FileModel({ ...documents.insurancePolicy }) : null
      const criminalRecordCheckCert = documents.criminalRecordCheckCert
        ? new FileModel({ ...documents.criminalRecordCheckCert })
        : null
      const businessRegistrationCertificate = documents.businessRegistrationCertificate
        ? new FileModel({ ...documents.businessRegistrationCertificate })
        : null
      const certificateValueAddedTaxRegistration = documents.certificateValueAddedTaxRegistration
        ? new FileModel({ ...documents.certificateValueAddedTaxRegistration })
        : null
      frontOfVehicle && (await frontOfVehicle.save())
      backOfVehicle && (await backOfVehicle.save())
      leftOfVehicle && (await leftOfVehicle.save())
      rigthOfVehicle && (await rigthOfVehicle.save())
      copyVehicleRegistration && (await copyVehicleRegistration.save())
      copyIDCard && (await copyIDCard.save())
      copyDrivingLicense && (await copyDrivingLicense.save())
      copyBookBank && (await copyBookBank.save())
      copyHouseRegistration && (await copyHouseRegistration.save())
      insurancePolicy && (await insurancePolicy.save())
      criminalRecordCheckCert && (await criminalRecordCheckCert.save())
      businessRegistrationCertificate && (await businessRegistrationCertificate.save())
      certificateValueAddedTaxRegistration && (await certificateValueAddedTaxRegistration.save())
      const driverDocument = new DriverDocumentModel({
        frontOfVehicle,
        backOfVehicle,
        leftOfVehicle,
        rigthOfVehicle,
        copyVehicleRegistration,
        copyIDCard,
        copyDrivingLicense,
        copyBookBank,
        copyHouseRegistration,
        insurancePolicy,
        criminalRecordCheckCert,
        businessRegistrationCertificate,
        certificateValueAddedTaxRegistration,
      })
      await driverDocument.save()

      // 3. Detail
      const driverDetailModel = new DriverDetailModel({
        driverType: [EDriverType.BUSINESS_DRIVER],
        title: detail.title,
        otherTitle: detail.otherTitle,
        firstname: detail.firstname,
        lastname: detail.lastname,
        taxNumber: detail.taxNumber,
        phoneNumber: detail.phoneNumber,
        lineId: detail.lineId,
        address: detail.address,
        province: detail.province,
        district: detail.district,
        subDistrict: detail.subDistrict,
        postcode: detail.postcode,
        documents: driverDocument,
      })
      await driverDetailModel.save()

      // 4. User
      const password_decryption = generateRef(10).toLowerCase()
      const hashedPassword = await bcrypt.hash(password_decryption, 10)
      const userNumber = await generateId('MMDI', 'driver')

      const user = new UserModel({
        userNumber: userNumber,
        userRole: EUserRole.DRIVER,
        userType: EUserType.INDIVIDUAL,
        username: detail.phoneNumber,
        password: hashedPassword,
        status: EUserStatus.PENDING,
        validationStatus: EUserValidationStatus.PENDING,
        registration: platform,
        isVerifiedEmail: true, // Set true becuase Driver no email property
        isVerifiedPhoneNumber: false,
        driverDetail: driverDetailModel,
        isChangePasswordRequire: true,
        drivingStatus: EDriverStatus.IDLE,
        parents: [userId],
      })
      await user.save()

      // Notification
      await NotificationModel.sendNotification({
        userId: user._id,
        varient: ENotificationVarient.MASTER,
        title: 'ยินดีต้อนรับเข้าสู่คนขับ Movemate',
        message: [
          `ยินดีต้อนรับ คุณ ${driverDetailModel.fullname} เข้าสู่ทีมขับรถของเรา โปรดรอเจ้าหน้าที่ตรวจสอบบัญชีของท่าน`,
        ],
      })

      return {
        phoneNumber: detail.phoneNumber,
        driverType: EDriverType.BUSINESS_DRIVER,
      }
    } catch (error) {
      console.log('error: ', JSON.stringify(error, undefined, 2))
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }

  @Mutation(() => Boolean)
  async changeDrivingStatus(@Ctx() ctx: GraphQLContext, @Arg('status') status: string): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      if (userId) {
        const userModel = await UserModel.findById(userId)
        if (!userModel) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        await userModel.updateOne({ drivingStatus: status })
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async removeEmployee(@Ctx() ctx: GraphQLContext, @Arg('driverId') driverId: string): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      if (userId) {
        const agent = await UserModel.findById(userId)
        if (!driverId) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        const driver = await UserModel.findOne({ _id: new Types.ObjectId(driverId), parents: { $in: [userId] } }).lean()
        if (!driver) {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        const driverDetail = await DriverDetailModel.findById(driver.driverDetail).lean()
        if (driverDetail) {
          const isSingleDriverType = driverDetail.driverType.length < 2
          if (
            isSingleDriverType &&
            includes(driverDetail.driverType, EDriverType.BUSINESS_DRIVER) &&
            includes([EUserValidationStatus.PENDING, EUserValidationStatus.DENIED], driver.validationStatus)
          ) {
            /**
             * Condition:
             * If driver is only business driver type -> Remove data
             */
            await DriverDocumentModel.deleteOne({ _id: driverDetail.documents })
            await DriverDetailModel.deleteOne({ _id: driverDetail._id })
            await UserModel.deleteOne({ _id: driver._id })
          } else {
            await UserModel.findByIdAndUpdate(driverId, { $pull: { parents: userId } })
            /**
             * Notification
             */
            const title = `นายหน้าได้ลบคุณออกจากรายชื่อคนขับ`
            const message = `${agent.fullname} ลบคุณออกจากรายชื่อคนขับของนายหน้า`
            await NotificationModel.sendNotification({
              userId: driver._id,
              varient: ENotificationVarient.INFO,
              title: title,
              message: [message],
            })
            if (driver.fcmToken) {
              const token = decryption(driver.fcmToken)
              await NotificationModel.sendFCMNotification({
                token,
                data: { navigation: ENavigationType.INDEX },
                notification: { title: NOTIFICATION_TITLE, body: message },
              })
            }
          }
        } else {
          const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบผู้ใช้งาน'
          throw new GraphQLError(message, {
            extensions: {
              code: 'NOT_FOUND',
              errors: [{ message }],
            },
          })
        }
        return true
      }
      const message = 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้ เนื่องจากไม่พบเลขที่ผู้ใช้งาน'
      throw new GraphQLError(message, {
        extensions: {
          code: 'NOT_FOUND',
          errors: [{ message }],
        },
      })
    } catch (errors) {
      console.log('error: ', errors)
      throw errors
    }
  }

  @Query(() => [User])
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async getAvailableDrivers(@Ctx() ctx: GraphQLContext, @Arg('shipmentId') shipmentId: string): Promise<User[]> {
    const userId = ctx.req.user_id

    const employeeIds = await UserModel.find({ parents: { $in: [userId] } }).distinct('_id')
    console.log('=> employeeIds :', employeeIds)
    const shipment = await ShipmentModel.findById(shipmentId).lean()
    if (!shipment) {
      const message = 'ไม่สามารถหาข้อมูลงานขนส่งได้ เนื่องจากไม่พบงานขนส่งดังกล่าว'
      throw new GraphQLError(message, { extensions: { code: REPONSE_NAME.NOT_FOUND, errors: [{ message }] } })
    }

    const startDatetime = shipment.bookingDateTime
    const endDatetime = addSeconds(startDatetime, shipment.displayTime)

    const unavailableDriverIds = await ShipmentModel.find({
      $or: [
        {
          bookingDateTime: { $lt: endDatetime },
          $expr: {
            $gt: [{ $add: ['$bookingDateTime', { $multiply: ['$displayTime', 1000] }] }, startDatetime],
          },
        },
      ],
    }).distinct('driver')

    // ค้นหา driver ที่ไม่มีงานช่วงเวลาซ้อนทับ
    const availableDrivers = await UserModel.find({
      _id: { $nin: unavailableDriverIds },
      parents: { $in: [userId] },
      status: EUserStatus.ACTIVE,
      drivingStatus: { $in: [EDriverStatus.IDLE, EDriverStatus.WORKING] },
    })

    return availableDrivers
  }

  @Query(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.DRIVER]))
  async checkAvailableToWork(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    try {
      const userId = ctx.req.user_id
      const driver = await UserModel.findById(userId)
      const driverDetail = get(driver, 'driverDetail', undefined) as DriverDetail | undefined

      if (driverDetail) {
        console.log('1. checkAvailableToWork --------->', includes(driverDetail.driverType, EDriverType.BUSINESS))
        if (includes(driverDetail.driverType, EDriverType.BUSINESS)) {
          const childrens = await UserModel.find({ parents: { $in: [userId] } }).lean()
          console.log('2. checkAvailableToWork --------->', childrens)
          console.log('---childrens---', childrens)
          if (isEmpty(childrens)) {
            return false
          }
          return true
        } else {
          // Individual
          return false
        }
      }

      return false
    } catch (error) {
      console.log('error: ', error)
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error)
      }
      throw error
    }
  }
}
