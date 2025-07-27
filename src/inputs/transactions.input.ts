import { EUserType } from "@enums/users"
import { ERefType, ETransactionStatus, ETransactionType } from "@models/transaction.model"
import { ArgsType, Field, InputType } from "type-graphql"

@ArgsType()
@InputType()
export class GetDriverTransactionArgs {
  @Field({ nullable: true })
  driverName?: string

  @Field(() => EUserType, { nullable: true })
  driverType?: EUserType

  @Field({ nullable: true })
  isPending?: boolean

//   @Field({ nullable: true })
//   shipmentTracking: string

//   @Field(() => ETransactionStatus, { nullable: true })
//   transactionStatus: ETransactionStatus
}

@ArgsType()
export class GetTransactionsArgs {
  @Field({ nullable: true })
  shipmentTracking?: string

  @Field(() => ETransactionType, { nullable: true })
  transactionType?: ETransactionType

  @Field(() => ETransactionStatus, { nullable: true })
  transactionStatus?: ETransactionStatus

  @Field(() => ERefType, { nullable: true })
  refType?: ERefType

  @Field(() => Date, { nullable: true })
  startDate?: Date

  @Field(() => Date, { nullable: true })
  endDate?: Date
}
