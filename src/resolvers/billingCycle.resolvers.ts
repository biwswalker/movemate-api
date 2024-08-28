import { GraphQLContext } from "@configs/graphQL.config"
import { AuthGuard } from "@guards/auth.guards"
import { BillingCycleRefundArgs, GetBillingCycleArgs } from "@inputs/billingCycle.input"
import { PaginationArgs } from "@inputs/query.input"
import BillingCycleModel, { BillingCycle, EBillingStatus } from "@models/billingCycle.model"
import FileModel, { File } from "@models/file.model"
import RefundModel from "@models/refund.model"
import ShipmentModel from "@models/shipment.model"
import { BillingCyclePaginationAggregatePayload, TotalBillingRecordPayload } from "@payloads/billingCycle.payloads"
import { BILLING_CYCLE_LIST } from "@pipelines/billingCycle.pipeline"
import { reformPaginate } from "@utils/pagination.utils"
import { GraphQLError } from "graphql"
import { isEmpty, map, omitBy } from "lodash"
import { PaginateOptions } from "mongoose"
import { Arg, Args, Ctx, Mutation, Query, Resolver, UseMiddleware } from "type-graphql"

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
      console.log('BILLING_CYCLE_LIST: ', JSON.stringify(BILLING_CYCLE_LIST(filterQuery)))
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
    const verify = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.VERIFY })
    const refund = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.REFUND })
    const overdue = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.OVERDUE })
    const current = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.CURRENT })
    const paid = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.PAID })
    const refunded = await BillingCycleModel.countDocuments({ billingStatus: EBillingStatus.REFUNDED })

    return [
      { label: 'ทั้งหมด', key: 'all', count: all },
      { label: 'ตรวจสอบยอดชำระ', key: EBillingStatus.VERIFY, count: verify },
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
      console.log('BILLING_CYCLE_LIST: ', JSON.stringify(BILLING_CYCLE_LIST(filterQuery)))
      const billingCycles = await BillingCycleModel.aggregate(BILLING_CYCLE_LIST(filterQuery))
      const ids = map(billingCycles, ({ _id }) => _id)
      return ids;
    } catch (error) {
      console.log(error);
      throw new GraphQLError("ไม่สามารถเรียกข้อมูลงานขนส่งได้ โปรดลองอีกครั้ง");
    }
  }

  @Query(() => BillingCycle)
  @UseMiddleware(AuthGuard(['admin']))
  async billingCycle(@Arg("billingNumber") billingNumber: string): Promise<BillingCycle> {
    try {
      const billingCycle = await BillingCycleModel.findOne({ billingNumber })
      if (!billingCycle) {
        const message = `ไม่สามารถเรียกข้อมูลใบแจ้งหนี้`
        throw new GraphQLError(message, { extensions: { code: 'NOT_FOUND', errors: [{ message }] } })
      }
      return billingCycle
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  @Query(() => String)
  @UseMiddleware(AuthGuard(['admin']))
  async billingNumberByShipment(@Arg("trackingNumber") trackingNumber: string): Promise<string> {
    try {
      const shipment = await ShipmentModel.findOne({ trackingNumber })
      const billingCycle = await BillingCycleModel.findOne({ shipments: { $in: [shipment._id] } })
      return billingCycle.billingNumber || ''
    } catch (error) {
      console.log(error)
      return ''
    }
  }

  // TODO:
  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard(['admin']))
  async refund(@Ctx() ctx: GraphQLContext, @Args() data: BillingCycleRefundArgs): Promise<boolean> {
    const user_id = ctx.req.user_id
    try {
      const imageEvidenceFile = new FileModel(data.imageEvidence)
      await imageEvidenceFile.save()
      const refunded = new RefundModel({
        imageEvidence: imageEvidenceFile,
        paymentDate: data.paymentDate,
        paymentTime: data.paymentTime
      })
      await refunded.save()
      // await BillingCycleModel.markAsRefund({
      //   billingCycleId: data.billingCycleId,
      //   imageEvidenceId: imageEvidenceFile._id,
      //   paymentDate: data.paymentDate,
      //   paymentTime: data.paymentTime,
      // }, user_id)
      return true
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}