import { Resolver, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql'
import UserModel, { User } from '@models/user.model'
import CustomerIndividualModel from '@models/customerIndividual.model'
import BusinessCustomerModel from '@models/customerBusiness.model'
import BusinessCustomerCashPaymentModel from '@models/customerBusinessCashPayment.model'
import BusinessCustomerCreditPaymentModel from '@models/customerBusinessCreditPayment.model'
import { RegisterInput } from '@inputs/user.input'
import bcrypt from 'bcrypt'
import { AuthGuard } from '@guards/auth.guards'
import { GraphQLContext } from '@configs/graphQL.config'
import { get, isEmpty, isEqual, omit } from 'lodash'
import { generateId, generateRandomNumberPattern, getCurrentHost } from '@utils/string.utils'
import addEmailQueue from '@utils/email.utils'
import { GraphQLError } from 'graphql'
import FileModel from '@models/file.model'
import { CutomerBusinessInput, CutomerIndividualInput } from '@inputs/customer.input'
import { decryption, generateExpToken } from '@utils/encryption'
import { BusinessCustomerSchema, IndividualCustomerSchema } from '@validations/customer.validations'
import { ValidationError } from 'yup'
import { yupValidationThrow } from '@utils/error.utils'
import { EPaymentMethod } from '@enums/payments'
import { ECreditBillingCycleType, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import RetryTransactionMiddleware from '@middlewares/RetryTransaction'
import { ClientSession } from 'mongoose'
import NotificationModel, { ENotificationVarient } from '@models/notification.model'

@Resolver(User)
export default class RegisterResolver {
  async isExistingEmail(email: string, fieldName = 'email', session: ClientSession): Promise<boolean> {
    if (email) {
      const isExistingEmailWithIndividual = await CustomerIndividualModel.findOne({ email }).session(session)
      if (isExistingEmailWithIndividual) {
        throw new GraphQLError('ไม่สามารถใช้อีเมลร่วมกับสมาชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ', {
          extensions: {
            code: 'ERROR_VALIDATION',
            errors: [
              {
                field: fieldName,
                message: 'ไม่สามารถใช้อีเมลร่วมกับสมาชิกประเภทบุคคลได้ กรุณาติดต่อผู้ดูแลระบบ',
              },
            ],
          },
        })
      }

      const isExistingEmailWithBusiness = await BusinessCustomerModel.findOne({
        businessEmail: email,
      }).session(session)
      if (isExistingEmailWithBusiness) {
        throw new GraphQLError('อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
          extensions: {
            code: 'ERROR_VALIDATION',
            errors: [
              {
                field: fieldName,
                message: 'อีเมลถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ',
              },
            ],
          },
        })
      }
    } else {
      throw new GraphQLError('ระบุอีเมล', {
        extensions: {
          code: 'ERROR_VALIDATION',
          errors: [{ field: fieldName, message: 'ระบุอีเมล' }],
        },
      })
    }
    return true
  }

  @Mutation(() => Boolean)
  async preregister(@Arg('data') data: RegisterInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    const session = ctx.session
    const { userType, individualDetail, businessDetail } = data
    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      // Exist email
      const email = isEqual(userType, EUserType.INDIVIDUAL)
        ? get(individualDetail, 'email', '')
        : isEqual(userType, EUserType.BUSINESS)
        ? get(businessDetail, 'businessEmail', '')
        : ''
      const emailFieldName = userType === EUserType.INDIVIDUAL ? 'email' : 'businessEmail'
      await this.isExistingEmail(email, emailFieldName, session)

      // Exist phone number
      const phoneNumber = isEqual(userType, EUserType.INDIVIDUAL)
        ? get(individualDetail, 'phoneNumber', '')
        : isEqual(userType, EUserType.BUSINESS)
        ? get(businessDetail, 'contactNumber', '')
        : ''
      const phoneNumberFieldName = userType === EUserType.INDIVIDUAL ? 'phoneNumber' : 'contactNumber'
      const exitingPhonenumber = await UserModel.existingPhonenumber(phoneNumber)
      if (exitingPhonenumber) {
        throw new GraphQLError('หมายเลขโทรศัพท์ถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
          extensions: {
            code: 'ERROR_VALIDATION',
            errors: [
              {
                field: phoneNumberFieldName,
                message: 'หมายเลขโทรศัพท์ถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ',
              },
            ],
          },
        })
      }

      if (isEqual(userType, EUserType.BUSINESS) && businessDetail) {
        // taxId
        const taxId = get(businessDetail, 'taxNumber', '')
        const taxIdField = 'taxNumber'
        const exitingTaxId = await UserModel.existingTaxId(taxId)
        if (exitingTaxId) {
          throw new GraphQLError('เลขประจำตัวผู้เสียภาษีถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
            extensions: {
              code: 'ERROR_VALIDATION',
              errors: [
                {
                  field: taxIdField,
                  message: 'เลขประจำตัวผู้เสียภาษีถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ',
                },
              ],
            },
          })
        }

        // business
        // const businessName = get(businessDetail, 'businessName', '')
        // const businessNameField = 'businessName'
        // const exitingBusinessName = await UserModel.existingBusinessName(businessName)
        // if (exitingBusinessName) {
        //   throw new GraphQLError('ชื่อบริษัท/องค์กรถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ', {
        //     extensions: {
        //       code: 'ERROR_VALIDATION',
        //       errors: [
        //         {
        //           field: businessNameField,
        //           message: 'ชื่อบริษัท/องค์กรถูกใช้งานในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ',
        //         },
        //       ],
        //     },
        //   })
        // }
      }

      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(RetryTransactionMiddleware)
  async register(@Arg('data') data: RegisterInput, @Ctx() ctx: GraphQLContext): Promise<boolean> {
    const session = ctx.session
    const { userType, password, remark, acceptPolicyTime, acceptPolicyVersion, individualDetail, businessDetail } = data

    try {
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      // Exist email
      // TODO: Refactor
      const email = isEqual(userType, EUserType.INDIVIDUAL)
        ? get(individualDetail, 'email', '')
        : isEqual(userType, EUserType.BUSINESS)
        ? get(businessDetail, 'businessEmail', '')
        : ''
      const emailFieldName = userType === EUserType.INDIVIDUAL ? 'email' : 'businessEmail'
      await this.isExistingEmail(email, emailFieldName, session)

      /**
       * Individual Customer Register
       */
      if (userType === EUserType.INDIVIDUAL && individualDetail) {
        const password_decryption = decryption(password)
        const hashedPassword = await bcrypt.hash(password_decryption, 10)
        const userNumber = await generateId('MMIN', 'individual')

        const individualCustomer = new CustomerIndividualModel({
          userNumber,
          ...individualDetail,
        })

        await individualCustomer.save({ session })

        const user = new UserModel({
          userRole: EUserRole.CUSTOMER,
          status: EUserStatus.ACTIVE,
          validationStatus: EUserValidationStatus.DENIED,
          userNumber,
          userType,
          username: individualDetail.email,
          password: hashedPassword,
          remark,
          registration: platform,
          isVerifiedEmail: false,
          isVerifiedPhoneNumber: true,
          acceptPolicyVersion,
          acceptPolicyTime,
          individualDetail: individualCustomer,
          isChangePasswordRequire: false,
        })

        await user.save({ session })

        const host = getCurrentHost(ctx)
        // http://api.movematethailand.com/api/v1/activate/customer/MMIN0003
        const userNumberToken = generateExpToken({ userNumber: user.userNumber })
        const activate_link = `${host}/api/v1/activate/customer/${userNumberToken}`
        const movemate_link = `https://www.movematethailand.com`
        // Email sender
        await addEmailQueue({
          from: process.env.MAILGUN_SMTP_EMAIL,
          to: individualDetail.email,
          subject: 'ยืนยันการสมัครสมาชิก Movemate!',
          template: 'register_individual',
          context: {
            fullname: individualCustomer.fullname,
            username: individualDetail.email,
            activate_link,
            movemate_link,
          },
        })

        return true
      }

      /**
       * Business Customer Register
       */
      if (userType === EUserType.BUSINESS && businessDetail) {
        if (!businessDetail) {
          throw new Error('ข้อมูลไม่สมบูรณ์')
        }

        const userNumber = await generateId('MMBU', 'business')
        const generatedPassword = generateRandomNumberPattern('MM########').toLowerCase()
        const hashedPassword = await bcrypt.hash(generatedPassword, 10)

        if (businessDetail.paymentMethod === EPaymentMethod.CASH && businessDetail.paymentCashDetail) {
          const cashDetail = businessDetail.paymentCashDetail
          const cashPayment = new BusinessCustomerCashPaymentModel({
            acceptedEReceiptDate: cashDetail.acceptedEReceiptDate,
          })

          await cashPayment.save({ session })

          const business = new BusinessCustomerModel({
            ...businessDetail,
            userNumber,
            cashPayment,
          })

          await business.save({ session })

          const user = new UserModel({
            userNumber,
            userType,
            status: EUserStatus.PENDING,
            validationStatus: EUserValidationStatus.PENDING,
            username: userNumber,
            password: hashedPassword,
            remark,
            registration: platform,
            isVerifiedEmail: false,
            isVerifiedPhoneNumber: true,
            acceptPolicyVersion,
            acceptPolicyTime,
            businessDetail: business,
          })

          await user.save({ session })

          // Email sender
          await addEmailQueue({
            from: process.env.MAILGUN_SMTP_EMAIL,
            to: businessDetail.businessEmail,
            subject: 'การลงทะเบียนรอการอนุมัติ',
            template: 'register_business_waiting_approve',
            context: { movemate_link: `https://www.movematethailand.com` },
          })
          return true
        } else if (businessDetail.paymentMethod === EPaymentMethod.CREDIT && businessDetail.paymentCreditDetail) {

          const {
            businessRegistrationCertificateFile,
            copyIDAuthorizedSignatoryFile,
            certificateValueAddedTaxRegistrationFile,
            ...creditDetail
          } = businessDetail.paymentCreditDetail

          // Upload document
          if (!businessRegistrationCertificateFile) {
            throw new GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
              extensions: {
                code: 'ERROR_VALIDATION',
                errors: [
                  {
                    field: 'businessRegistrationCertificate',
                    message: 'กรุณาอัพโหลดเอกสารสำเนาบัตรประชาชนผู้มีอำนาจลงนาม',
                  },
                ],
              },
            })
          }
          if (!copyIDAuthorizedSignatoryFile) {
            throw new GraphQLError('กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม', {
              extensions: {
                code: 'ERROR_VALIDATION',
                errors: [
                  {
                    field: 'copyIDAuthorizedSignatory',
                    message: 'กรุณาอัพโหลดเอกสาร สำเนาบัตรประชาชนผู้มีอำนาจลงนาม',
                  },
                ],
              },
            })
          }
          const businessRegisCertFileModel = new FileModel(businessRegistrationCertificateFile)
          const copyIDAuthSignatoryFileModel = new FileModel(copyIDAuthorizedSignatoryFile)
          const certValueAddedTaxRegisFileModel = certificateValueAddedTaxRegistrationFile
            ? new FileModel(certificateValueAddedTaxRegistrationFile)
            : null

          await businessRegisCertFileModel.save({ session })
          await copyIDAuthSignatoryFileModel.save({ session })
          if (certValueAddedTaxRegisFileModel) {
            await certValueAddedTaxRegisFileModel.save({ session })
          }

          const _defaultCreditLimit = 20000.0
          const creditPayment = new BusinessCustomerCreditPaymentModel({
            ...creditDetail,
            billingCycleType: ECreditBillingCycleType.DEFAULT,
            billingCycle: {
              jan: { issueDate: 1, dueDate: 16, dueMonth: 1 },
              feb: { issueDate: 1, dueDate: 16, dueMonth: 2 },
              mar: { issueDate: 1, dueDate: 16, dueMonth: 3 },
              apr: { issueDate: 1, dueDate: 16, dueMonth: 4 },
              may: { issueDate: 1, dueDate: 16, dueMonth: 5 },
              jun: { issueDate: 1, dueDate: 16, dueMonth: 6 },
              jul: { issueDate: 1, dueDate: 16, dueMonth: 7 },
              aug: { issueDate: 1, dueDate: 16, dueMonth: 8 },
              sep: { issueDate: 1, dueDate: 16, dueMonth: 9 },
              oct: { issueDate: 1, dueDate: 16, dueMonth: 10 },
              nov: { issueDate: 1, dueDate: 16, dueMonth: 11 },
              dec: { issueDate: 1, dueDate: 16, dueMonth: 12 },
            },
            creditLimit: _defaultCreditLimit,
            creditUsage: 0,
            creditOutstandingBalance: 0,
            businessRegistrationCertificateFile: businessRegisCertFileModel,
            copyIDAuthorizedSignatoryFile: copyIDAuthSignatoryFileModel,
            ...(certValueAddedTaxRegisFileModel
              ? {
                  certificateValueAddedTaxRegistrationFile: certValueAddedTaxRegisFileModel,
                }
              : {}),
          })
          await creditPayment.save({ session })

          const business = new BusinessCustomerModel({
            ...businessDetail,
            userNumber,
            creditPayment,
          })

          await business.save({ session })

          const user = new UserModel({
            userNumber,
            userType,
            username: userNumber,
            password: hashedPassword,
            status: EUserStatus.PENDING,
            validationStatus: EUserValidationStatus.PENDING,
            remark,
            registration: platform,
            isVerifiedEmail: false,
            isVerifiedPhoneNumber: true,
            acceptPolicyVersion,
            acceptPolicyTime,
            businessDetail: business,
          })

          await user.save({ session })

          await NotificationModel.sendNotificationToAdmins({
            varient: ENotificationVarient.INFO,
            title: 'ลูกค้าองค์กรใหม่รออนุมัติ',
            message: [`บริษัท '${business.businessName}' ได้ลงทะเบียนเข้ามาใหม่ กรุณาตรวจสอบและอนุมัติบัญชี`],
            infoText: 'ตรวจสอบข้อมูล',
            infoLink: `/management/customer/business/detail/${user._id}`,
          })

          // Email sender
          await addEmailQueue({
            from: process.env.MAILGUN_SMTP_EMAIL,
            to: businessDetail.businessEmail,
            subject: 'การลงทะเบียนรอการอนุมัติ',
            template: 'register_business_waiting_approve',
            context: { movemate_link: `https://www.movematethailand.com` },
          })
          return true
        } else {
          throw new Error('ไม่พบข้อมูลการชำระ กรุณาติดต่อผู้ดูแลระบบ')
        }
      }

      return false
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async addIndividualCustomer(@Arg('data') data: CutomerIndividualInput, @Ctx() ctx: GraphQLContext): Promise<User> {
    const session = ctx.session
    const { email, profileImage, status, ...formValue } = data
    try {
      await IndividualCustomerSchema().validate(data, { abortEarly: false })
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      const rawPassword = generateRandomNumberPattern('MMPWD########').toLowerCase()
      const hashedPassword = await bcrypt.hash(rawPassword, 10)
      const userNumber = await generateId('MMIN', 'individual')

      const customer = new CustomerIndividualModel({
        userNumber,
        email,
        ...formValue,
      })

      await customer.save({ session })

      const image = profileImage ? new FileModel(profileImage) : null
      if (image) {
        await image.save({ session })
      }

      const user = new UserModel({
        ...formValue,
        userRole: EUserRole.CUSTOMER,
        userType: EUserType.INDIVIDUAL,
        validationStatus: EUserValidationStatus.APPROVE,
        status,
        userNumber,
        username: data.email,
        profileImage: image,
        password: hashedPassword,
        registration: platform,
        individualDetail: customer,
      })

      await user.save({ session })

      const host = getCurrentHost(ctx)
      const userNumberToken = generateExpToken({ userNumber: user.userNumber })
      const activate_link = `${host}/api/v1/activate/customer/${userNumberToken}`
      const movemate_link = `https://www.movematethailand.com`
      // Email sender
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: email,
        subject: 'ยืนยันการสมัครสมาชิก Movemate!',
        template: 'register_individual_withpassword',
        context: {
          fullname: customer.fullname,
          username: email,
          password: rawPassword,
          activate_link,
          movemate_link,
        },
      })

      return user
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => User)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]), RetryTransactionMiddleware)
  async addBusinessCustomer(@Arg('data') data: CutomerBusinessInput, @Ctx() ctx: GraphQLContext): Promise<User> {
    const session = ctx.session
    const { businessEmail, profileImage, creditPayment, cashPayment, ...formValue } = data
    try {
      await BusinessCustomerSchema().validate(data, { abortEarly: false })
      // Check if the user already exists
      const platform = ctx.req.headers['platform']
      if (isEmpty(platform)) {
        throw new Error('Bad Request: Platform is require')
      }

      const rawPassword = generateRandomNumberPattern('MMPWD########').toLowerCase()
      const hashedPassword = await bcrypt.hash(rawPassword, 10)
      const userNumber = await generateId('MMBU', 'business')

      const businessRegistrationCertificateFile = get(creditPayment, 'businessRegistrationCertificateFile', null)
      const copyIDAuthorizedSignatoryFile = get(creditPayment, 'copyIDAuthorizedSignatoryFile', null)
      const certificateValueAddedTaxRegistrationFile = get(
        creditPayment,
        'certificateValueAddedTaxRegistrationFile',
        null,
      )

      // Document Image 1
      const businessRegistrationCertificate = businessRegistrationCertificateFile
        ? new FileModel(businessRegistrationCertificateFile)
        : null
      if (businessRegistrationCertificate) {
        await businessRegistrationCertificate.save({ session })
      }
      // Document Image 2
      const copyIDAuthorizedSignatory = copyIDAuthorizedSignatoryFile
        ? new FileModel(copyIDAuthorizedSignatoryFile)
        : null
      if (copyIDAuthorizedSignatory) {
        await copyIDAuthorizedSignatory.save({ session })
      }
      // Document Image 3
      const certificateValueAddedTaxRegistration = certificateValueAddedTaxRegistrationFile
        ? new FileModel(certificateValueAddedTaxRegistrationFile)
        : null
      if (certificateValueAddedTaxRegistration) {
        await certificateValueAddedTaxRegistration.save({ session })
      }

      const creditPaymentDetail =
        formValue.paymentMethod === EPaymentMethod.CREDIT && creditPayment
          ? new BusinessCustomerCreditPaymentModel({
              ...omit(creditPayment, [
                'businessRegistrationCertificateFile',
                'copyIDAuthorizedSignatoryFile',
                'certificateValueAddedTaxRegistrationFile',
              ]),
              ...(businessRegistrationCertificate
                ? { businessRegistrationCertificateFile: businessRegistrationCertificate }
                : {}),
              ...(copyIDAuthorizedSignatory ? { copyIDAuthorizedSignatoryFile: copyIDAuthorizedSignatory } : {}),
              ...(certificateValueAddedTaxRegistration
                ? { certificateValueAddedTaxRegistrationFile: certificateValueAddedTaxRegistration }
                : {}),
            })
          : null
      if (creditPaymentDetail) {
        await creditPaymentDetail.save({ session })
      }

      const customer = new BusinessCustomerModel({
        userNumber,
        businessEmail,
        ...formValue,
        ...(creditPaymentDetail ? { creditPayment: creditPaymentDetail } : {}),
      })

      await customer.save({ session })

      const image = profileImage ? new FileModel(profileImage) : null
      if (image) {
        await image.save({ session })
      }

      const user = new UserModel({
        ...formValue,
        userRole: EUserRole.CUSTOMER,
        userType: EUserType.BUSINESS,
        validationStatus: EUserValidationStatus.APPROVE,
        userNumber,
        username: userNumber,
        password: hashedPassword,
        registration: platform,
        businessDetail: customer,
        isVerifiedEmail: false,
        isVerifiedPhoneNumber: false,
        ...(image ? { profileImage: image } : {}),
      })

      await user.save({ session })

      const host = getCurrentHost(ctx)
      const userNumberToken = generateExpToken({ userNumber: user.userNumber })
      const activate_link = `${host}/api/v1/activate/customer/${userNumberToken}`
      const movemate_link = `https://www.movematethailand.com`
      // Email sender
      await addEmailQueue({
        from: process.env.MAILGUN_SMTP_EMAIL,
        to: customer.businessEmail,
        subject: 'ยืนยันการสมัครสมาชิก Movemate!',
        template: 'register_business',
        context: {
          business_title: customer.businessTitle,
          business_name: customer.businessName,
          username: userNumber,
          password: rawPassword,
          activate_link,
          movemate_link,
        },
      })

      console.log('return user: ', user)

      return user
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  // @Mutation(() => User)
  // @UseMiddleware(AuthGuard(["admin"]))
  // async updateUser(
  //   @Arg("data") { id, ...update_data }: UpdateUserInput
  // ): Promise<User> {
  //   try {
  //     const user = await UserModel.findByIdAndUpdate(id, update_data, {
  //       new: true,
  //     });
  //     if (!user) {
  //       throw new Error("User not found");
  //     }

  //     return user;
  //   } catch (error) {
  //     throw new Error("Failed to update user");
  //   }
  // }
}
