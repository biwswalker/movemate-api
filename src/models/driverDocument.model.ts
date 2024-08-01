import { ObjectType, Field, ID } from "type-graphql";
import { prop as Property, Ref, getModelForClass, plugin } from "@typegoose/typegoose";
import mongooseAutoPopulate from "mongoose-autopopulate";
import { File } from "./file.model";

@plugin(mongooseAutoPopulate)
@ObjectType()
export class DriverDocument {
  @Field(() => ID)
  readonly _id: string;

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  frontOfVehicle: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  backOfVehicle: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  leftOfVehicle: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  rigthOfVehicle: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyVehicleRegistration: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyIDCard: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyDrivingLicense: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyBookBank?: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  copyHouseRegistration?: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  insurancePolicy?: Ref<File>

  @Field(() => File, { nullable: true })
  @Property({ ref: () => File, autopopulate: true })
  criminalRecordCheckCert?: Ref<File>
}

const DriverDocumentModel = getModelForClass(DriverDocument);

export default DriverDocumentModel;
