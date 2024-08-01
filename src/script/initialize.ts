import { get, map } from 'lodash'
import axios from 'axios'
import fs from 'fs'
import { Province } from '@models/province.model'
import { District } from '@models/district.model'
import { SubDistrict } from '@models/subdistrict.model'


(() => {
  function exportToJson(datas: any[], documentName: string) {
    const jsonData = JSON.stringify(datas, null, 2)
    fs.writeFile(`movemate.${documentName}.json`, jsonData, (err) => {
      if (err) {
        console.error('Error: ', err)
      } else {
        console.log(`Write movemate.${documentName}.json success!`)
      }
    })
  }
  async function province() {
    const provinceApi = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province.json'
    const provinceRaw = await axios.get(provinceApi)
    const provinces = get(provinceRaw, 'data', [])
    const reform = map<any, Province>(provinces, (data) => ({
      id: data.id,
      nameTh: data.name_th,
      nameEn: data.name_en,
      geographyId: data.geography_id,
    }))
    exportToJson(reform, 'provinces')
  }
  async function district() {
    const districtApi = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_amphure.json'
    const districtRaw = await axios.get(districtApi)
    const district = get(districtRaw, 'data', [])
    const reform = map<any, District>(district, (data) => ({
      id: data.id,
      nameTh: data.name_th,
      nameEn: data.name_en,
      provinceId: data.province_id,
    }))
    exportToJson(reform, 'districts')
  }
  async function subDistrict() {
    const subdistrictApi = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_tambon.json'
    const subDistrictRaw = await axios.get(subdistrictApi)
    const subDistrict = get(subDistrictRaw, 'data', [])
    const reform = map<any, SubDistrict>(subDistrict, (data) => ({
      id: data.id,
      nameTh: data.name_th,
      nameEn: data.name_en,
      amphureId: data.amphure_id,
      zipCode: data.zip_code,
    }))
    exportToJson(reform, 'subdistricts')
  }

  province()
  district()
  subDistrict()
})()