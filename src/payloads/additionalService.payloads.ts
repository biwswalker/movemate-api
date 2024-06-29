import { ObjectType, Field } from 'type-graphql'
import { AggregatePaginateResult } from 'mongoose'
import { PaginationPayload } from './pagination.payloads'
import { AdditionalService } from '@models/additionalService.model'

@ObjectType()
export class AdditionalServicePaginationPayload extends PaginationPayload implements AggregatePaginateResult<AdditionalService> {
    @Field(() => [AdditionalService])
    docs: AdditionalService[]
}