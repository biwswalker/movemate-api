import axios from 'axios'
import {
  GOOGLEAPI_AUTOCOMPLETE,
  GOOGLEAPI_DIRECTIONS,
  GOOGLEAPI_GEOCODE,
  GOOGLEAPI_PLACE_DETAIL,
  GOOGLEAPI_ROUTE_DIRECTIONS,
} from './constants'
import { forEach, get, includes, map } from 'lodash'
import MarkerModel, { Marker } from '@models/marker.model'
import LocationAutocompleteModel, { LocationAutocomplete } from '@models/locationAutocomplete.model'
import { loadCache, saveCache } from '@configs/cache'
import logger from '@configs/logger'
import { LocationInput } from '@inputs/location.input'
import SearchHistoryModel, { SearchHistory } from '@models/searchHistory.model'
import { GraphQLContext } from '@configs/graphQL.config'
import { getLatestCount, ELimiterType } from '@configs/rateLimit'

const instance = axios.create()

instance.interceptors.response.use(
  (value) => {
    return value
  },
  (error) => {
    // Handle request error
    console.log('axios error: ', error)
    return Promise.reject(error)
  },
)

// const removePlusCode = (formattedAddress: string) => {
//   if (formattedAddress) {
//     // Split the address into parts
//     const parts = formattedAddress.split(' ')
//     // Check if the first part is a Plus Code by using a regex pattern
//     const plusCodePattern = /^[A-Z0-9\+]+$/
//     // Plus Codes are typically alphanumeric and contain a '+' sign
//     if (parts[0].match(plusCodePattern) && parts[0].includes('+')) {
//       parts.shift() // Remove the first part if it's a Plus Code
//     }
//     // Join the remaining parts back into a single string
//     const cleanedAddress = parts.join(' ')
//     return cleanedAddress
//   }
//   return ''
// }

async function saveSearchingLog(detail: Omit<SearchHistory, '_id' | 'createdAt' | 'updatedAt'>) {
  const searchHistory = new SearchHistoryModel(detail)
  await searchHistory.save()
}

/**
 *
 * @param query for search location
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 * @returns locations
 */
export async function getAutocomplete(
  ctx: GraphQLContext,
  query: string,
  latitude: number,
  longitude: number,
  session?: string,
): Promise<LocationAutocomplete[]> {
  // Get cache
  const inputString = JSON.stringify({ query, latitude, longitude, session })
  const userId = ctx.req.user_id
  const ip = ctx.ip
  const limit = ctx.req.limit
  const cacheType = 'places'
  const key = `${query}:${latitude}:${longitude}`
  const cached = await loadCache(cacheType, key)
  const count = await getLatestCount(ip, ELimiterType.LOCATION, ctx.req.user_id)
  if (cached) {
    // const count = await getLatestCount(ip, ELimiterType.LOCATION)
    await saveSearchingLog({
      ipaddress: ip,
      isCache: true,
      inputRaw: inputString,
      resultRaw: JSON.stringify(cached),
      count,
      limit,
      type: cacheType,
      user: userId,
    })
    logger.info('Cache hit for searchLocations')
    return cached
  }

  // Limit check
  // const { count } = await rateLimiter(ip, ELimiterType.LOCATION, limit)
  const request = {
    input: query,
    regionCode: 'th',
    languageCode: 'th',
    includedRegionCodes: ['th'],
    locationBias: { circle: { center: { latitude, longitude }, radius: 500 } },
    ...(session ? { sessionToken: session } : {}),
  }

  const response = await instance.post<{ suggestions: google.maps.places.AutocompleteSuggestion[] }>(
    GOOGLEAPI_AUTOCOMPLETE,
    request,
    { headers: { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY } },
  )
  const locations = map<google.maps.places.AutocompleteSuggestion, LocationAutocomplete>(
    response.data.suggestions,
    (suggestion) => {
      const placePrediction = suggestion.placePrediction
      return new LocationAutocompleteModel({
        name: placePrediction.text.text,
        description: get(placePrediction, 'structuredFormat.secondaryText.text', ''),
        placeId: placePrediction.placeId,
      })
    },
  )

  await saveCache(cacheType, key, locations)
  await saveSearchingLog({
    ipaddress: ip,
    isCache: false,
    inputRaw: inputString,
    resultRaw: JSON.stringify(locations),
    count,
    limit,
    type: cacheType,
    user: userId,
  })
  return locations
}

export function extractThaiAddress(addressComponents: google.maps.places.AddressComponent[]): {
  province: string
  district: string
  subDistrict: string
  country: string
  postalCode: string
} {
  let province = ''
  let district = ''
  let subDistrict = ''
  let country = ''
  let postalCode = ''

  forEach(addressComponents, (address) => {
    if (includes(address.types, 'administrative_area_level_1')) {
      province = address.longText
    } else if (includes(address.types, 'administrative_area_level_2')) {
      district = address.longText
    } else if (includes(address.types, 'sublocality_level_1') || includes(address.types, 'locality')) {
      subDistrict = address.longText
    } else if (includes(address.types, 'country')) {
      country = address.longText
    } else if (includes(address.types, 'postal_code')) {
      postalCode = address.longText
    }
  })

  return {
    province,
    district,
    subDistrict,
    country,
    postalCode,
  }
}

/**
 *
 * @param placeId for get place detail
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getPlaceLocationDetail(ctx: GraphQLContext, placeId: string, session?: string): Promise<Marker> {
  // Get cache
  const inputString = JSON.stringify({ placeId, session })
  const userId = ctx.req.user_id
  const ip = ctx.ip
  const limit = ctx.req.limit
  const cacheType = 'place-detail'
  const count = await getLatestCount(ip, ELimiterType.LOCATION, ctx.req.user_id)

  const { place, cache } = await getPlaceDetail(placeId, session)

  console.log(JSON.stringify(place, undefined, 2))

  const { displayName, formattedAddress, location } = place

  const marker = new MarkerModel({
    placeId,
    displayName: get(place, 'displayName.text', '') || displayName,
    formattedAddress: get(place, 'shortFormattedAddress', '') || formattedAddress,
    latitude: get(location, 'latitude', undefined) || location.lat(),
    longitude: get(location, 'longitude', undefined) || location.lng(),
  })

  await saveSearchingLog({
    ipaddress: ip,
    isCache: cache,
    inputRaw: inputString,
    resultRaw: JSON.stringify(marker),
    count,
    limit,
    type: cacheType,
    user: userId,
  })

  return marker
}

/**
 *
 * @param placeId for get place detail
 * @url Document - https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getPlaceDetail(
  placeId: string,
  session?: string,
): Promise<{ place: google.maps.places.Place; cache: boolean }> {
  // Get cache
  const cacheType = 'place-detail'
  const cached = await loadCache(cacheType, placeId)
  if (cached) {
    logger.info('Cache hit for locationMarker')
    return { place: cached, cache: false }
  }
  const params = { languageCode: 'th', regionCode: 'th', fields: '*', ...(session ? { sessionToken: session } : {}) }
  const headers = { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY }
  const response = await instance.get<google.maps.places.Place>(`${GOOGLEAPI_PLACE_DETAIL}/${placeId}`, {
    params,
    headers,
  })
  const place = response.data
  await saveCache(cacheType, placeId, place)
  return { place, cache: false }
}

/**
 *
 * @param latitude
 * @param longitude
 * @param session
 * @returns
 * @url Document - https://developers.google.com/maps/documentation/geocoding/address-descriptors/requests-address-descriptors
 */
export async function getGeocode(ctx: GraphQLContext, latitude: number, longitude: number, session?: string) {
  // Get cache
  const inputString = JSON.stringify({ latitude, longitude, session })
  const ip = ctx.ip
  const limit = ctx.req.limit
  const userId = ctx.req.user_id
  const cacheType = 'geocode'
  const key = `${latitude}:${longitude}`
  const cached = await loadCache(cacheType, key)
  const count = await getLatestCount(ip, ELimiterType.LOCATION, ctx.req.user_id)
  if (cached) {
    // const count = await getLatestCount(ip, ELimiterType.LOCATION, ctx.req.user_id)
    await saveSearchingLog({
      ipaddress: ip,
      isCache: true,
      inputRaw: inputString,
      resultRaw: JSON.stringify(cached),
      count,
      limit,
      type: cacheType,
      user: userId,
    })
    logger.info('Cache hit for getLocationByCoords')
    return cached
  }

  // Limit check
  // const { count } = await rateLimiter(ip, ELimiterType.LOCATION, limit, userId || '')

  const response = await instance.get<google.maps.GeocoderResponse>(GOOGLEAPI_GEOCODE, {
    params: {
      latlng: `${latitude},${longitude}`,
      key: process.env.GOOGLE_MAP_API_KEY,
      language: 'th',
      region: 'th',
      extra_computations: 'ADDRESS_DESCRIPTORS',
      ...(session ? { sessionToken: session } : {}),
    },
  })

  const result = get(response, 'data.results.0', undefined) as google.maps.GeocoderResult | undefined
  const { place } = await getPlaceDetail(result?.place_id, session)
  const { displayName, formattedAddress, location, id } = place
  const marker = new MarkerModel({
    placeId: place.id,
    displayName: get(place, 'displayName.text', '') || displayName,
    formattedAddress: get(place, 'shortFormattedAddress', '') || formattedAddress,
    latitude: get(location, 'latitude', undefined) || location.lat(),
    longitude: get(location, 'longitude', undefined) || location.lng(),
  })

  await saveCache(cacheType, key, marker)
  await saveSearchingLog({
    ipaddress: ip,
    isCache: false,
    inputRaw: inputString,
    resultRaw: JSON.stringify(marker),
    count,
    limit,
    type: cacheType,
    user: userId,
  })
  return marker
}

/**
 * @param origin
 * @param destinations
 * @returns
 */
export async function getRoute(
  origin: LocationInput,
  destinations: LocationInput[],
): Promise<google.maps.DirectionsResult> {
  // Get cache
  const cacheType = 'routes'
  const key = `${origin.latitude}:${origin.longitude}:${destinations
    .map((desti) => `${desti.latitude}:${desti.longitude}`)
    .join(':')}`
  const cached = await loadCache(cacheType, key)
  if (cached) {
    logger.info('Cache hit for getRoute')
    // console.log('cached:', JSON.stringify(cached))
    return cached
  }
  // ------

  const originStr = `${origin.latitude},${origin.longitude}`
  const waypointsStrArray = destinations.map((point) => `${point.latitude},${point.longitude}`)

  const waypoints = waypointsStrArray.slice(0, -1).join('|')
  const finalDestination = waypointsStrArray[waypointsStrArray.length - 1]

  try {
    const response = await instance.get<google.maps.DirectionsResult>(GOOGLEAPI_DIRECTIONS, {
      params: {
        origin: originStr,
        destination: finalDestination,
        waypoints: waypoints ? `optimize:true|${waypoints}` : undefined,
        key: process.env.GOOGLE_MAP_API_KEY,
        avoid: 'tolls', // TODO: Possible to add config of admin web e.g. tolls|highways|ferries|indoor
        mode: 'driving',
        language: 'th',
        region: 'th',
        units: 'metric',
      },
    })

    const data = response.data
    // console.log('\n', JSON.stringify(data), '\n')
    await saveCache(cacheType, key, data)
    return data
  } catch (error) {
    throw error
  }
}

/**
 * V2
 * @param origin
 * @param destinations
 * @returns
 */
export async function getRouteV2(
  origin: LocationInput,
  destinations: LocationInput[],
): Promise<google.maps.DirectionsResult> {
  // Get cache
  const cacheType = 'routes'
  const key = `${origin.latitude}:${origin.longitude}:${destinations
    .map((desti) => `${desti.latitude}:${desti.longitude}`)
    .join(':')}`
  const cached = await loadCache(cacheType, key)
  if (cached) {
    logger.info('Cache hit for getRoute')
    console.log('cached:', JSON.stringify(cached))
    return cached
  }

  const waypoints = destinations.slice(0, -1)
  const destination = destinations[destinations.length - 1]

  const data = {
    origin: { location: { latLng: origin } },
    destination: { location: { latLng: destination } },
    ...(waypoints ? { intermediates: waypoints.map((point) => ({ location: { latLng: point } })) } : {}),
    travelMode: 'DRIVE',
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    languageCode: 'th-TH',
    regionCode: 'th',
    units: 'METRIC',
  }
  const headers = { 'X-Goog-Api-Key': process.env.GOOGLE_MAP_API_KEY, 'X-Goog-FieldMask': '*' }

  try {
    const response = await instance.post<google.maps.DirectionsResult>(GOOGLEAPI_ROUTE_DIRECTIONS, data, { headers })
    const resp = response.data
    console.log('\n', JSON.stringify(data, undefined, 2), '\n')
    await saveCache(cacheType, key, resp)
    return resp
  } catch (error) {
    throw error
  }
}
