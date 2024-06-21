import { Field, Float, ID, ObjectType } from "type-graphql";
import { prop as Property, Ref, getModelForClass, plugin } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { IsEnum, IsNotEmpty } from "class-validator";
import { UpdateHistory } from "./UpdateHistory.model";
import mongooseAutoPopulate from "mongoose-autopopulate";

enum EDistanceCostPricingUnit {
  LUMSUM = "lumpsum",
  KM = "km",
}

@ObjectType()
@plugin(mongooseAutoPopulate)
export class DistanceCostPricing extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field(() => Float)
  @Property({ required: true })
  from: number;

  @Field(() => Float)
  @Property()
  to: number;

  @Field()
  @IsEnum(EDistanceCostPricingUnit)
  @IsNotEmpty()
  @Property({
    enum: EDistanceCostPricingUnit,
    default: EDistanceCostPricingUnit.KM,
    required: true,
  })
  unit: TDistanceCostPricingUnit;

  @Field(() => Float)
  @Property({ required: true })
  cost: number;

  @Field(() => Float)
  @Property({ required: true })
  price: number;

  @Field(() => Float) // As Percent
  @Property({ required: true })
  benefits: number;

  @Field(() => [UpdateHistory])
  @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
  history: Ref<UpdateHistory>[];

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const DistanceCostPricingModel = getModelForClass(DistanceCostPricing);

export default DistanceCostPricingModel;
