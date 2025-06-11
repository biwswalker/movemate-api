// src/payloads/auditLog.payloads.ts
import { Field, ObjectType } from 'type-graphql'
import { PaginateResult } from 'mongoose'
import { AuditLog } from '@models/auditLog.model'
import { PaginationPayload } from './pagination.payloads' // Assuming this exists

@ObjectType()
export class AuditLogPaginationPayload extends PaginationPayload implements PaginateResult<AuditLog> {
  @Field(() => [AuditLog])
  docs: AuditLog[]
}