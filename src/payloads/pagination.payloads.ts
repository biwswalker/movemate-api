import { Field, Int, ObjectType } from "type-graphql"

@ObjectType()
export class PaginationPayload {
    @Field(() => Int)
    totalDocs: number

    @Field(() => Int)
    limit: number

    @Field(() => Int)
    totalPages: number

    @Field(() => Int, { nullable: true })
    page?: number

    @Field(() => Int)
    pagingCounter: number

    @Field()
    hasPrevPage: boolean

    @Field()
    hasNextPage: boolean

    @Field(() => Int, { nullable: true })
    prevPage?: number

    @Field(() => Int, { nullable: true })
    nextPage?: number

    @Field(() => Int, { nullable: true })
    offset: number;

    [customLabel: string]: number | boolean | any[];

    meta?: number | boolean | any[];
}