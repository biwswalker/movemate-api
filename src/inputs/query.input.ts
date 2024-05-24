import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true })
  limit?: number = 10;
  
  @Field(() => Int, { nullable: true })
  page?: number = 1;
  
  @Field({ nullable: true })
  sortField?: string;
  
  @Field({ nullable: true })
  sortAscending?: boolean = true;
}