import { ObjectType, Field, ID } from 'type-graphql'
import { prop as Property, Severity, getModelForClass } from '@typegoose/typegoose'
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator'

@ObjectType()
export class BusinessUser {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @IsString()
    @IsNotEmpty()
    @Property({ required: true, unique: true })
    user_number: string

    @Field()
    @IsEmail()
    @IsNotEmpty()
    @Property({ required: true })
    email: string

    @Field()
    @Property({ enum: ['บจก.', 'หจก.', 'บมจ.'], required: true })
    corporate_titles: string

    @Field()
    @Property({ required: true })
    corporate_name: string

    @Field()
    @IsString()
    @IsNotEmpty()
    @Length(13)
    @Property({ required: true })
    tax_id: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    corporate_branch: string

    @Field()
    @IsString()
    @Property({ required: true })
    address: string

    @Field({ nullable: true })
    @IsString()
    @Property()
    country: string

    @Field()
    @IsString()
    @Property({ required: true })
    postcode: string

    @Field()
    @Property({ required: true })
    province: string

    @Field()
    @IsString()
    @Property({ required: true })
    district: string

    @Field()
    @IsString()
    @Property({ required: true })
    sub_district: string

    @Field()
    @Property()
    business_type: string
    // ขนส่งภายในประเทศ / ระหว่างประเทศ / ชิปปิ้ง
    // คลังสินค้า
    // ซื้อมาขายไป 
    // การผลิตวัตถุดิบอุตสาหกรรม
    // ผู้รับเหมาก่อสร้าง / อุปกรณ์ก่อสร้าง
    // การเกษตร / ต้นไม้ / เมล็ดพันธุ์
    // เฟอร์นิเจอร์ / ของใช้ภายในบ้าน
    // อุปโภค บริโภค
    // อาหารสด (ควบคุณอุณหภูมิ)
    // เครื่องใช้ไฟฟ้า
    // เคมีต่างๆ วัตถุอันตราย
    // อุปกรณ์ทางการแพทย์
    // ศิลปะ / ความบันเทิง
    // อื่นๆ (ระบุ)

    @Field({ nullable: true })
    @Property()
    business_type_other: string

    @Field(() => [String])
    @Property({ required: true, allowMixed: Severity.ALLOW })
    phone_numbers: string[]

    @Field()
    @Property()
    document_business_register_certification: string

    @Field()
    @Property()
    document_value_added_tax_registration_certification: string

    @Field()
    @Property()
    document_copy_authorized_signatory_ID_card: string
}

const BusinessUserModel = getModelForClass(BusinessUser)

export default BusinessUserModel