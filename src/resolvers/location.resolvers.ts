import { Resolver, Query, UseMiddleware, Arg, Args } from 'type-graphql'
import { AllowGuard } from '@guards/auth.guards'
import { getAutocomplete, getCalculateRoute, getGeocode } from '@services/maps/location'
import { Location } from '@models/location.model'
import logger from '@configs/logger'
import { loadCache, saveCache } from '@configs/cache'
import { Route } from '@models/route.mode'
import { GraphQLError } from 'graphql'
import { LocationAutocomplete } from '@models/locationAutocomplete.model'
import { SearchLocationsArgs } from '@inputs/location.input'
import { AxiosError } from 'axios'
import { get } from 'lodash'

@Resolver()
export default class LocationResolver {
    // Handle check request data for anonmaus user (limit 20?)
    @Query(() => [LocationAutocomplete])
    @UseMiddleware(AllowGuard)
    async searchLocations(@Args() { query, latitude = 13.6693446, longitude = 100.6058064 }: SearchLocationsArgs): Promise<LocationAutocomplete[]> {
        try {
            const cacheType = 'places';
            const key = `${query}:${latitude}:${longitude}`;
            const cached = await loadCache(cacheType, key);
            if (cached) {
                logger.info('Cache hit for searchLocations');
                return cached;
            }

            const places = await getAutocomplete(query, latitude, longitude)
            await saveCache(cacheType, key, places);
            return places
        } catch (error) {
            if (error instanceof AxiosError) {
                const message = get(error, 'response.data.error.message', undefined)
                const status = get(error, 'response.data.error.status', undefined)
                logger.error(`Error in searchLocations: ${status}:${message}`);
                throw new GraphQLError(message || `Error in searchLocations: ${error}`, { extensions: { code: status, message } })
            } else {
                console.log('error', error)
                logger.error(`Error in searchLocations: `, error);
                throw new GraphQLError(error.message || `Error in searchLocations: ${error}`)
            }
        }
    }

    // Handle check request data for anonmaus user (limit 20?)
    @Query(() => Location)
    async getLocationByCoords(@Arg('latitude') latitude: number, @Arg('longitude') longitude: number): Promise<Location> {
        try {
            const cacheType = 'geocode';
            const key = `${latitude}:${longitude}`;
            const cached = await loadCache(cacheType, key);
            if (cached) {
                logger.info('Cache hit for getLocationByCoords');
                return cached;
            }

            const location = await getGeocode(latitude, longitude)
            await saveCache(cacheType, key, location);
            return location
        } catch (error) {
            throw new Error('Failed to excute distance matrix')
        }
    }

    // Handle check request data for anonmaus user (limit 20?)
    @Query(() => [Route])
    async calculateRoute(
        @Arg('origin') origin: string,
        @Arg('destinations', () => [String]) destinations: string[],
    ): Promise<Route[]> {
        try {
            const cacheType = 'routes';
            const key = `${origin}:${destinations.join(':')}`;
            const cached = await loadCache(cacheType, key);
            if (cached) {
                logger.info('Cache hit for calculateRoute');
                return cached;
            }

            const routes = await getCalculateRoute(origin, destinations)
            await saveCache(cacheType, key, routes)
            return routes
        } catch (error) {
            logger.error(`Error in calculateRoute: ${error}`);
            throw new Error('Failed to calculate route');
        }
    }
}