import { Field, ObjectType } from 'type-graphql'

@ObjectType()
export class CancellationPolicyDetail {
  @Field()
  condition: string

  @Field()
  feeDescription: string
}

@ObjectType()
export class CancellationPreview {
  @Field()
  cancellationFee: number // ค่าปรับที่จะเกิดขึ้น

  @Field()
  refundAmount: number // ยอดเงินที่จะได้รับคืน

  @Field()
  finalChargeDescription: string // คำอธิบายสรุปของค่าปรับปัจจุบัน

  @Field(() => [CancellationPolicyDetail])
  policyDetails: CancellationPolicyDetail[] // รายละเอียดเงื่อนไขทั้งหมด

  @Field()
  isAllowed: boolean // สามารถยกเลิกได้หรือไม่

  @Field({ nullable: true })
  reasonIfNotAllowed?: string // เหตุผลที่ไม่สามารถยกเลิกได้
}
