import { ObjectType, Field, ID, Float } from 'type-graphql'
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { File } from './file.model'
import { Shipment } from './shipment.model'
import { Transaction } from './transaction.model'
import { User } from './user.model'
import mongoose, { PaginateOptions } from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { GetDriverPaymentArgs } from '@inputs/driver-payment.input'
import { PaginationArgs } from '@inputs/query.input'
import { DriverPaymentAggregatePayload } from '@payloads/driverPayment.payloads'
import { reformPaginate } from '@utils/pagination.utils'
import { DRIVER_PAYMENTS } from '@pipelines/driverPayment.pipeline'
import { BillingDocument } from './finance/documents.model'

@plugin(mongooseAggregatePaginate)
@plugin(mongooseAutoPopulate)
@ObjectType()
export class DriverPayment {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  paymentNumber: string

  @Field()
  @Property()
  whtNumber: string

  @Field({ nullable: true })
  @Property({ required: false })
  whtBookNo: string

  @Field(() => Date, { nullable: true })
  @Property({ required: false })
  receiveReceiptDate: Date

  @Field(() => User)
  @Property({ ref: () => User, autopopulate: true })
  driver: Ref<User>

  @Field(() => [Shipment])
  @Property({ ref: () => Shipment, autopopulate: true })
  shipments: Ref<Shipment>[]

  @Field(() => [Transaction])
  @Property({ ref: () => Transaction, autopopulate: true })
  transactions: Ref<Transaction>[]

  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  imageEvidence: Ref<File, string>

  @Field(() => Date)
  @Property({ required: false })
  paymentDate: Date

  @Field(() => Date)
  @Property({ required: false })
  paymentTime: Date

  @Field(() => Float)
  @Property({ required: false })
  subtotal: number

  @Field(() => Float)
  @Property({ required: false })
  tax: number

  @Field(() => Float)
  @Property({ required: false })
  total: number

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => User)
  @Property({ ref: () => User })
  createdBy: Ref<User>

  @Field(() => BillingDocument, { nullable: true })
  @Property({ ref: () => BillingDocument, autopopulate: true })
  document: Ref<BillingDocument>

  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof DriverPayment>['aggregatePaginate']

  static async getDriverPayments(
    query: GetDriverPaymentArgs,
    paginate: PaginationArgs,
  ): Promise<DriverPaymentAggregatePayload> {
    const { sort = {}, ...reformSorts }: PaginateOptions = reformPaginate(paginate)
    const aggregate = DriverPaymentModel.aggregate(DRIVER_PAYMENTS(query, sort))
    const driverPayments = (await DriverPaymentModel.aggregatePaginate(
      aggregate,
      reformSorts,
    )) as DriverPaymentAggregatePayload

    return driverPayments
  }
}

const DriverPaymentModel = getModelForClass(DriverPayment)

export default DriverPaymentModel
