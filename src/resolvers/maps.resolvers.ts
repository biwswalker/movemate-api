import { Resolver, Query, UseMiddleware, Arg } from 'type-graphql'
import { AuthGuard } from '@guards/auth.guards'
import { DistanceMatrix } from '@models/distanceMatrix.model'
import { getDistanceMatrix } from '@services/maps/matrix'
import { get } from 'lodash'

@Resolver()
export default class MapsResolver {
    @Query(() => DistanceMatrix)
    @UseMiddleware(AuthGuard())
    async distanceMatrix(@Arg('origin') lat: string, @Arg('destinations') destinations: string): Promise<DistanceMatrix> {
        try {
            const {
                destinationAddresses,
                originAddresses,
                rows,
                status,
            } = await getDistanceMatrix(lat, destinations)
            return {
                destinationAddresses,
                originAddresses,
                status,
                result: get(rows, '0.elements', []),
            }
        } catch (error) {
            throw new Error('Failed to excute distance matrix')
        }
    }
}