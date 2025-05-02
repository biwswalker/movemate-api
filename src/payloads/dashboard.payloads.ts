import { EDriverType } from "@enums/users";
import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class DashboardShipmentPayload {
  @Field(() => Int)
  daily: number
  @Field(() => Int)
  prevDaily: number
  @Field(() => Int)
  dailyPercent: number
  
  @Field(() => Int)
  monthly: number
  @Field(() => Int)
  prevMonthly: number
  @Field(() => Int)
  monthlyPercent: number
  
  @Field(() => Int)
  all: number
  @Field(() => Int)
  cancelled: number
  
  @Field(() => Int)
  finish: number
  @Field(() => Int)
  progressing: number
}

@ObjectType()
export class DashboardFinancialPayload {
  @Field(() => Int)
  income: number
  @Field(() => Int)
  prevIncome: number
  @Field(() => Int)
  incomePercent: number
  
  @Field(() => Int)
  expense: number
  @Field(() => Int)
  prevExpense: number
  @Field(() => Int)
  expensePercent: number
  
  @Field(() => Int)
  balance: number
  @Field(() => Int)
  prevBalance: number
  @Field(() => Int)
  balancePercent: number
  
  @Field(() => Int)
  tax: number
  @Field(() => Int)
  prevTax: number
  @Field(() => Int)
  taxPercent: number
}

@ObjectType()
export class DashboardRegisteredPayload {
  @Field(() => Int)
  pending: number
  @Field(() => Int)
  denied: number
  
  @Field(() => Int)
  monthly: number
  @Field(() => Int)
  prevMonthly: number
  @Field(() => Int)
  monthlyPercent: number
  
  @Field(() => Int)
  all: number
  @Field(() => Int)
  confirmed: number
}



@ObjectType()
export class DashboardPayload {
  @Field(() => DashboardShipmentPayload)
  shipment: DashboardShipmentPayload

  @Field(() => DashboardFinancialPayload)
  financial: DashboardFinancialPayload

  @Field(() => DashboardRegisteredPayload)
  registered: DashboardRegisteredPayload
}
