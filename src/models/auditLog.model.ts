// src/models/auditLog.model.ts
import { Field, ID, ObjectType } from 'type-graphql'
import { prop as Property, getModelForClass, Ref, plugin } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './user.model'
import { GraphQLJSONObject } from 'graphql-type-json'
import mongoosePagination from 'mongoose-paginate-v2'
import mongoose from 'mongoose'
import { EAuditActions } from '@enums/audit' // Import EAuditActions
import get from 'lodash/get'
import replace from 'lodash/replace'
import mongooseAutoPopulate from 'mongoose-autopopulate'

@plugin(mongoosePagination)
@plugin(mongooseAutoPopulate)
@ObjectType()
export class AuditLog extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field(() => User)
  @Property({ required: true, ref: 'User', autopopulate: true }) // Added autopopulate
  userId: Ref<User>

  @Field(() => EAuditActions) // Use the Enum
  @Property({ enum: EAuditActions, required: true })
  action: EAuditActions // e.g., 'CREATE_SHIPMENT', 'UPDATE_USER', 'LOGIN'

  @Field()
  @Property({ required: true })
  entityType: string // e.g., 'Shipment', 'User', 'Billing'

  @Field({ nullable: true })
  @Property()
  entityId?: string // ID of the entity that was acted upon

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property({ type: Object })
  details?: Record<string, any> // Additional details about the action

  @Field()
  @Property({ required: true })
  ipAddress: string

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Property({ type: Object })
  changes?: {
    before?: Record<string, any>
    after?: Record<string, any>
  } // Record of changes (before and after state)

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  static paginate: mongoose.PaginateModel<typeof AuditLog>['paginate']

  static async createLog(
    userId: string,
    action: EAuditActions, // Use the Enum
    entityType: string,
    entityId: string,
    ipAddress: string,
    details?: Record<string, any>,
    changes?: { before?: Record<string, any>; after?: Record<string, any> },
  ) {
    const newLog = new AuditLogModel({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      changes,
    })
    return newLog.save()
  }

  @Field(() => String)
  get actionMessage(): string {
     const _action = get(this, '_doc.action', '') || this.action || ''
    switch (_action) {
      case EAuditActions.LOGIN:
        return 'เข้าสู่ระบบ'
      case EAuditActions.LOGIN_FAILED:
        return 'เข้าสู่ระบบไม่สำเร็จ'
      case EAuditActions.LOGOUT:
        return 'ออกจากระบบ'
      case EAuditActions.CHANGE_PASSWORD:
        return 'เปลี่ยนรหัสผ่าน'
      case EAuditActions.FORGOT_PASSWORD:
        return 'ร้องขอเปลี่ยนรหัสผ่าน (ลืมรหัสผ่าน)'
      case EAuditActions.RESET_PASSWORD:
        return 'รีเซ็ตรหัสผ่าน'
      case EAuditActions.CREATE_USER:
        return 'สร้างผู้ใช้'
      case EAuditActions.UPDATE_USER_PROFILE:
        return 'แก้ไขข้อมูลโปรไฟล์'
      case EAuditActions.APPROVE_USER:
        return 'อนุมัติผู้ใช้'
      case EAuditActions.DENY_USER:
        return 'ไม่อนุมัติผู้ใช้'
      case EAuditActions.UPGRADE_ACCOUNT_REQUEST:
        return 'ร้องขออัปเกรดบัญชี'
      case EAuditActions.VERIFY_EMAIL:
        return 'ยืนยันอีเมล'
      case EAuditActions.VERIFY_PHONE_NUMBER:
        return 'ยืนยันเบอร์โทรศัพท์'
      case EAuditActions.UPDATE_FCM_TOKEN:
        return 'อัปเดต FCM Token'
      case EAuditActions.REMOVE_FCM_TOKEN:
        return 'ลบ FCM Token'
      case EAuditActions.REGISTER_DRIVER:
        return 'ลงทะเบียนคนขับ'
      case EAuditActions.UPDATE_DRIVER_DETAIL:
        return 'แก้ไขข้อมูลคนขับ'
      case EAuditActions.CHANGE_DRIVING_STATUS:
        return 'เปลี่ยนสถานะการขับ'
      case EAuditActions.ADD_EMPLOYEE:
        return 'เพิ่มพนักงาน (คนขับ)'
      case EAuditActions.ACCEPT_EMPLOYEE_REQUEST:
        return 'ตอบรับคำขอพนักงาน (คนขับ)'
      case EAuditActions.REJECT_EMPLOYEE_REQUEST:
        return 'ปฏิเสธคำขอพนักงาน (คนขับ)'
      case EAuditActions.REMOVE_EMPLOYEE:
        return 'ลบพนักงาน (คนขับ)'
      case EAuditActions.CREATE_SHIPMENT:
        return 'สร้างงานขนส่ง'
      case EAuditActions.UPDATE_SHIPMENT:
        return 'แก้ไขงานขนส่ง'
      case EAuditActions.ACCEPT_SHIPMENT:
        return 'คนขับรับงานขนส่ง'
      case EAuditActions.REJECT_SHIPMENT:
        return 'คนขับปฏิเสธงานขนส่ง'
      case EAuditActions.CANCEL_SHIPMENT_CUSTOMER:
        return 'ลูกค้ายกเลิกงานขนส่ง'
      case EAuditActions.CANCEL_SHIPMENT_DRIVER:
        return 'คนขับยกเลิกงานขนส่ง'
      case EAuditActions.CANCEL_SHIPMENT_SYSTEM:
        return 'ระบบยกเลิกงานขนส่ง'
      case EAuditActions.CONTINUE_MATCHING:
        return 'ดำเนินการค้นหาคนขับต่อ'
      case EAuditActions.CONFIRM_SHIPMENT_DATETIME:
        return 'ยืนยันวันเวลาขนส่ง'
      case EAuditActions.NEXT_SHIPMENT_STEP:
        return 'ดำเนินการขั้นตอนถัดไปในงานขนส่ง'
      case EAuditActions.SENT_POD_DOCUMENT:
        return 'ส่งเอกสาร POD'
      case EAuditActions.FINISH_SHIPMENT_JOB:
        return 'จบงานขนส่ง'
      case EAuditActions.ASSIGN_SHIPMENT_DRIVER:
        return 'มอบหมายงานขนส่งให้คนขับ'
      case EAuditActions.CREATE_BILLING:
        return 'สร้างใบแจ้งหนี้'
      case EAuditActions.UPDATE_BILLING:
        return 'แก้ไขใบแจ้งหนี้'
      case EAuditActions.APPROVE_BILLING_PAYMENT:
        return 'อนุมัติการชำระบิล'
      case EAuditActions.REJECT_BILLING_PAYMENT:
        return 'ปฏิเสธการชำระบิล'
      case EAuditActions.REFUND_BILLING_PAYMENT:
        return 'คืนเงินการชำระบิล'
      case EAuditActions.CONFIRM_WHT_DOCUMENT_RECEIVED:
        return 'ยืนยันรับเอกสาร WHT'
      case EAuditActions.MAKE_ADDITIONAL_PAYMENT:
        return 'แจ้งชำระเงินเพิ่มเติม'
      case EAuditActions.CREATE_DRIVER_PAYMENT:
        return 'สร้างรายการจ่ายเงินคนขับ'
      case EAuditActions.UPDATE_CONTACT_US:
        return 'อัปเดตข้อมูลติดต่อ'
      case EAuditActions.UPDATE_ABOUT_US:
        return 'อัปเดตเกี่ยวกับเรา'
      case EAuditActions.UPDATE_CUSTOMER_POLICIES:
        return 'อัปเดตนโยบายลูกค้า'
      case EAuditActions.UPDATE_CUSTOMER_TERMS:
        return 'อัปเดตข้อกำหนดลูกค้า'
      case EAuditActions.UPDATE_DRIVER_POLICIES:
        return 'อัปเดตนโยบายคนขับ'
      case EAuditActions.UPDATE_DRIVER_TERMS:
        return 'อัปเดตข้อกำหนดคนขับ'
      case EAuditActions.UPDATE_BUSINESS_TYPE:
        return 'อัปเดตประเภทธุรกิจ'
      case EAuditActions.UPDATE_FAQ:
        return 'อัปเดตคำถามที่พบบ่อย'
      case EAuditActions.UPDATE_INSTRUCTION:
        return 'อัปเดตคำแนะนำ'
      case EAuditActions.UPDATE_FINANCIAL_SETTING:
        return 'อัปเดตการตั้งค่าการเงิน'
      case EAuditActions.ADD_ADDITIONAL_SERVICE_COST:
        return 'เพิ่มค่าบริการเสริม'
      case EAuditActions.UPDATE_ADDITIONAL_SERVICE_COST:
        return 'แก้ไขค่าบริการเสริม'
      case EAuditActions.UPDATE_DISTANCE_COST:
        return 'แก้ไขค่าระยะทาง'
      case EAuditActions.INITIAL_VEHICLE_COST:
        return 'เริ่มต้นการตั้งค่าต้นทุนรถ'
      case EAuditActions.INITIAL_ADDITIONAL_SERVICE_COST:
        return 'เริ่มต้นการตั้งค่าบริการเสริม'
      case EAuditActions.UPLOAD_FILE:
        return 'อัปโหลดไฟล์'
      case EAuditActions.CREATE_CONTACT_MESSAGE:
        return 'ส่งข้อความติดต่อ'
      case EAuditActions.ADD_FAVORITE_DRIVER:
        return 'เพิ่มคนขับคนโปรด'
      case EAuditActions.REMOVE_FAVORITE_DRIVER:
        return 'ลบคนขับคนโปรด'
      case EAuditActions.ADD_POD_ADDRESS:
        return 'เพิ่มที่อยู่ POD'
      case EAuditActions.REMOVE_POD_ADDRESS:
        return 'ลบที่อยู่ POD'
      case EAuditActions.SAVE_EVENT:
        return 'บันทึกวันหยุด/กิจกรรม'
      case EAuditActions.REMOVE_EVENT:
        return 'ลบวันหยุด/กิจกรรม'
      case EAuditActions.ACCEPT_POLICY:
        return 'ยอมรับนโยบาย'
      default:
        return replace(_action, /_/g, ' ')
    }
  }
}

const AuditLogModel = getModelForClass(AuditLog)

export default AuditLogModel
