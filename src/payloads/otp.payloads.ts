import { Field, ObjectType } from "type-graphql";
import { PaginationPayload } from "./pagination.payloads";
import { PaginateResult } from "mongoose";
import { OTPRequst } from "@models/otp.model";

@ObjectType()
export class OTPPaginationPayload extends PaginationPayload implements PaginateResult<OTPRequst> {
  @Field(() => [OTPRequst])
  docs: OTPRequst[]
}