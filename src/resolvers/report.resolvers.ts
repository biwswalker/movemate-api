import { Resolver, Ctx, UseMiddleware, Arg, Mutation, Query, Args } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { getCurrentHost } from '@utils/string.utils'
import path from 'path'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import {
  getAdminBookingReport,
  getAdminCutomerReport,
  getAdminDriverReport,
  getCreditorReport,
  getCustomerBookingReport,
  getDebtorReport,
} from '@controllers/report'
import { ECustomerReportType, EReportType } from '@enums/report'
import { CreditorReportPayload, CreditorReportResponse } from '@payloads/report.payloads'
import { PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import Aigle from 'aigle'
import lodash, { find, includes, last } from 'lodash'
import { User } from '@models/user.model'
import { GetDriverPaymentArgs } from '@inputs/driver-payment.input'
import DriverPaymentModel from '@models/driverPayment.model'
import { DRIVER_PAYMENTS } from '@pipelines/driverPayment.pipeline'
import { DriverPaymentAggregatePayload } from '@payloads/driverPayment.payloads'
import { DriverDetail } from '@models/driverDetail.model'
import { Shipment } from '@models/shipment.model'
import { EStepDefinition, EStepStatus, StepDefinition } from '@models/shipmentStepDefinition.model'
import { Quotation } from '@models/finance/quotation.model'
import { fDate } from '@utils/formatTime'
import { WithTransaction } from '@middlewares/RetryTransaction'
import { EQuotationStatus } from '@enums/shipments'

Aigle.mixin(lodash, {})

@Resolver()
export default class ReportResolver {
  @Mutation(() => String)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAdminReport(
    @Ctx() ctx: GraphQLContext,
    @Arg('ids', () => [String]) ids: string[],
    @Arg('type', () => EReportType) type: EReportType,
  ): Promise<string> {
    if (type === EReportType.CUSTOMER) {
      const filePath = await getAdminCutomerReport(ids)
      return `${getCurrentHost(ctx)}/report/admin/customer/${path.basename(filePath)}`
    } else if (type === EReportType.DRIVER) {
      const filePath = await getAdminDriverReport(ids)
      return `${getCurrentHost(ctx)}/report/admin/driver/${path.basename(filePath)}`
    } else if (type === EReportType.BOOKING) {
      const filePath = await getAdminBookingReport(ids)
      return `${getCurrentHost(ctx)}/report/admin/booking/${path.basename(filePath)}`
    } else if (type === EReportType.DEBTOR) {
      const filePath = await getDebtorReport(ids)
      return `${getCurrentHost(ctx)}/report/admin/debtor/${path.basename(filePath)}`
    } else if (type === EReportType.CREDITOR) {
      const filePath = await getCreditorReport(ids)
      return `${getCurrentHost(ctx)}/report/admin/creditor/${path.basename(filePath)}`
    }
    return ''
  }

  @Mutation(() => String)
  @UseMiddleware(AuthGuard([EUserRole.CUSTOMER]))
  async getCustomerReport(
    @Ctx() ctx: GraphQLContext,
    @Arg('ids', () => [String]) ids: string[],
    @Arg('type', () => ECustomerReportType) type: ECustomerReportType,
  ): Promise<string> {
    const userId = ctx.req.user_id
    if (type === ECustomerReportType.BOOKING) {
      const filePath = await getCustomerBookingReport(ids, userId)
      return `${getCurrentHost(ctx)}/report/customer/booking/${path.basename(filePath)}`
    }
    return ''
  }

  @Query(() => CreditorReportResponse)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getCreditorReportList(
    @Arg('data', () => GetDriverPaymentArgs, { nullable: true }) data: GetDriverPaymentArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<CreditorReportResponse> {
    const { sort, ...reformSorts } = reformPaginate(paginate)
    const aggregate = DriverPaymentModel.aggregate(DRIVER_PAYMENTS(data, sort))
    const payments = (await DriverPaymentModel.aggregatePaginate(
      aggregate,
      reformSorts,
    )) as DriverPaymentAggregatePayload

    const reportData: CreditorReportPayload[] = await Aigle.map(payments.docs, async (payment) => {
      const driver = payment.driver as User
      const driverDetail = driver?.driverDetail as DriverDetail | undefined
      const shipments = payment.shipments as Shipment[]

      const creditorShipments = shipments.map((shipment) => {
        const finishStep = find(shipment.steps as StepDefinition[], {
          step: EStepDefinition.FINISH,
          stepStatus: EStepStatus.DONE,
        })
        const quotation = last(((shipment.quotations || []) as Quotation[]).filter((_quotation) => includes([EQuotationStatus.ACTIVE], _quotation.status)))
        return {
          shipmentNo: shipment.trackingNumber,
          finishedDate: finishStep ? fDate(finishStep.updatedAt, 'dd/MM/yyyy') : '-',
          value: quotation?.cost?.total,
        }
      })

      return {
        userId: driver?.userNumber,
        userType: driver?.userType,
        fullname: driver?.fullname,
        taxId: driver?.taxId,
        contactNumber: driver?.contactNumber,
        workingPeriod: '-', // Needs logic to determine
        duedate: '-', // Needs logic to determine
        overdueCount: 0, // Needs logic to determine
        shipments: creditorShipments,
        subtotal: payment.subtotal,
        whtValue: payment.tax,
        total: payment.total,
        paymentDate: payment.paymentDate ? fDate(payment.paymentDate, 'dd/MM/yyyy') : '-',
        receiptNo: payment.paymentNumber, // Using paymentNumber as receiptNo for now
        whtNo: payment.whtNumber,
      }
    })

    return {
      ...payments,
      docs: reportData,
    }
  }
}
