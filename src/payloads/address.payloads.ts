import { ObjectType, Field } from 'type-graphql'
import { Province } from '@models/province.model'
import { District } from '@models/district.model'
import { SubDistrict } from '@models/subdistrict.model'

@ObjectType()
export class AddressPayload {
  @Field()
  province: Province

  @Field()
  district: District

  @Field()
  subDistrict: SubDistrict

  @Field()
  postcode: number
}