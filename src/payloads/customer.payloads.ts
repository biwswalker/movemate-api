import { EPaymentMethod } from '@enums/payments'
import { EAdminPermission, EDriverType, EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { Field, Float, ID, ObjectType } from 'type-graphql'
import { PaginationPayload } from './pagination.payloads'
import { PaginateResult } from 'mongoose'

@ObjectType({ description: 'ข้อมูลสรุปลูกค้าสำหรับแสดงผล' })
export class CustomerDetailPayload {
  @Field(() => ID)
  _id: string

  @Field({ description: 'รหัสลูกค้า' })
  userNumber: string

  @Field({ description: 'Role' })
  userRole: EUserRole

  @Field({ description: 'Type' })
  userType: EUserType

  @Field({ description: 'Title' })
  title: string

  @Field({ description: 'ชื่อ-นามสกุล หรือ ชื่อบริษัท' })
  fullName: string

  @Field({ nullable: true, description: 'อีเมลสำหรับติดต่อ' })
  email?: string

  @Field({ nullable: true, description: 'เบอร์โทรศัพท์สำหรับติดต่อ' })
  contactNumber?: string

  @Field({ nullable: true, description: 'Username' })
  username?: string

  @Field(() => EUserStatus, { description: 'สถานะของ User' })
  status: EUserStatus

  @Field({ description: 'สถานะการยืนยันอีเมล' })
  isVerifiedEmail: boolean

  @Field({ description: 'สถานะการยืนยันเบอร์โทรศัพท์' })
  isVerifiedPhoneNumber: boolean

  @Field({ description: 'User Validation Status' })
  validationStatus: EUserValidationStatus

  @Field(() => EPaymentMethod, { nullable: true, description: 'วิธีการชำระเงินหลัก' })
  paymentMethod?: EPaymentMethod

  @Field(() => Float, { nullable: true, description: 'วงเงินเครดิต (สำหรับลูกค้าบริษัท)' })
  creditLimit?: number

  @Field(() => Float, { nullable: true, description: 'วงเงินเครดิต (สำหรับลูกค้าบริษัท)' })
  creditUsage?: number

  @Field({ nullable: true, description: 'createdAt' })
  createdAt?: string

  @Field({ nullable: true, description: 'lineId' })
  lineId?: string

  @Field({ nullable: true, description: 'serviceVehicleTypeName' })
  serviceVehicleTypeName?: string

  @Field(() => [EDriverType], { nullable: true, description: 'driverType' })
  driverType?: EDriverType[]

  @Field({ nullable: true, description: 'profileImageName' })
  profileImageName?: string

  @Field({ nullable: true, description: 'licensePlateProvince' })
  licensePlateProvince?: string

  @Field({ nullable: true, description: 'licensePlateNumber' })
  licensePlateNumber?: string

  @Field({ nullable: true, description: 'parents' })
  parents?: string

  @Field(() => EAdminPermission, { nullable: true })
  permission?: EAdminPermission
}

@ObjectType()
export class GetUserListPaginationPayload extends PaginationPayload implements PaginateResult<CustomerDetailPayload> {
  @Field(() => [CustomerDetailPayload])
  docs: CustomerDetailPayload[]
}
