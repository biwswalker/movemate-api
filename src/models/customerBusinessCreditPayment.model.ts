import { ObjectType, Field, ID, Int, Float } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass, plugin } from '@typegoose/typegoose'
import { File } from './file.model'
import autopopulate from 'mongoose-autopopulate'
import { IsEnum, IsNotEmpty } from 'class-validator'
import { ECreditBillingCycleType, ECreditDataStatus } from '@enums/users'

@ObjectType()
export class MonthlyBillingCycle {
  @Field(() => Int)
  @Property()
  issueDate: number

  @Field(() => Int)
  @Property()
  dueDate: number

  @Field(() => Int)
  @Property()
  dueMonth: number
}

@ObjectType()
export class YearlyBillingCycle {
  @Field(() => MonthlyBillingCycle)
  @Property()
  jan: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  feb: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  mar: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  apr: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  may: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  jun: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  jul: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  aug: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  sep: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  oct: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  nov: MonthlyBillingCycle

  @Field(() => MonthlyBillingCycle)
  @Property()
  dec: MonthlyBillingCycle
}

@plugin(autopopulate)
@ObjectType()
export class BusinessCustomerCreditPayment {
  @Field(() => ID)
  readonly _id: string

  @Field({ nullable: true })
  @IsEnum(ECreditDataStatus)
  @Property({ enum: ECreditDataStatus, default: ECreditDataStatus.ACTIVE })
  readonly dataStatus: ECreditDataStatus

  // Credit
  @Field({ nullable: true })
  @Property({ default: false })
  isSameAddress: boolean

  @Field()
  @Property({ required: true })
  financialFirstname: string

  @Field()
  @Property({ required: true })
  financialLastname: string

  @Field()
  @Property({ required: true })
  financialContactNumber: string

  @Field(() => [String])
  @Property({ required: true, allowMixed: Severity.ALLOW })
  financialContactEmails: string[]

  @Field()
  @Property({ required: true })
  financialAddress: string

  @Field()
  @Property({ required: true })
  financialPostcode: string

  @Field()
  @Property({ required: true })
  financialProvince: string

  @Field()
  @Property({ required: true })
  financialDistrict: string

  @Field()
  @Property({ required: true })
  financialSubDistrict: string

  @Field()
  @IsEnum(ECreditBillingCycleType)
  @IsNotEmpty()
  @Property({ enum: ECreditBillingCycleType, default: ECreditBillingCycleType.DEFAULT, required: true })
  billingCycleType: ECreditBillingCycleType

  @Field((type) => YearlyBillingCycle)
  @Property({ required: true })
  billingCycle: YearlyBillingCycle

  @Field({ nullable: true })
  @Property()
  acceptedFirstCreditTermDate: Date

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  businessRegistrationCertificateFile: Ref<File>

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  copyIDAuthorizedSignatoryFile: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  certificateValueAddedTaxRegistrationFile: Ref<File>

  // Credit
  @Field(() => Float)
  @Property({ required: true })
  creditLimit: number

  @Field(() => Float)
  @Property({ required: true })
  creditUsage: number

  @Field(() => Float, { defaultValue: 0 })
  @Property({ required: true, default: 0 })
  creditOutstandingBalance: number
}

const BusinessCustomerCreditPaymentModel = getModelForClass(BusinessCustomerCreditPayment)

export default BusinessCustomerCreditPaymentModel
