import { Field, ID, ObjectType } from "type-graphql";
import {
  Ref,
  plugin,
  prop as Property,
  getModelForClass,
  Severity,
} from "@typegoose/typegoose";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { IsEnum } from "class-validator";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { VehicleType } from "./vehicleType.model";
import { Schema } from "mongoose";

enum EServiceType {
  SERVICES = "services",
  ACCESSORIES = "accessories",
}

enum EServiceStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@plugin(mongooseAutoPopulate)
@ObjectType()
class AdditionalServiceDescription {
  @Field()
  @Property()
  detail: string;

  @Field(() => [VehicleType])
  @Property({
    autopopulate: true,
    ref: () => VehicleType,
    type: Schema.Types.ObjectId,
  })
  vehicleTypes: Ref<VehicleType, string>[];
}

@plugin(mongooseAutoPopulate)
@ObjectType()
export class AdditionalService extends TimeStamps {
  @Field(() => ID)
  readonly _id: string;

  @Field()
  @IsEnum(EServiceType)
  @Property({
    enum: EServiceType,
    default: EServiceType.SERVICES,
    required: true,
  })
  type: TServiceType;

  @Field()
  @Property({ required: true })
  name: string;

  @Field()
  @Property({ default: false })
  permanent: boolean;

  @Field()
  @Property({
    enum: EServiceStatus,
    default: EServiceStatus.ACTIVE,
    required: true,
  })
  status: TServiceStatus;

  @Field(() => [AdditionalServiceDescription])
  @Property({ allowMixed: Severity.ALLOW })
  descriptions: AdditionalServiceDescription[];

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const AdditionalServiceModel = getModelForClass(AdditionalService);

export default AdditionalServiceModel;