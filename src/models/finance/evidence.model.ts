import mongooseAutoPopulate from "mongoose-autopopulate"
import { Field, ObjectType } from "type-graphql"
import { prop as Property, Ref, getModelForClass, plugin } from '@typegoose/typegoose'
import { File } from "@models/file.model"

@plugin(mongooseAutoPopulate)
@ObjectType()
export class PaymentEvidence {
  @Field(() => File)
  @Property({ ref: () => File, autopopulate: true })
  image: Ref<File, string>

  @Field(() => Date)
  @Property({ required: false })
  paymentDate: Date

  @Field(() => Date)
  @Property({ required: false })
  paymentTime: Date

  @Field({ nullable: true })
  @Property()
  bank?: string

  @Field({ nullable: true })
  @Property()
  bankName?: string

  @Field({ nullable: true })
  @Property()
  bankNumber?: string

  @Field({ nullable: true })
  @Property()
  amount?: number
}

const PaymentEvidenceModel = getModelForClass(PaymentEvidence)

export default PaymentEvidenceModel
