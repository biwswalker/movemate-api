// src/decorators/AuditLog.decorator.ts
import { AuditLog } from '@models/auditLog.model'
import { MiddlewareFn } from 'type-graphql'
import { GraphQLContext } from '@configs/graphQL.config'
import { EAuditActions } from '@enums/audit' // Import EAuditActions
import { omit } from 'lodash'

interface AuditLogOptions {
  action: EAuditActions // Use the Enum
  entityType: string
  entityId?: (root: any, args: any, context: GraphQLContext, info: any) => string
  details?: (root: any, args: any, context: GraphQLContext, info: any) => Record<string, any>
  trackChanges?: boolean
}

export function AuditLogDecorator(options: AuditLogOptions): MiddlewareFn<GraphQLContext> {
  return async ({ root, args, context, info }, next) => {
    const { req } = context
    const userId = req.user_id
    const ipAddress = req.ip

    if (!userId) {
      return next()
    }

    let beforeState: Record<string, any> | undefined
    if (options.trackChanges && options.entityId) {
      // Assuming you have a way to fetch the current state of the entity
      // This is a placeholder and needs actual implementation based on your data models
      // For example, if entityType is 'User', you might do:
      // if (options.entityType === 'User') {
      //   beforeState = await UserModel.findById(options.entityId(root, args, context, info)).lean();
      // }
      // Or you might need to pass the initial state from the resolver itself
    }

    const result = await next()

    // const entityId = options.entityId ? options.entityId(root, args, context, info) : undefined
    // const details = options.details ? options.details(root, args, context, info) : args
    // const changes = options.trackChanges
    //   ? {
    //       before: beforeState, // This needs to be populated
    //       after: result, // This will be the result of the mutation
    //     }
    //   : undefined
    // await AuditLog.createLog(userId, options.action, options.entityType, entityId, ipAddress, details, changes) // Corrected order of arguments

    const entityId = options.entityId ? options.entityId(root, args, context, info) : undefined

    // Custom handling for details and changes
    let logDetails: Record<string, any> | undefined
    let logChanges: { before?: Record<string, any>; after?: Record<string, any> } | undefined

    if (options.details) {
      const customDetails = options.details(root, args, context, info)
      if (customDetails && customDetails.changes) {
        logChanges = customDetails.changes
        logDetails = omit(customDetails, 'changes') // Remove 'changes' from main details
      } else {
        logDetails = customDetails
      }
    } else {
      logDetails = args // Default to logging args
    }

    // Ensure 'after' state is correctly populated if trackChanges was intended
    if (logChanges && !logChanges.after) {
      logChanges.after = result
    }

    await AuditLog.createLog(userId, options.action, options.entityType, entityId, ipAddress, logDetails, logChanges)

    return result
  }
}
