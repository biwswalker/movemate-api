import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, getModelForClass } from '@typegoose/typegoose'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

@ObjectType()
export class BusinessUserDetail {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsString()
    @IsNotEmpty()
    @Property({ required: true, unique: true })
    user_number: string

    @Field()
    @Property({ required: true })
    transport_supervisor_phone_number: string

    @Field()
    @IsEmail()
    @IsNotEmpty()
    @Property({ required: true })
    transport_supervisor_email: string

    @Field()
    @Property({ required: true })
    accounting_phone_number: string

    @Field()
    @IsEmail()
    @IsNotEmpty()
    @Property({ required: true })
    accounting_email: string

    @Field()
    @Property({ required: true })
    accounting_address: string

    @Field({ nullable: true })
    @Property()
    accounting_country: string

    @Field()
    @Property({ required: true })
    accounting_province: string

    @Field()
    @Property({ required: true })
    accounting_district: string

    @Field()
    @Property({ required: true })
    accounting_sub_diatrict: string

    @Field()
    @Property({ required: true })
    accounting_postcode: string

    @Field()
    @Property({ required: true })
    credit_term: boolean

    @Field({ nullable: true })
    @Property()
    credit_limit: string

    @Field({ nullable: true })
    @Property()
    credit_amount: string

    @Field({ nullable: true })
    @Property()
    billed_type: string

    @Field({ nullable: true })
    @Property()
    date_of_billed: string
    // ทุก 15 วันปฎิทิน default, required
    // แต่ละเดือนมีวันกำหนด (กรุณาติดต่อเจ้าหน้าที่)

    @Field({ nullable: true })
    @Property()
    payment_duedate_type: string
    // 7 วันปฎิทิน นับจากวันที่ออดใบแจ้งหนี้ default, required
    // แต่ละเดือนมีวันกำหนด (กรุณาติดต่อเจ้าหน้าที่)

    @Field({ nullable: true })
    @Property()
    date_of_payment_duedate: string

    @Field()
    @Property()
    is_accept_e_documents: boolean

}

const BusinessUserModel = getModelForClass(BusinessUserDetail)

export default BusinessUserModel