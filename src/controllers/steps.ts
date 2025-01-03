import { EPaymentMethod } from '@enums/payments'
import ShipmentModel from '@models/shipment.model'
import StepDefinitionModel, {
  EStepDefinition,
  EStepDefinitionName,
  EStepStatus,
} from '@models/shipmentStepDefinition.model'
import { filter, flatten, get, isEqual, map, range, values } from 'lodash'
import { ClientSession } from 'mongoose'

export async function initialStepDefinition(
  shipmentId: string,
  isReMatching?: boolean,
  session?: ClientSession,
): Promise<boolean> {
  const _shipment = await ShipmentModel.findById(shipmentId).session(session)
  const dropoffLength = _shipment.destinations.length - 1
  const podServiceRaws = filter(_shipment.additionalServices, (service) => {
    const name = get(service, 'reference.additionalService.name', '')
    return isEqual(name, 'POD')
  })

  const isPODService = podServiceRaws.length > 0
  const paymentMethod = _shipment.paymentMethod
  const isCashMethod = isEqual(paymentMethod, EPaymentMethod.CASH)
  const bulkOperations = [
    {
      insertOne: {
        document: {
          step: EStepDefinition.CREATED,
          seq: 0,
          stepName: EStepDefinitionName.CREATED,
          customerMessage: 'งานเข้าระบบ',
          driverMessage: '',
          stepStatus: EStepStatus.DONE,
        },
      },
    },
    ...(isCashMethod
      ? [
          {
            insertOne: {
              document: {
                step: EStepDefinition.CASH_VERIFY,
                seq: 0,
                stepName: EStepDefinitionName.CASH_VERIFY,
                customerMessage: 'ยืนยันการชำระเงิน',
                driverMessage: '',
                stepStatus: isReMatching ? EStepStatus.DONE : EStepStatus.PROGRESSING,
              },
            },
          },
        ]
      : []),
    {
      insertOne: {
        document: {
          step: EStepDefinition.DRIVER_ACCEPTED,
          seq: 0,
          stepName: EStepDefinitionName.DRIVER_ACCEPTED,
          customerMessage: 'รอคนขับตอบรับ',
          driverMessage: '',
          stepStatus: isCashMethod
            ? isReMatching
              ? EStepStatus.PROGRESSING
              : EStepStatus.IDLE
            : EStepStatus.PROGRESSING,
        },
      },
    },
    {
      insertOne: {
        document: {
          step: EStepDefinition.CONFIRM_DATETIME,
          seq: 0,
          stepName: EStepDefinitionName.CONFIRM_DATETIME,
          customerMessage: 'นัดหมายและยืนยันเวลา',
          driverMessage: 'นัดหมายและยืนยันเวลา',
          stepStatus: EStepStatus.IDLE,
        },
      },
    },
    {
      insertOne: {
        document: {
          step: EStepDefinition.ARRIVAL_PICKUP_LOCATION,
          seq: 0,
          stepName: EStepDefinitionName.ARRIVAL_PICKUP_LOCATION,
          customerMessage: 'ถึงจุดรับสินค้า',
          driverMessage: 'จุดรับสินค้า',
          stepStatus: EStepStatus.IDLE,
        },
      },
    },
    {
      insertOne: {
        document: {
          step: EStepDefinition.PICKUP,
          seq: 0,
          stepName: EStepDefinitionName.PICKUP,
          customerMessage: 'ขึ้นสินค้าที่จุดรับสินค้า',
          driverMessage: 'ขึ้นสินค้าที่จุดรับสินค้า',
          stepStatus: EStepStatus.IDLE,
        },
      },
    },
    ...flatten(
      map(range(1, dropoffLength + 1), (seq, index) => {
        const isMultiple = dropoffLength > 1
        const isLatest = index >= dropoffLength - 1
        return [
          {
            insertOne: {
              document: {
                step: EStepDefinition.ARRIVAL_DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
                customerMessage: isMultiple ? `ถึงจุดส่งสินค้าที่ ${seq}` : 'ถึงจุดส่งสินค้า',
                driverMessage: isMultiple ? `จุดส่งสินค้าที่ ${seq}${isLatest ? ' (จุดสุดท้าย)' : ''}` : 'จุดส่งสินค้า',
                stepStatus: EStepStatus.IDLE,
                meta: seq,
              },
            },
          },
          {
            insertOne: {
              document: {
                step: EStepDefinition.DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.DROPOFF,
                customerMessage: isMultiple ? `จัดส่งสินค้าจุดที่ ${seq}` : 'จัดส่งสินค้า',
                driverMessage: isMultiple ? `จุดส่งสินค้าที่ ${seq}${isLatest ? ' (จุดสุดท้าย)' : ''}` : 'จุดส่งสินค้า',
                stepStatus: EStepStatus.IDLE,
                meta: seq,
              },
            },
          },
        ]
      }),
    ),
    ...(_shipment.isRoundedReturn
      ? [
          {
            insertOne: {
              document: {
                step: EStepDefinition.ARRIVAL_DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.ARRIVAL_DROPOFF,
                customerMessage: 'ถึงจุดส่งสินค้ากลับ',
                driverMessage: 'จุดส่งสินค้า(กลับไปยังต้นทาง)',
                stepStatus: EStepStatus.IDLE,
              },
            },
          },
          {
            insertOne: {
              document: {
                step: EStepDefinition.DROPOFF,
                seq: 0,
                stepName: EStepDefinitionName.DROPOFF,
                customerMessage: 'จัดส่งสินค้ากลับ',
                driverMessage: 'จุดส่งสินค้า (กลับไปยังต้นทาง)',
                stepStatus: EStepStatus.IDLE,
              },
            },
          },
        ]
      : []),
    ...(isPODService
      ? [
          {
            insertOne: {
              document: {
                step: EStepDefinition.POD,
                seq: 0,
                stepName: EStepDefinitionName.POD,
                customerMessage: 'แนบเอกสารและส่งเอกสาร POD',
                driverMessage: 'แนบเอกสารและส่งเอกสาร POD',
                stepStatus: EStepStatus.IDLE,
              },
            },
          },
        ]
      : []),
    {
      insertOne: {
        document: {
          step: EStepDefinition.FINISH,
          seq: 0,
          stepName: EStepDefinitionName.FINISH,
          customerMessage: 'รอยืนยันการจบงาน',
          driverMessage: 'ยืนยันการจัดส่งสำเร็จ',
          stepStatus: EStepStatus.IDLE,
        },
      },
    },
  ]

  const reSequenceBulkOperation = map(bulkOperations, ({ insertOne: { document } }, index) => ({
    insertOne: {
      document: {
        ...document,
        seq: index,
      },
    },
  }))

  const stepDefinitionResult = await StepDefinitionModel.bulkWrite(reSequenceBulkOperation, { session })
  const _stepDefinitionIds = values(stepDefinitionResult.insertedIds)
  await ShipmentModel.findByIdAndUpdate(
    _shipment._id,
    { steps: _stepDefinitionIds, currentStepSeq: isReMatching ? (isCashMethod ? 2 : 1) : 1 },
    { session },
  )

  return true
}
