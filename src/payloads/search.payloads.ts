import { PaginateResult } from "mongoose";
import { PaginationPayload } from "./pagination.payloads";
import { SearchHistory } from "@models/searchHistory.model";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class SearchHistoryPaginationPayload extends PaginationPayload implements PaginateResult<SearchHistory> {
    @Field(() => [SearchHistory])
    docs: SearchHistory[]
}