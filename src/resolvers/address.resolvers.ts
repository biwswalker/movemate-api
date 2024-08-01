import { Resolver, Arg, Query, Int } from 'type-graphql'
import ProvinceModel, { Province } from '@models/province.model'
import DistrictModel, { District } from '@models/district.model'
import SubDistrictModel, { SubDistrict } from '@models/subdistrict.model'
import { AddressPayload } from '@payloads/address.payloads'

@Resolver()
export default class AddressResolver {
  @Query(() => [Province])
  async getProvince(): Promise<Province[]> {
    try {
      const provinces = await ProvinceModel.find()
      return provinces
    } catch (error) {
      console.log('error: ', error)
      return []
    }
  }
  @Query(() => [District])
  async getDistrict(@Arg("provinceThName", { nullable: true }) provinceThName?: string): Promise<District[]> {
    try {
      if (provinceThName) {
        const provinces = await ProvinceModel.findOne({ nameTh: provinceThName })
        const district = await DistrictModel.find({ provinceId: provinces.id })
        return district
      } else {
        const district = await DistrictModel.find()
        return district
      }
    } catch (error) {
      console.log('error: ', error)
      return []
    }
  }
  @Query(() => [SubDistrict])
  async getSubDistrict(@Arg("districtName", { nullable: true }) districtName?: string): Promise<SubDistrict[]> {
    try {
      if (districtName) {
        const district = await DistrictModel.findOne({ nameTh: districtName })
        const subDistrict = await SubDistrictModel.find({ amphureId: district.id })
        return subDistrict
      } else {
        const subDistrict = await SubDistrictModel.find()
        return subDistrict
      }
    } catch (error) {
      console.log('error: ', error)
      return []
    }
  }
  // [WIP]
  @Query(() => AddressPayload)
  async getAddressByPostcode(@Arg("postcode", () => Int!) postcode: number): Promise<AddressPayload> {
    try {
      const subDistrict = await SubDistrictModel.findOne({ zipCode: postcode })
      const district = await DistrictModel.findOne({ id: subDistrict.amphureId })
      const province = await ProvinceModel.findOne({ id: district.id })
      return {
        subDistrict,
        district,
        province,
        postcode,
      }
    } catch (error) {
      console.log('error: ', error)
      throw error
    }
  }
}
