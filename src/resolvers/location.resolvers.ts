import { Resolver, Query, UseMiddleware, Arg, Args, Ctx, Subscription, Root, Mutation } from 'type-graphql'
import { AllowGuard } from '@guards/auth.guards'
import { getAutocomplete, getGeocode, getPlaceLocationDetail, getRoute } from '@services/maps/location'
import logger from '@configs/logger'
import { GraphQLError } from 'graphql'
import { LocationAutocomplete } from '@models/locationAutocomplete.model'
import { LocationInput, SearchLocationsArgs } from '@inputs/location.input'
import { AxiosError } from 'axios'
import { get } from 'lodash'
import { Marker } from '@models/marker.model'
import { AuthContext, GraphQLContext } from '@configs/graphQL.config'
import { DirectionsResultPayload } from '@payloads/direction.payloads'
import { ELimiterType, getLatestCount, rateLimiter } from '@configs/rateLimit'
import { LocationRequestLimitPayload } from '@payloads/location.payloads'
import pubsub, { LOCATIONS } from '@configs/pubsub'
import UserModel, { EUserType } from '@models/user.model'
import { RequestLimiterGuard } from '@guards/limiter.guards'
import { Repeater } from '@graphql-yoga/subscription'

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
  @UseMiddleware(RequestLimiterGuard)
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
  @UseMiddleware(RequestLimiterGuard)
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
  @UseMiddleware(AllowGuard)
  @UseMiddleware(RequestLimiterGuard)
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

  @Mutation(() => LocationRequestLimitPayload)
  @UseMiddleware(AllowGuard)
  @UseMiddleware(RequestLimiterGuard)
  async verifyLimiterBeforeGetDirection(@Ctx() ctx: GraphQLContext): Promise<LocationRequestLimitPayload> {
    const limitCounts = await rateLimiter(ctx.ip, ELimiterType.LOCATION, ctx.req.limit, ctx.req.user_id || '')
    return limitCounts
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AllowGuard)
  async initialRequestLimitCountData(@Ctx() ctx: GraphQLContext): Promise<boolean> {
    const payload = await getLatestCount(ctx.ip, ELimiterType.LOCATION, ctx.req.user_id || '')
    let limit = 10
    if (ctx.req.user_id) {
      const userModel = await UserModel.findById(ctx.req.user_id)
      if (userModel) {
        limit =
          userModel.userType === EUserType.BUSINESS
            ? -1 // -1 mean Infinity
            : userModel.userType === EUserType.INDIVIDUAL
            ? 20
            : 10
      }
    }
    await pubsub.publish(LOCATIONS.REQUEST_LIMIT, { count: payload, limit })
    return true
  }

  // Subscript with user
  @Subscription({
    topics: LOCATIONS.REQUEST_LIMIT,
    subscribe: async ({ context }) => {
      console.log('listenLocationLimitCount subscribe:', context)
      const repeater = new Repeater(async (push, stop) => {
        const payload = await getLatestCount(context.ip, ELimiterType.LOCATION, context.user_id || '')
        let limit = 10
        if (context.user_id) {
          const userModel = await UserModel.findById(context.user_id)
          if (userModel) {
            limit =
              userModel.userType === EUserType.BUSINESS
                ? -1 // -1 mean Infinity
                : userModel.userType === EUserType.INDIVIDUAL
                ? 20
                : 10
          }
        }
        push({ count: payload, limit })
        await stop
      })
      return Repeater.merge([repeater, pubsub.subscribe(LOCATIONS.REQUEST_LIMIT)])
    },
  } as any)
  listenLocationLimitCount(@Root() payload: LocationRequestLimitPayload, @Ctx() ctx: AuthContext): LocationRequestLimitPayload {
    console.log('listenLocationLimitCount payload', payload)
    return payload
  }

  /**
   * @deprecated Recheck Handle check request data for anonmaus user (limit 20?)
   * @param origin
   * @param destinations
   * @returns
   */
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
}
