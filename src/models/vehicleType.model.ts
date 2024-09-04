import { Field, Float, ID, Int, ObjectType } from "type-graphql";
import {
  prop as Property,
  Ref,
  getModelForClass,
  plugin,
} from "@typegoose/typegoose";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { File } from "./file.model";

enum EVehicleType {
  FOUR_WHEELER = "4W",
  SIX_WHEELER = "6W",
  TEN_WHEELER = "10W",
  OTHER = "other",
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class VehicleType extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  // @Field(() => VehicleCost, { nullable: true })
  // @Property({ allowMixed: Severity.ALLOW })
  // vehicle_cost: Ref<VehicleCost>

  @Field()
  @Property({ enum: EVehicleType, required: true })
  type: TVehicleType;

  @Field({ nullable: true })
  @Property()
  isPublic: boolean;

  @Field({ nullable: true })
  @Property()
  isLarger: boolean;

  @Field()
  @Property({ required: true })
  name: string;

  @Field(() => Float)
  @Property({ required: true })
  width: number;

  @Field(() => Float)
  @Property({ required: true })
  length: number;

  @Field(() => Float)
  @Property({ required: true })
  height: number;

  @Field(() => Float)
  @Property({ required: true })
  maxCapacity: number;

  @Field(() => Int, { defaultValue: 3, nullable: true })
  @Property({ required: true, default: 3 })
  maxDroppoint: number = 3;

  @Field(() => File)
  @Property({ autopopulate: true, ref: 'File' })
  image: Ref<File>

  @Field({ nullable: true })
  @Property()
  details: string;

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const VehicleTypeModel = getModelForClass(VehicleType);

export default VehicleTypeModel;
