import { Resolver, Query, UseMiddleware, Arg, Args, Ctx, Int, Subscription, Root, Mutation } from 'type-graphql'
import { AllowGuard } from '@guards/auth.guards'
import { getAutocomplete, getGeocode, getPlaceLocationDetail, getRoute } from '@services/maps/location'
import logger from '@configs/logger'
import { GraphQLError } from 'graphql'
import { LocationAutocomplete } from '@models/locationAutocomplete.model'
import { LocationInput, SearchLocationsArgs } from '@inputs/location.input'
import { AxiosError } from 'axios'
import { get } from 'lodash'
import { Marker } from '@models/marker.model'
import { GraphQLContext } from '@configs/graphQL.config'
import { DirectionsResultPayload } from '@payloads/direction.payloads'
import { ELimiterType, getLatestCount, rateLimiter } from '@configs/rateLimit'
import { LocationRequestLimitPayload } from '@payloads/location.payloads'
import pubsub, { LOCATIONS } from '@configs/pubsub'

const handlePlaceError = (error: any, apiName: string) => {
  if (error instanceof AxiosError) {
    const message = get(error, 'response.data.error.message', undefined)
    const status = get(error, 'response.data.error.status', undefined)
    logger.error(`Error in ${apiName}: ${status}:${message}`)
    throw new GraphQLError(message, { extensions: { code: status, message } })
  } else {
    console.log('error', error)
    logger.error(`Error in searchLocations: `, error)
    throw error
  }
}

const handleGeocodeError = (error: any, apiName: string) => {
  if (error instanceof AxiosError) {
    const message = get(error, 'response.data.error_message', undefined)
    const status = get(error, 'response.data.status', undefined)
    logger.error(`Error in ${apiName}: ${status}:${message}`)
    throw new GraphQLError(message, { extensions: { code: status, message } })
  } else {
    console.log('error', error)
    logger.error(`Error in searchLocations: `, error)
    throw error
  }
}

@Resolver()
export default class LocationResolver {
  @Query(() => [LocationAutocomplete])
  @UseMiddleware(AllowGuard)
  async searchLocations(
    @Args() { query, latitude = 13.6693446, longitude = 100.6058064 }: SearchLocationsArgs,
    @Ctx() ctx: GraphQLContext,
  ): Promise<LocationAutocomplete[]> {
    // UUIDv4 generate form client
    console.log('----- search ip -----', ctx.ip)
    const sessionId = ctx.req.headers['x-location-session']
    if (!sessionId || typeof sessionId !== 'string') {
      throw new GraphQLError('session token are required')
    }
    try {
      const places = await getAutocomplete(ctx, query, latitude, longitude, sessionId)
      return places
    } catch (error) {
      handlePlaceError(error, 'searchLocations')
    }
  }
  // Handle check request data for anonmaus user (limit 20?)
  @Query(() => Marker)
  @UseMiddleware(AllowGuard)
  async locationMarker(@Arg('placeId') placeId: string, @Ctx() ctx: GraphQLContext): Promise<Marker> {
    // UUIDv4 generate form client
    const sessionId = ctx.req.headers['x-location-session']
    if (!sessionId || typeof sessionId !== 'string') {
      throw new GraphQLError('session token are required')
    }
    try {
      const places = await getPlaceLocationDetail(ctx, placeId, sessionId)
      return places
    } catch (error) {
      handlePlaceError(error, 'locationMarker')
    }
  }

  @Query(() => Marker)
  async locationMarkerByCoords(
    @Arg('latitude') latitude: number,
    @Arg('longitude') longitude: number,
    @Ctx() ctx: GraphQLContext,
  ): Promise<Marker> {
    // UUIDv4 generate form client
    const sessionId = ctx.req.headers['x-location-session']
    if (!sessionId || typeof sessionId !== 'string') {
      throw new GraphQLError('session token are required')
    }
    try {
      const location = await getGeocode(ctx, latitude, longitude, sessionId)
      return location
    } catch (error) {
      handleGeocodeError(error, 'getLocationByCoords')
    }
  }

  // Handle check request data for anonmaus user (limit 20?)
  @Query(() => DirectionsResultPayload)
  async calculateRoute(
    @Arg('origin', () => LocationInput) origin: LocationInput,
    @Arg('destinations', () => [LocationInput]) destinations: LocationInput[],
  ): Promise<DirectionsResultPayload> {
    try {
      const routes = await getRoute(origin, destinations)
      return routes
    } catch (error) {
      console.log('error', error)
      logger.error(`Error in searchLocations: `, error)
      throw new GraphQLError(error.message)
    }
  }

  @Mutation(() => LocationRequestLimitPayload)
  @UseMiddleware(AllowGuard)
  async getLimiterBeforeGetDirection(@Ctx() ctx: GraphQLContext): Promise<LocationRequestLimitPayload> {
    const limitCounts = await rateLimiter(ctx.ip, ELimiterType.LOCATION, ctx.req.limit)
    return limitCounts
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AllowGuard)
  async initialRequestLimitCountData(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    const payload = await getLatestCount(ctx.ip, ELimiterType.LOCATION)
    console.log('---initialRequestLimitCountData---', { count: payload, limit: ctx.req.limit })
    await pubsub.publish(LOCATIONS.REQUEST_LIMIT, { count: payload, limit: ctx.req.limit })
    return true
  }

  // Subscript with user
  @Subscription({ topics: LOCATIONS.REQUEST_LIMIT })
  requestLocationLimitCount(@Root() payload: LocationRequestLimitPayload): LocationRequestLimitPayload {
    return payload
  }

  // TODO: / Initial data / public
}
