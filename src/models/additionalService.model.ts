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
import { filter, isEqual, reduce } from "lodash";
import { VehicleType } from "./vehicleType.model";
import mongoose, { Types } from "mongoose";
import mongoosePagination from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { EServiceStatus, EServiceType } from "@enums/additionalService";



@plugin(mongooseAutoPopulate)
@plugin(mongoosePagination)
@plugin(aggregatePaginate)
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

  static async findByVehicleTypeID(id: string): Promise<AdditionalService[]> {
    const additionalServices = await AdditionalServiceModel.find().sort({
      permanent: -1,
    });
    const additionalServicesFilter = filter(additionalServices, (service) => {
      // Change this additional service included VehicleType descriptions
      const isIncludedVehicleType = reduce(
        service.descriptions as AdditionalServiceDescription[],
        (prev, curr) => {
          if (!prev) {
            const filterdVehicleType = filter(
              curr.vehicleTypes as VehicleType[],
              (type) => isEqual(type._id, new Types.ObjectId(id))
            );
            return filterdVehicleType.length > 0;
          }
          return true;
        },
        false
      );
      return isIncludedVehicleType;
    });

    return additionalServicesFilter;
  }
  static paginate: mongoose.PaginateModel<typeof AdditionalService>['paginate']
  static aggregatePaginate: mongoose.AggregatePaginateModel<typeof AdditionalService>['aggregatePaginate']
}

const AdditionalServiceModel = getModelForClass(AdditionalService);

export default AdditionalServiceModel;
