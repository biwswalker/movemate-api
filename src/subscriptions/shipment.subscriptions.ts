import { AuthContext } from '@configs/graphQL.config'
import { GetShipmentInput } from '@inputs/shipment.input'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import { PaginateOptions } from 'mongoose'
import { Arg, Args, Ctx, Resolver, Root, Subscription } from 'type-graphql'
import { ShipmentListPayload } from '@payloads/shipment.payloads'
import { LoadmoreArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { GET_SHIPMENT_LIST } from '@pipelines/shipment.pipeline'
import pubsub, { SHIPMENTS } from '@configs/pubsub'
import { Repeater } from '@graphql-yoga/subscription'

@Resolver(Shipment)
export default class ShipmentSubscription {
  @Subscription(() => [ShipmentListPayload], {
    subscribe: async ({ context, args }) => {
      const { user_id, user_role } = context as AuthContext
      const { limit, sortField, sortAscending, skip } = args as LoadmoreArgs
      const filters = args?.filters || ({} as GetShipmentInput)
      if (!user_id) {
        throw new Error('Authentication required')
      }
      return new Repeater(async (push, stop) => {
        const { sort = undefined }: PaginateOptions = reformPaginate({ sortField, sortAscending })
        const _initialShipments = await ShipmentModel.aggregate(
          GET_SHIPMENT_LIST(filters, user_role, user_id, sort, skip || 0, limit || 10),
        )
        await push(_initialShipments)

        const subscription = pubsub.subscribe(SHIPMENTS.UPDATE, user_id)
        for await (const updatedShipment of subscription) {
          const _initialShipments = await ShipmentModel.aggregate(
            GET_SHIPMENT_LIST(filters, user_role, user_id, sort, skip || 0, limit || 10),
          )
          await push(_initialShipments)
          // await push([updatedShipment])
        }

        await stop
      })
    },
  })
  getRealtimeShipmentList(
    @Root() payload: ShipmentListPayload[],
    @Arg('filters') _filters: GetShipmentInput,
    @Args() _loadMores: LoadmoreArgs,
    @Ctx() _ctx: AuthContext,
  ): ShipmentListPayload[] {
    return payload
  }
}
