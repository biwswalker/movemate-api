import { Field, Float, ID, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses"
import mongooseAutoPopulate from "mongoose-autopopulate"
import BillingCycleModel, { BillingCycle, EBillingStatus } from "./billingCycle.model"
import { EPaymentStatus } from "./payment.model"
import UserModel, { EUserStatus } from "./user.model"

export enum EBillingPaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  FAILED = 'failed',
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class BillingPayment extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  paymentNumber: string

  @Field(() => Float)
  @Property({ required: true })
  paymentAmount: number;

  @Field()
  @Property({ required: true })
  paymentDate: Date;

  @Field()
  @Property({ enum: EBillingPaymentStatus, required: true })
  status: EBillingPaymentStatus;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  async processPayment(userId: string, billingCycleId: string, paymentAmount: number) {
    const billingCycle = await BillingCycleModel.findById(billingCycleId);
    if (billingCycle) {
      const payment = new BillingPaymentModel({
        paymentNumber: '',
        paymentAmount,
        paymentDate: new Date(),
        status: EBillingPaymentStatus.PAID,
      });
      await payment.save();

      await billingCycle.updateOne({
        billingPayment: payment,
        billingStatus: EBillingStatus.PAID
      })

      await UserModel.findByIdAndUpdate(userId, { static: EUserStatus.ACTIVE })
    }
  }
}

const BillingPaymentModel = getModelForClass(BillingPayment)

export default BillingPaymentModel
