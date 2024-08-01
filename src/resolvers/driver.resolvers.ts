import { Resolver, Mutation, Arg, Ctx } from "type-graphql";
import UserModel, { User } from "@models/user.model";
import bcrypt from "bcrypt";
import { GraphQLContext } from "@configs/graphQL.config";
import { isEmpty } from "lodash";
import { generateId } from "@utils/string.utils";
import FileModel from "@models/file.model";
import { decryption } from "@utils/encryption";
import { IndividualDriverDetailInput, IndividualDriverRegisterInput } from "@inputs/driver.input";
import { IndividualDriverScema } from "@validations/driver.validations";
import { verifyOTP } from "./otp.resolver";
import IndividualDriverModel from "@models/driverIndividual.model";
import DriverDocumentModel from "@models/driverDocument.model";
import NotificationModel from "@models/notification.model";
import { ValidationError } from "yup";
import { yupValidationThrow } from "@utils/error.utils";
import { IndividualDriverDetailVerifyPayload, RegisterPayload } from "@payloads/driver.payloads";

@Resolver(User)
export default class DriverResolver {

  @Mutation(() => IndividualDriverDetailVerifyPayload)
  async verifyIndiividualDriverData(
    @Arg("data") data: IndividualDriverDetailInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<IndividualDriverDetailVerifyPayload> {
    try {
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }
      await IndividualDriverScema.validate(data, { abortEarly: false })
      return data
    } catch (error) {
      console.log("error: ", error);
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error);
      }
      throw error;
    }
  }

  @Mutation(() => RegisterPayload)
  async individualDriverRegister(
    @Arg("data") data: IndividualDriverRegisterInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<RegisterPayload> {
    const { detail, documents, otp } = data;
    try {
      // Check if the user already exists
      const platform = ctx.req.headers["platform"];
      if (isEmpty(platform)) {
        throw new Error("Bad Request: Platform is require");
      }

      await IndividualDriverScema.validate(detail, { abortEarly: false })

      // 1. OTP Driver checker
      await verifyOTP(otp.phoneNumber, otp.otp, otp.ref)

      // 2. Document
      const frontOfVehicle = documents.frontOfVehicle ? new FileModel({ ...documents.frontOfVehicle }) : null
      const backOfVehicle = documents.backOfVehicle ? new FileModel({ ...documents.backOfVehicle }) : null
      const leftOfVehicle = documents.leftOfVehicle ? new FileModel({ ...documents.leftOfVehicle }) : null
      const rigthOfVehicle = documents.rigthOfVehicle ? new FileModel({ ...documents.rigthOfVehicle }) : null
      const copyVehicleRegistration = documents.copyVehicleRegistration ? new FileModel({ ...documents.copyVehicleRegistration }) : null
      const copyIDCard = documents.copyIDCard ? new FileModel({ ...documents.copyIDCard }) : null
      const copyDrivingLicense = documents.copyDrivingLicense ? new FileModel({ ...documents.copyDrivingLicense }) : null
      const copyBookBank = documents.copyBookBank ? new FileModel({ ...documents.copyBookBank }) : null
      const copyHouseRegistration = documents.copyHouseRegistration ? new FileModel({ ...documents.copyHouseRegistration }) : null
      const insurancePolicy = documents.insurancePolicy ? new FileModel({ ...documents.insurancePolicy }) : null
      const criminalRecordCheckCert = documents.criminalRecordCheckCert ? new FileModel({ ...documents.criminalRecordCheckCert }) : null
      frontOfVehicle && await frontOfVehicle.save()
      backOfVehicle && await backOfVehicle.save()
      leftOfVehicle && await leftOfVehicle.save()
      rigthOfVehicle && await rigthOfVehicle.save()
      copyVehicleRegistration && await copyVehicleRegistration.save()
      copyIDCard && await copyIDCard.save()
      copyDrivingLicense && await copyDrivingLicense.save()
      copyBookBank && await copyBookBank.save()
      copyHouseRegistration && await copyHouseRegistration.save()
      insurancePolicy && await insurancePolicy.save()
      criminalRecordCheckCert && await criminalRecordCheckCert.save()
      const driverDetail = new DriverDocumentModel({
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
      })
      await driverDetail.save()

      // 3. Detail
      const individualDriverDetail = new IndividualDriverModel({
        title: detail.title,
        otherTitle: detail.otherTitle,
        firstname: detail.firstname,
        lastname: detail.lastname,
        taxId: detail.taxId,
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
        serviceVehicleType: detail.serviceVehicleType,
        documents: driverDetail
      })
      await individualDriverDetail.save()

      // 4. User
      const password_decryption = decryption(detail.password)
      const hashedPassword = await bcrypt.hash(password_decryption, 10);
      const userNumber = await generateId("MMDI", 'driver');

      const currentDate = new Date()
      const user = new UserModel({
        userNumber: userNumber,
        userRole: 'driver',
        userType: 'individual',
        username: detail.phoneNumber,
        password: hashedPassword,
        status: 'pending',
        validationStatus: 'pending',
        registration: platform,
        lastestOTP: otp.otp,
        lastestOTPRef: otp.ref,
        isVerifiedEmail: true, // Set true becuase Driver no email property
        isVerifiedPhoneNumber: true,
        acceptPolicyVersion: detail.policyVersion,
        acceptPolicyTime: currentDate.toISOString(),

        individualDriver: individualDriverDetail,
        isChangePasswordRequire: false,
      });
      await user.save()

      // Notification
      await NotificationModel.sendNotification({
        userId: user._id,
        varient: 'master',
        title: 'ยินดีต้อนรับเข้าสู่คนขับ Movemate',
        message: [`ยินดีต้อนรับ คุณ ${individualDriverDetail.fullname} เข้าสู่ทีมขับรถของเรา โปรดรอเจ้าหน้าที่ตรวจสอบบัญชีของท่าน`],
      })

      return {
        phoneNumber: detail.phoneNumber,
        driverType: detail.driverType
      };
    } catch (error) {
      console.log("error: ", error);
      if (error instanceof ValidationError) {
        throw yupValidationThrow(error);
      }
      throw error;
    }
  }
}
