import { Field, ID, ObjectType } from "type-graphql";
import {
  Ref,
  plugin,
  prop as Property,
  getModelForClass,
} from "@typegoose/typegoose";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { IsEnum } from "class-validator";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { AdditionalServiceDescription } from "./additionalServiceDescription.model";

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
  @Property({ autopopulate: true, ref: () => AdditionalServiceDescription })
  descriptions: Ref<AdditionalServiceDescription>[];

  @Field()
  @Property({ default: Date.now })
  createdAt: Date;

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date;
}

const AdditionalServiceModel = getModelForClass(AdditionalService);

export default AdditionalServiceModel;