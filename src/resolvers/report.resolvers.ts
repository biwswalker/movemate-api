import { Resolver, Ctx, UseMiddleware, Arg, Mutation } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { getCurrentHost } from '@utils/string.utils'
import path from 'path'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { getAdminBookingReport, getAdminCutomerReport, getAdminDriverReport, getCreditorReport, getDebtorReport } from '@controllers/report'
import { EReportType } from '@enums/report'

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
}
