// src/inputs/auditLog.input.ts
import { ArgsType, Field, ID } from 'type-graphql'
import { EAuditActions } from '@enums/audit' // Import EAuditActions

@ArgsType()
export class GetAuditLogsArgs {
  @Field(() => ID, { nullable: true })
  userId?: string

  @Field(() => EAuditActions, { nullable: true }) // Use the Enum
  action?: EAuditActions

  @Field({ nullable: true })
  entityType?: string

  @Field({ nullable: true })
  entityId?: string

  @Field({ nullable: true })
  ipAddress?: string

  @Field({ nullable: true })
  startDate?: Date

  @Field({ nullable: true })
  endDate?: Date
}
