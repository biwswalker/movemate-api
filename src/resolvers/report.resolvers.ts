import { Resolver, Ctx, Query, UseMiddleware } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { getCurrentHost } from '@utils/string.utils'
import { FileUploadPayload } from '@payloads/file.payloads'
import path from 'path'
import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { getAdminBookingReport } from '@controllers/report'

@Resolver()
export default class ReportResolver {
  @Query(() => FileUploadPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async adminBookingReport(@Ctx() ctx: GraphQLContext): Promise<string> {
    const _query = {}
    const filePath = await getAdminBookingReport(_query)
    return `${getCurrentHost(ctx)}/report/${path.basename(filePath)}`
  }
}
