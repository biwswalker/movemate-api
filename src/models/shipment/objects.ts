import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property } from '@typegoose/typegoose'
import { Location } from '@models/location.model'
import { GraphQLJSONObject } from 'graphql-type-json'

@ObjectType()
export class ShipmentPODAddress {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ required: true })
  fullname: string

  @Field()
  @Property({ required: true })
  address: string

  @Field()
  @Property({ required: true })
  province: string

  @Field()
  @Property({ required: true })
  district: string

  @Field()
  @Property({ required: true })
  subDistrict: string

  @Field()
  @Property({ required: true })
  postcode: string

  @Field()
  @Property({ required: true })
  phoneNumber: string

  @Field({ nullable: true })
  @Property()
  remark: string

  @Field({ nullable: true })
  @Property()
  trackingNumber?: string

  @Field({ nullable: true })
  @Property()
  provider?: string
}

@ObjectType()
export class Destination {
  @Field()
  @Property()
  placeId: string

  @Field()
  @Property()
  name: string

  @Field()
  @Property()
  detail: string

  @Field(() => Location)
  @Property()
  location: Location

  @Field()
  @Property()
  contactName: string

  @Field()
  @Property()
  contactNumber: string

  @Field({ nullable: true })
  @Property()
  customerRemark: string

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property()
  placeDetail: Record<string, any>

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeProvince: string

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeDistrict: string

  @Field({ nullable: true, defaultValue: '' })
  @Property({ default: '' })
  placeSubDistrict: string
}
