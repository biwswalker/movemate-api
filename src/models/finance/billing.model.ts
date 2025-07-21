import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, Ref, Severity, getModelForClass, plugin } from '@typegoose/typegoose'
import { IsEnum } from 'class-validator'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { User } from '@models/user.model'
import { Shipment } from '@models/shipment.model'
import { Payment } from './payment.model'
import { Receipt } from './receipt.model'
import { EBillingState, EBillingStatus } from '@enums/billing'
import { BillingAdjustmentNote } from './billingAdjustmentNote.model'
import { EPaymentMethod, EPaymentType } from '@enums/payments'
import { BillingReason, PaymentAmounts } from './objects'
import { filter, get, last, sortBy } from 'lodash'
import { Invoice } from './invoice.model'
import { AggregatePaginateModel, PaginateModel } from 'mongoose'
import mongoosePagination from 'mongoose-paginate-v2'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { Quotation } from './quotation.model'

/**
 * TODO:
 * - Create logs for update
 */
@plugin(mongooseAutoPopulate)
@plugin(mongoosePagination)
@plugin(mongooseAggregatePaginate)
@ObjectType()
export class Billing extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  billingNumber: string

  @Field(() => EBillingStatus)
  @IsEnum(EBillingStatus)
  @Property({ enum: EBillingStatus, default: EBillingStatus.PENDING })
  status: EBillingStatus

  @Field(() => EBillingState)
  @IsEnum(EBillingState)
  @Property({ enum: EBillingState, default: EBillingState.CURRENT })
  state: EBillingState

  @Field(() => EPaymentMethod)
  @Property({ enum: EPaymentMethod, required: true })
  paymentMethod: EPaymentMethod

  @Field(() => User)
  @Property({ ref: () => User, required: true, autopopulate: true })
  user: Ref<User>

  @Field(() => [Shipment])
  @Property({ ref: () => Shipment, required: true, autopopulate: true })
  shipments: Ref<Shipment>[]

  @Field(() => [Payment], { defaultValue: [] })
  @Property({ ref: () => Payment, autopopulate: true, default: [] })
  payments: Ref<Payment>[]

  @Field(() => [Receipt], { defaultValue: [] })
  @Property({ ref: () => Receipt, autopopulate: true, default: [] })
  receipts: Ref<Receipt>[]

  @Field(() => [BillingAdjustmentNote], { defaultValue: [] })
  @Property({ ref: () => BillingAdjustmentNote, autopopulate: true, default: [] })
  adjustmentNotes: Ref<BillingAdjustmentNote>[]

  @Field(() => [BillingReason], { defaultValue: [], nullable: true })
  @Property({ allowMixed: Severity.ALLOW, default: [] })
  reasons: BillingReason[]

  @Field(() => Invoice, { nullable: true })
  @Property({ ref: () => Invoice, autopopulate: true })
  invoice: Ref<Invoice>

  @Field()
  @Property({ required: true })
  issueDate: Date

  @Field()
  @Property({ required: true })
  billingStartDate: Date

  @Field()
  @Property({ required: true })
  billingEndDate: Date

  @Field({ nullable: true })
  @Property()
  paymentDueDate?: Date

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Field(() => User, { nullable: true })
  @Property({ ref: () => User, autopopulate: true })
  updatedBy: Ref<User>

  @Field(() => PaymentAmounts, { nullable: true })
  get amount(): PaymentAmounts {
    // --- สำหรับลูกค้าเครดิต ---
    const _paymentMethod = get(this, '_doc.paymentMethod', this.paymentMethod)
    if (_paymentMethod === EPaymentMethod.CREDIT) {
      const adjustmentNotes = get(this, '_doc.adjustmentNotes', this.adjustmentNotes || []) as BillingAdjustmentNote[]
      const lastAdjustmentNote = last(sortBy(adjustmentNotes, 'issueDate'))

      if (lastAdjustmentNote) {
        // ถ้ามีใบปรับปรุง ให้ใช้ยอดจากใบปรับปรุงล่าสุด
        return {
          total: lastAdjustmentNote.totalAmount,
          subTotal: lastAdjustmentNote.newSubTotal,
          tax: lastAdjustmentNote.taxAmount,
        }
      }

      const invoice = get(this, '_doc.invoice', this.invoice) as Invoice | undefined
      if (invoice) {
        return { total: invoice.total ?? 0, subTotal: invoice.subTotal ?? 0, tax: invoice.tax ?? 0 }
      }
    }

    // --- สำหรับลูกค้าเงินสด (ใช้ Logic เดิม) ---
    const payments = get(this, '_doc.payments', this.payments || []) as Payment[]
    const latestPayment = last(sortBy(payments, 'createdAt'))
    if (latestPayment) {
      return {
        total: latestPayment.total ?? 0,
        subTotal: latestPayment.subTotal ?? 0,
        tax: latestPayment.tax ?? 0,
      }
    }

    return { total: 0, subTotal: 0, tax: 0 }
  }

  @Field(() => Quotation, { nullable: true })
  get quotation(): Quotation {
    const _payments = get(this, '_doc.payments', this.payments || []) as Payment[]
    const latestPayment = last(
      sortBy(
        filter(_payments, (_payment) => _payment.type === EPaymentType.PAY),
        ['createdAt'],
      ),
    ) as Payment | undefined

    if (latestPayment) {
      const quotation = last(sortBy(latestPayment.quotations, 'createdAt')) as Quotation | undefined
      return quotation
    }
    return undefined
  }

  static paginate: PaginateModel<typeof Billing>['paginate']
  static aggregatePaginate: AggregatePaginateModel<typeof Billing>['aggregatePaginate']
}

const BillingModel = getModelForClass(Billing)

export default BillingModel
