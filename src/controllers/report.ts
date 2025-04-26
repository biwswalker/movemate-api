import { BookingReport, generateBookingReport } from 'reports/excels/admin/booking'
import { fDate, fDateTime } from '@utils/formatTime'
import path from 'path'
import ShipmentModel, { Shipment } from '@models/shipment.model'
import Aigle from 'aigle'
import lodash, { find, head, includes, last, reduce, sum, tail } from 'lodash'
import UserModel, { User } from '@models/user.model'
import { EUserRole, EUserStatus, EUserType, EUserValidationStatus } from '@enums/users'
import { EShipmentStatus } from '@enums/shipments'
import { EPaymentMethod } from '@enums/payments'
import { VehicleType } from '@models/vehicleType.model'
import { ShipmentAdditionalServicePrice } from '@models/shipmentAdditionalServicePrice.model'
import { VALUES } from 'constants/values'
import { Quotation } from '@models/finance/quotation.model'
import ShipmentResolver from '@resolvers/shipment.resolvers'
import { CustomerReport, generateCustomerReport } from 'reports/excels/admin/customer'
import { BusinessCustomer } from '@models/customerBusiness.model'
import { DriverReport, generateDriverReport } from 'reports/excels/admin/driver'
import { DriverDetail } from '@models/driverDetail.model'
import { getAgentParents } from './driver'
import BillingModel, { Billing } from '@models/finance/billing.model'
import { DebtorReport, generateDebtorReport } from 'reports/excels/admin/debtor'
import { Payment } from '@models/finance/payment.model'
import { Receipt } from '@models/finance/receipt.model'
import { Invoice } from '@models/finance/invoice.model'
import { EBillingState, EBillingStatus } from '@enums/billing'
import { BillingDocument } from '@models/finance/documents.model'
import { differenceInDays } from 'date-fns'
import DriverPaymentModel from '@models/driverPayment.model'
import { CreditorReport, generateCreditorReport } from 'reports/excels/admin/creditor'
import { Transaction } from '@models/transaction.model'
import { EStepDefinition, EStepStatus, StepDefinition } from '@models/shipmentStepDefinition.model'

Aigle.mixin(lodash, {})

function getShipmentStatus(status: EShipmentStatus) {
  switch (status) {
    case EShipmentStatus.IDLE:
      return 'รอเริ่มงาน'
    case EShipmentStatus.PROGRESSING:
      return 'กำลังดำเนินการ'
    case EShipmentStatus.CANCELLED:
      return 'ยกเลิก'
    case EShipmentStatus.DELIVERED:
      return 'สำเร็จ'
    case EShipmentStatus.REFUND:
      return 'คืนเงิน'
    default:
      return '-'
  }
}

function getPaymentType(type: EPaymentMethod) {
  switch (type) {
    case EPaymentMethod.CASH:
      return 'เงินสด'
    case EPaymentMethod.CREDIT:
      return 'เครดิต'
    default:
      return '-'
  }
}

function getAdditionalPrice(services: ShipmentAdditionalServicePrice[], value: string) {
  const _shipment = find(services, ['name', value])
  return _shipment
}

function getUserType(type: EUserType) {
  switch (type) {
    case EUserType.BUSINESS:
      return 'Movemate Corporate'
    case EUserType.INDIVIDUAL:
      return 'Movemate Individual'
    default:
      return '-'
  }
}

function getDriverType(type: EUserType) {
  switch (type) {
    case EUserType.BUSINESS:
      return 'Agent'
    case EUserType.INDIVIDUAL:
      return 'Individual'
    default:
      return '-'
  }
}

function getUserApprovalStatus(status: EUserValidationStatus) {
  switch (status) {
    case EUserValidationStatus.PENDING:
      return 'รอการอนุมัติ'
    case EUserValidationStatus.APPROVE:
      return 'อนุมัติแล้ว'
    case EUserValidationStatus.DENIED:
      return 'ไม่อนุมัติ'
    default:
      return ''
  }
}

function getUserStatus(status: EUserStatus) {
  switch (status) {
    case EUserStatus.PENDING:
      return 'รอการอนุมัติ'
    case EUserStatus.ACTIVE:
      return 'ใช้งาน'
    case EUserStatus.INACTIVE:
      return 'ไม่ใช้งาน'
    case EUserStatus.BANNED:
      return 'ระงับการใช้งาน'
    case EUserStatus.DENIED:
      return 'ไม่อนุมัติ'
    default:
      return ''
  }
}

function getBillingStatus(billing: Billing) {
  const _isTaxIncluded = (billing.amount?.tax || 0) > 0
  const _receipt = last(billing.receipts) as Receipt | undefined
  const _receiptDocument = _receipt?.document as BillingDocument
  const _receiptFilename = _receiptDocument?.filename || ''
  const _receiptEmailTime = _receiptDocument?.emailTime || ''
  const _receiptTrackingNumber = _receiptDocument?.trackingNumber || ''

  const _state = billing.state
  switch (billing.status) {
    case EBillingStatus.PENDING:
      if (_state === EBillingState.CURRENT) {
        return 'รอการชำระ'
      } else if (_state === EBillingState.OVERDUE) {
        return 'ผิดนัดชำระ'
      } else if (_state === EBillingState.REFUND) {
        return 'รอคืนเงิน'
      }
      return ''
    case EBillingStatus.VERIFY:
      if (_state === EBillingState.CURRENT) {
        return 'รอยืนยันการชำระ'
      } else if (_state === EBillingState.OVERDUE) {
        return 'ผิดนัดชำระ'
      } else if (_state === EBillingState.REFUND) {
        return 'รอยืนยันคืนเงิน'
      }
      return ''
    case EBillingStatus.CANCELLED:
      if (_state === EBillingState.CURRENT) {
        return 'ยกเลิกการชำระ'
      } else if (_state === EBillingState.OVERDUE) {
        return 'ยกเลิกการชำระ'
      } else if (_state === EBillingState.REFUND) {
        return 'ยกเลิกคืนเงิน'
      }
      return '-'
    case EBillingStatus.COMPLETE:
      if (_state === EBillingState.CURRENT || _state === EBillingState.OVERDUE) {
        if (_isTaxIncluded) {
          if (_receiptFilename && _receiptEmailTime) {
            if (_receiptTrackingNumber) {
              return 'ส่งใบเสร็จรับเงินแล้ว'
            } else {
              return 'ออกใบเสร็จรับเงินแล้ว'
            }
          } else {
            return 'ชำระแล้ว รอออกใบเสร็จ'
          }
        } else {
          if (_receiptFilename && _receiptEmailTime) {
            return 'ออกใบเสร็จรับเงินแล้ว'
          } else {
            return 'ชำระแล้ว รอออกใบเสร็จ'
          }
        }
      } else if (_state === EBillingState.REFUND) {
        return 'คืนเงินแล้ว'
      }
      return ''
    default:
      return ''
  }
}

function getOverdueDate(billing: Billing) {
  const _payment = last(billing.payments) as Payment | undefined
  if (_payment) {
    const _differenceDays = differenceInDays(new Date(billing.paymentDueDate), new Date(_payment.createdAt))
    if (_differenceDays > 0) return _differenceDays
    return 0
  }
  const _differenceDays = differenceInDays(new Date(billing.paymentDueDate), new Date())
  if (_differenceDays > 0) return _differenceDays
  return 0
}

const BANKPROVIDER = [
  { value: 'BBL', label: 'ธนาคารกรุงเทพ' },
  { value: 'KBANK', label: 'ธนาคารกสิกรไทย' },
  { value: 'KTB', label: 'ธนาคารกรุงไทย' },
  { value: 'SCB', label: 'ธนาคารไทยพาณิชย์' },
  { value: 'BAY', label: 'ธนาคารกรุงศรีอยุธยา' },
  { value: 'TTB', label: 'ธนาคารทหารไทยธนชาต' },
  { value: 'KK', label: 'ธนาคารเกียรตินาคิน' },
  { value: 'TISCO', label: 'ธนาคารทิสโก้' },
  { value: 'CIMBT', label: 'ธนาคารซีไอเอ็มบีไทย' },
  { value: 'UOB', label: 'ธนาคารยูโอบี' },
  { value: 'GSB', label: 'ธนาคารออมสิน' },
  { value: 'GHB', label: 'ธนาคารอาคารสงเคราะห์' },
  { value: 'BACC', label: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร' },
]

function getBankProviderName(bank: string) {
  const bankProvider = find(BANKPROVIDER, (provider) => provider.value === bank)
  if (bankProvider) {
    return bankProvider.label
  }
  return ''
}

export async function getAdminBookingReport(query: any) {
  const bookingIds = await ShipmentModel.find().distinct('_id')
  const bookings = await ShipmentModel.find({ _id: { $in: bookingIds } })

  const workbookData: BookingReport[] = await Aigle.map(bookings, async (booking) => {
    const customer = booking.customer as User | undefined
    const origin = head(booking.destinations || [])
    const destinations = tail(booking.destinations || [])
    const vehicle = booking.vehicleId as VehicleType | undefined
    const additionalServices = (booking.additionalServices as ShipmentAdditionalServicePrice[]) || []
    const services = additionalServices.map((service) => service?.name ?? '-')

    // TODO: Check again
    const _shipmentResolver = new ShipmentResolver()
    const _calculated = await _shipmentResolver.getCalculationDetail(booking._id)

    const _quotation = last(booking.quotations) as Quotation
    const _cost = _quotation.cost
    const _price = _quotation.price
    const _discount = reduce(
      _quotation.detail.discounts || [],
      (prev, discount) => ({ cost: sum([prev.cost, discount.cost]), price: sum([prev.price, discount.price]) }),
      { cost: 0, price: 0 },
    )

    return {
      bookingDate: booking.createdAt ? fDate(booking.createdAt, 'dd/MM/yyyy HH:mm') : '',
      pickupDate: booking.bookingDateTime ? fDate(booking.bookingDateTime, 'dd/MM/yyyy HH:mm') : '',
      shipmentId: booking.trackingNumber ?? '-',
      customerName: customer.fullname ?? '-',
      customerId: customer.userNumber ?? '-',
      bookingBy: origin.contactName,
      customerType: getUserType(customer.userType),
      email: customer.email ?? '-',
      tel: customer.contactNumber ?? '-',
      bookingStatus: getShipmentStatus(booking.status),
      paymentType: getPaymentType(booking.paymentMethod),
      truckType: vehicle.name ?? '-',
      roundTrip: booking.isRoundedReturn ? 'Yes' : 'No',
      multiRoute: destinations.length > 1 ? 'Yes' : 'No',
      distance: booking.displayDistance / 1000,
      pickup: origin.placeProvince,
      deliveries: destinations.map((destination) => destination.placeProvince),
      dropPoint: destinations.length,
      // SERVICE
      driverHelpService: includes(services, VALUES.DRIVER_CARRY) ? 'Yes' : 'No',
      addLaborService: includes(services, VALUES.ADDITIONAL_DRIVER) ? 'Yes' : 'No',
      podService: includes(services, VALUES.POD) ? 'Yes' : 'No',
      overnightService: includes(services, VALUES.OVERNIGHT) ? 'Yes' : 'No',
      // COST
      deliveryCost: _calculated.subTotalCost || null,
      roundTripCost: _calculated.subTotalRoundedCost || null,
      multiRouteCost: _calculated.subTotalDropPointCost || null,
      driverHelpCost: getAdditionalPrice(additionalServices, VALUES.DRIVER_CARRY)?.cost ?? null,
      addLaborCost: getAdditionalPrice(additionalServices, VALUES.ADDITIONAL_DRIVER)?.cost ?? null,
      podCost: getAdditionalPrice(additionalServices, VALUES.POD)?.cost ?? null,
      overnightCost: getAdditionalPrice(additionalServices, VALUES.OVERNIGHT)?.cost ?? null,
      // SELL
      deliverySell: _calculated.subTotalPrice || null,
      roundTripSell: _calculated.subTotalRoundedPrice || null,
      multiRouteSell: _calculated.subTotalDropPointPrice || null,
      driverHelpSell: getAdditionalPrice(additionalServices, VALUES.DRIVER_CARRY)?.price ?? null,
      addLaborSell: getAdditionalPrice(additionalServices, VALUES.ADDITIONAL_DRIVER)?.price ?? null,
      podSell: getAdditionalPrice(additionalServices, VALUES.POD)?.price ?? null,
      overnightSell: getAdditionalPrice(additionalServices, VALUES.OVERNIGHT)?.price ?? null,
      // TOTAL
      totalCost: _cost.subTotal,
      totalSell: _price.subTotal,
      discount: _discount.price,
      tax: _price.tax,
      total: _price.total,
      profit: sum([_price.total, -_cost.total]),
    }
  })

  const workbook = await generateBookingReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/booking',
    `booking-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)

  return filePath
}

export async function getAdminCutomerReport(query: any) {
  const customerIds = await UserModel.find({ userRole: EUserRole.CUSTOMER }).sort({ userNumber: 1 }).distinct('_id')
  const customers = await UserModel.find({ _id: { $in: customerIds } })

  const workbookData: CustomerReport[] = await Aigle.map(customers, async (customer) => {
    const _address = customer.addressData
    const _businessDetail = customer.businessDetail as BusinessCustomer | undefined
    return {
      fullname: customer.fullname,
      userNumber: customer.userNumber,
      userType: getUserType(customer.userType),
      taxId: customer.taxId,
      contactNumber: customer.contactNumber,
      email: customer.email,
      province: _address?.province,
      address: _address?.address,
      branch: _businessDetail?.businessBranch ?? '',
      businessType: _businessDetail?.businessType ?? '',
      approvalStatus: getUserApprovalStatus(customer.validationStatus),
      status: getUserStatus(customer.status),
      paymentMethod: _businessDetail?.paymentMethod === EPaymentMethod.CREDIT ? 'เครดิต' : 'เงินสด',
      registeredDate: customer.createdAt ? fDate(customer.createdAt, 'dd/MM/yyyy HH:mm') : '',
      lastActiveDate: '',
      lastBooked: '',
      totalShipment: 0,
      success: 0,
      cancelledCustomer: 0,
      cancelledDriver: 0,
      cancelledAdmin: 0,
    }
  })

  const workbook = await generateCustomerReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/customer',
    `customer-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)

  return filePath
}

export async function getAdminDriverReport(query: any) {
  const driverIds = await UserModel.find({ userRole: EUserRole.DRIVER }).sort({ userNumber: 1 }).distinct('_id')
  const drivers = await UserModel.find({ _id: { $in: driverIds } })

  const workbookData: DriverReport[] = await Aigle.map(drivers, async (driver) => {
    const _driverDetail = driver.driverDetail as DriverDetail | undefined
    const _parents = await getAgentParents(driver._id)
    const _vehicle = (_driverDetail.serviceVehicleTypes as VehicleType[]) || []

    return {
      driverId: driver.userNumber,
      fullname: driver.fullname,
      userType: getDriverType(driver.userType),
      haveAgent:
        (driver.parents || []).length > 0 ? `Yes (${_parents.map((parent) => parent.fullname).join(', ')})` : 'No',
      contactNumber: driver.contactNumber,
      lineId: _driverDetail?.lineId,
      email: driver.email,
      status: getUserStatus(driver.status),
      vehicleType: _vehicle.map((vehicle) => vehicle.name).join(', '),
      licensePlate: '',
      registeredDate: driver.createdAt ? fDate(driver.createdAt, 'dd/MM/yyyy HH:mm') : '',
      lastActiveDate: '',
      lastShipmentDate: '',
      totalShipment: 0,
      success: 0,
      cancelledCustomer: 0,
      cancelledDriver: 0,
      cancelledAdmin: 0,
      bankAccount: getBankProviderName(_driverDetail?.bank),
      bankAccountNumber: _driverDetail?.bankNumber,
    }
  })

  const workbook = await generateDriverReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/driver',
    `driver-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)

  return filePath
}

export async function getDebtorReport() {
  const billingIds = await BillingModel.find().sort({ issueDate: 1 }).distinct('_id')
  const billings = await BillingModel.find({ _id: { $in: billingIds } })

  const workbookData: DebtorReport[] = await Aigle.map(billings, async (billing) => {
    const _user = billing.user as User | undefined
    const _businessDetail = _user.businessDetail as BusinessCustomer | undefined
    const _invoice = billing.invoice as Invoice | undefined
    const _receipts = billing.receipts as Receipt[]
    const _payment = billing.payments as Payment[]

    const _workingPeriod = `${fDate(billing.billingStartDate, 'dd/MM/yyyy')} - ${fDate(
      billing.billingEndDate,
      'dd/MM/yyyy',
    )}`
    return {
      customerId: _user.userNumber,
      name: _user.fullname,
      branch: _businessDetail?.businessBranch ?? '-',
      customerType: getUserType(_user.userType),
      taxId: _user.taxId,
      address: _user.address ?? '-',
      email: _user.email ?? '-',
      contactNumber: _user.contactNumber ?? '-',
      workingPeriod: _workingPeriod,
      duedate: fDate(billing.paymentDueDate, 'dd/MM/yyyy'),
      paymentStatus: getBillingStatus(billing),
      overdueCount: getOverdueDate(billing),
      paymentType: getPaymentType(billing.paymentMethod),
      invoiceNo: _invoice?.invoiceNumber ?? '-',
      invoiceTotal: _invoice?.total || null,
      invoiceDate: fDate(_invoice?.invoiceDate, 'dd/MM/yyyy'),
      ajustmentDecreaseNo: null,
      ajustmentDecreaseTotal: null,
      ajustmentDecreaseDate: null,
      ajustmentIncreaseNo: null,
      ajustmentIncreaseTotal: null,
      ajustmentIncreaseDate: null,
      receiptNo: _receipts.map((receipt) => receipt.receiptNumber).join(', '),
      paymentDate: _payment.map((payment) => fDate(payment.createdAt, 'dd/MM/yyyy')).join(', '),
      receiptDate: _receipts.map((receipt) => fDate(receipt.receiptDate, 'dd/MM/yyyy')).join(', '),
    }
  })

  const workbook = await generateDebtorReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/debtor',
    `debtor-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)
}

export async function getCreditorReport() {
  const paymentIds = await DriverPaymentModel.find().sort({ issueDate: 1 }).distinct('_id')
  const payments = await DriverPaymentModel.find({ _id: { $in: paymentIds } })

  const workbookData: CreditorReport[] = await Aigle.map(payments, async (creditor) => {
    const _driver = creditor.driver as User | undefined
    const _driverDetail = _driver?.driverDetail as DriverDetail | undefined
    const _shipments = creditor.shipments as Shipment[]

    const _creditorShipments = _shipments.map((shipment) => {
      const _step = find(shipment.steps, ['step', EStepDefinition.FINISH]) as StepDefinition | undefined
      const _qoutation = last(shipment.quotations) as Quotation | undefined
      if (_step && _step.stepStatus === EStepStatus.DONE) {
        return {
          shipmentNo: shipment.trackingNumber,
          finishedDate: fDate(_step.updatedAt, 'dd/MM/yyyy'),
          value: _qoutation?.cost?.total || null,
        }
      }
      return {
        shipmentNo: shipment.trackingNumber,
        finishedDate: '-',
        value: _qoutation?.cost?.total || null,
      }
    })

    return {
      userId: _driver?.userNumber,
      userType: getDriverType(_driver?.userType),
      fullname: _driver?.fullname,
      branch: _driverDetail.businessBranch ?? '',
      taxId: _driver?.taxId,
      address: _driver?.address,
      email: _driver?.email,
      contactNumber: _driver?.contactNumber,
      workingPeriod: '',
      duedate: '',
      overdueCount: '',
      shipments: _creditorShipments,
      subtotal: creditor.subtotal,
      whtValue: creditor.tax,
      total: creditor.total,
      paymentDate: fDate(creditor.paymentDate, 'dd/MM/yyyy'),
      receiptNo: '',
      whtNo: '',
    }
  })

  const workbook = await generateCreditorReport(workbookData)
  const generatedDate = fDateTime(Date.now(), 'yyyyMMddHHmm')
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'generated/report/admin/creditor',
    `creditor-report-${generatedDate}.xlsx`,
  )
  await workbook.xlsx.writeFile(filePath)
}
