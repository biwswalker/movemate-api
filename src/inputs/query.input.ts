import { ArgsType, Field, Int } from "type-graphql";

@ArgsType()
export class PaginationArgs {

  @Field(() => Int, { nullable: true })
  limit?: number = 10;

  @Field(() => Int, { nullable: true })
  page?: number = 1;

  @Field(() => [String], { nullable: true })
  sortField?: string[];

  @Field({ nullable: true })
  sortAscending?: boolean = true;
}

@ArgsType()
export class LoadmoreArgs {
  @Field(() => Int, { defaultValue: 5, nullable: true })
  limit: number;

  @Field(() => Int, { defaultValue: 0, nullable: true })
  skip: number;
}