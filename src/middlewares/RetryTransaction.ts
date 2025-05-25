import { MiddlewareFn } from 'type-graphql'
import mongoose from 'mongoose'
import { GraphQLContext } from '@configs/graphQL.config'

const RetryTransactionMiddleware: MiddlewareFn<GraphQLContext> = async ({ context, args }, next) => {
  const maxRetries = 5
  let retries = 0

  while (retries < maxRetries) {
    const session = await mongoose.startSession() // Create new session for each attempt

    try {
      session.startTransaction()

      // Add session to context for resolver usage
      context.session = session

      // Execute the resolver
      const result = await next()

      // Commit transaction if successful
      await session.commitTransaction()
      await session.endSession()

      return result // Return successful result
    } catch (error) {
      console.log('RetryTransactionMiddleware Error: ', error)

      try {
        // Always try to abort the transaction if it's active
        if (session.inTransaction()) {
          await session.abortTransaction()
        }
      } catch (abortError) {
        console.log('Error aborting transaction:', abortError)
      } finally {
        await session.endSession()
      }

      // Check if this is a retryable error (write conflict)
      if (error.code === 112 && retries < maxRetries - 1) {
        retries++
        console.log(`Retry attempt ${retries}/${maxRetries}...`)

        // Exponential backoff strategy
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 100))

        // Continue to next iteration (retry)
        continue
      } else {
        // Max retries exceeded or non-retryable error
        if (retries >= maxRetries - 1) {
          console.log('Max retries exceeded. Aborting transaction.')
        }
        throw error
      }
    }
  }
}

export default RetryTransactionMiddleware

export const TransactionMiddleware: MiddlewareFn<GraphQLContext> = async ({ context, args }, next) => {
  const session = await mongoose.startSession()
  try {
    const resolverFunction = await next()
    // Now execute the resolver within the transaction
    const result = await session.withTransaction(
      async () => {
        // Add session to context
        context.session = session

        // Execute the already-resolved function
        // The resolver should return a function that we can call with the session
        if (typeof resolverFunction === 'function') {
          return await resolverFunction()
        }

        return resolverFunction
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
        readPreference: 'primary',
      },
    )

    console.log('Transaction completed successfully')
    return result
  } catch (error) {
    console.log('Transaction failed after all retries:', {
      message: error.message,
      code: error.code,
      codeName: error.codeName,
    })

    // You can handle specific MongoDB error codes here
    switch (error.code) {
      case 112: // WriteConflict
        console.log('Write conflict - operation was retried but failed')
        break
      case 11000: // DuplicateKey
        console.log('Duplicate key error')
        break
      case 50: // MaxTimeMSExpired
        console.log('Transaction timed out')
        break
      default:
        console.log('Other transaction error:', error.code)
    }

    throw error
  } finally {
    try {
      await session.endSession()
    } catch (endError) {
      console.log('Error ending session:', endError)
    }
  }
}

// Create a transaction decorator
export function WithTransaction(options?: mongoose.mongo.TransactionOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const session = await mongoose.startSession()

      try {
        const result = await session.withTransaction(
          async () => {
            // Find the context argument (usually the last one in GraphQL resolvers)
            const ctx = args.find((arg) => arg && arg.session !== undefined) || args[args.length - 1] // GraphQL context is typically the last argument

            if (ctx) {
              ctx.session = session
            }

            // Call the original method with session in context
            return await originalMethod.apply(this, args)
          },
          {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', j: true },
            readPreference: 'primary',
            ...options
          }
        )

        return result
      } catch (error) {
        console.log('Transaction failed:', error.message)
        throw error
      } finally {
        await session.endSession()
      }
    }

    return descriptor
  }
}
