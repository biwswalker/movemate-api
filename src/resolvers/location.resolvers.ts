import { Resolver, Query, UseMiddleware, Arg, Args, Ctx, Int } from 'type-graphql'
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
import { ELimiterType, rateLimiter } from '@configs/rateLimit'

const handlePlaceError = (error: any, apiName: string) => {
    if (error instanceof AxiosError) {
        const message = get(error, 'response.data.error.message', undefined)
        const status = get(error, 'response.data.error.status', undefined)
        logger.error(`Error in ${apiName}: ${status}:${message}`);
        throw new GraphQLError(message, { extensions: { code: status, message } })
    } else {
        console.log('error', error)
        logger.error(`Error in searchLocations: `, error);
        throw error
    }
}

const handleGeocodeError = (error: any, apiName: string) => {
    if (error instanceof AxiosError) {
        const message = get(error, 'response.data.error_message', undefined)
        const status = get(error, 'response.data.status', undefined)
        logger.error(`Error in ${apiName}: ${status}:${message}`);
        throw new GraphQLError(message, { extensions: { code: status, message } })
    } else {
        console.log('error', error)
        logger.error(`Error in searchLocations: `, error);
        throw error
    }
}

@Resolver()
export default class LocationResolver {

    @Query(() => [LocationAutocomplete])
    @UseMiddleware(AllowGuard)
    async searchLocations(@Args() { query, latitude = 13.6693446, longitude = 100.6058064 }: SearchLocationsArgs, @Ctx() ctx: GraphQLContext): Promise<LocationAutocomplete[]> {
        // UUIDv4 generate form client
        console.log('----- search ip -----', ctx.ip)
        const sessionId = ctx.req.headers['x-location-session']
        if (!sessionId || typeof sessionId !== 'string') { throw new GraphQLError('session token are required') }
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
    async locationMarker(@Arg("placeId") placeId: string, @Ctx() ctx: GraphQLContext): Promise<Marker> {
        // UUIDv4 generate form client
        const sessionId = ctx.req.headers['x-location-session']
        if (!sessionId || typeof sessionId !== 'string') { throw new GraphQLError('session token are required') }
        try {
            const places = await getPlaceLocationDetail(ctx, placeId, sessionId)
            return places
        } catch (error) {
            handlePlaceError(error, 'locationMarker')
        }
    }

    @Query(() => Marker)
    async locationMarkerByCoords(@Arg('latitude') latitude: number, @Arg('longitude') longitude: number, @Ctx() ctx: GraphQLContext): Promise<Marker> {
        // UUIDv4 generate form client
        const sessionId = ctx.req.headers['x-location-session']
        if (!sessionId || typeof sessionId !== 'string') { throw new GraphQLError('session token are required') }
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
            logger.error(`Error in searchLocations: `, error);
            throw new GraphQLError(error.message)
        }
    }

    @Query(() => Int)
    async getLimiterBeforeGetDirection(@Ctx() ctx: GraphQLContext): Promise<number> {
        const { count } = await rateLimiter(ctx.ip, ELimiterType.LOCATION, ctx.req.limit)
        return count
    }

    // TODO: Subscript / Initial data / public
}