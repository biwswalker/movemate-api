import { Field, Float, ObjectType } from 'type-graphql'

@ObjectType()
export class TransactionPayload {
  @Field(() => Float, { defaultValue: 0, nullable: true })
  totalPending?: number

  @Field(() => Float)
  totalIncome: number

  @Field(() => Float)
  totalOutcome: number

  @Field(() => Float)
  totalOverall: number
}
