import { Privilege } from "@models/privilege.model"
import { Field, ObjectType } from "type-graphql"
import { PaginationPayload } from "./pagination.payloads"
import { PaginateResult } from "mongoose"

@ObjectType()
export class PrivilegePaginationPayload extends PaginationPayload implements PaginateResult<Privilege> {
    @Field(() => [Privilege])
    docs: Privilege[]
}