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
