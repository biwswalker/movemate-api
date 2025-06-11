// src/resolvers/auditLog.resolvers.ts
import { Resolver, Query, Arg, Args, UseMiddleware } from 'type-graphql'
import AuditLogModel, { AuditLog } from '@models/auditLog.model'
import { AuthGuard } from '@guards/auth.guards'
import { EUserRole } from '@enums/users'
import { GetAuditLogsArgs } from '@inputs/auditLog.input' // We will create this
import { AuditLogPaginationPayload } from '@payloads/auditLog.payloads' // We will create this
import { PaginationArgs } from '@inputs/query.input'
import { reformPaginate } from '@utils/pagination.utils'
import { GraphQLError } from 'graphql'
import { omitBy, isEmpty } from 'lodash'
import { FilterQuery } from 'mongoose'

@Resolver(AuditLog)
export default class AuditLogResolver {
  @Query(() => AuditLog)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAuditLog(@Arg('id') id: string): Promise<AuditLog> {
    const log = await AuditLogModel.findById(id)
    if (!log) {
      throw new GraphQLError('ไม่พบข้อมูล Audit Log')
    }
    return log
  }

  @Query(() => AuditLogPaginationPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getAuditLogs(
    @Args() query: GetAuditLogsArgs,
    @Args() paginate: PaginationArgs,
  ): Promise<AuditLogPaginationPayload> {
    try {
      const paginationOptions = reformPaginate(paginate)

      const filter: FilterQuery<AuditLog> = {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.ipAddress ? { ipAddress: { $regex: query.ipAddress, $options: 'i' } } : {}),
        ...(query.startDate || query.endDate
          ? {
              createdAt: {
                ...(query.startDate ? { $gte: query.startDate } : {}),
                ...(query.endDate ? { $lte: query.endDate } : {}),
              },
            }
          : {}),
      }

      const logs = (await AuditLogModel.paginate(
        omitBy(filter, isEmpty),
        paginationOptions,
      )) as AuditLogPaginationPayload

      return logs
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      throw new GraphQLError('ไม่สามารถเรียกดู Audit Log ได้')
    }
  }

  // You can add more specific queries here, e.g., logs for a specific entity
}
