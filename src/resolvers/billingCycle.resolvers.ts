import { AuthGuard } from "@guards/auth.guards"
import { GetBillingCycleArgs } from "@inputs/billingCycle.input"
import { PaginationArgs } from "@inputs/query.input"
import BillingCycleModel, { BillingCycle, EBillingStatus } from "@models/billingCycle.model"
import { BillingCyclePaginationAggregatePayload, TotalBillingRecordPayload } from "@payloads/billingCycle.payloads"
import { BILLING_CYCLE_LIST } from "@pipelines/billingCycle.pipeline"
import { reformPaginate } from "@utils/pagination.utils"
import { GraphQLError } from "graphql"
import { isEmpty, map, omitBy } from "lodash"
import { PaginateOptions } from "mongoose"
import { Args, Query, Resolver, UseMiddleware } from "type-graphql"

@Resolver(BillingCycle)
export default class BillingCycleResolver {

  @Query(() => BillingCyclePaginationAggregatePayload)
  @UseMiddleware(AuthGuard(['admin']))
  async billingCycleList(
    @Args() query: GetBillingCycleArgs,
    @Args() paginate: PaginationArgs
  ): Promise<BillingCyclePaginationAggregatePayload> {
    try {
      const reformSorts: PaginateOptions = reformPaginate(paginate)
      const filterQuery = omitBy(query, isEmpty)
      // Aggregrated
      console.log('raw: ', JSON.stringify(BILLING_CYCLE_LIST(filterQuery)))
      const aggregate = BillingCycleModel.aggregate(BILLING_CYCLE_LIST(filterQuery))
      const billingCycles = (await BillingCycleModel.aggregatePaginate(aggregate, reformSorts)) as BillingCyclePaginationAggregatePayload
      if (!billingCycles) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return billingCycles
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => [TotalBillingRecordPayload])
  @UseMiddleware(AuthGuard(["admin"]))
  async statusBillingCount(): Promise<TotalBillingRecordPayload[]> {
    const all = await BillingCycleModel.countDocuments()
    const refund = await BillingCycleModel.countDocuments({ status: EBillingStatus.REFUND })
    const overdue = await BillingCycleModel.countDocuments({ status: EBillingStatus.OVERDUE })
    const current = await BillingCycleModel.countDocuments({ status: EBillingStatus.CURRENT })
    const paid = await BillingCycleModel.countDocuments({ status: EBillingStatus.PAID })
    const refunded = await BillingCycleModel.countDocuments({ status: EBillingStatus.REFUNDED })

    return [
      { label: 'ทั้งหมด', key: 'all', count: all },
      { label: 'คืนเงิน', key: EBillingStatus.REFUND, count: refund },
      { label: 'เกินกำหนดชำระ', key: EBillingStatus.OVERDUE, count: overdue },
      { label: 'อยู่ในรอบบิล', key: EBillingStatus.CURRENT, count: current },
      { label: 'คืนเงินแล้ว', key: EBillingStatus.REFUNDED, count: refunded },
      { label: 'ชำระเงินแล้ว', key: EBillingStatus.PAID, count: paid }
    ];
  }

  @Query(() => [String])
  @UseMiddleware(AuthGuard(["admin"]))
  async allBillingCycleIds(
    @Args() query: GetBillingCycleArgs): Promise<string[]> {
    try {
      const filterQuery = omitBy(query, isEmpty)
      console.log('raw: ', JSON.stringify(BILLING_CYCLE_LIST(filterQuery)))
      const billingCycles = await BillingCycleModel.aggregate(BILLING_CYCLE_LIST(filterQuery))
      const ids = map(billingCycles, ({ _id }) => _id)
      console.log('billing cycle: ', billingCycles, ids)

      return ids;
    } catch (error) {
      console.log(error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง");
    }
  }
}