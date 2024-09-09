import Bull from 'bull'

export interface ShipmentPayload {
  shipmentId: string;
}

export interface FCMShipmentPayload {
  shipmentId: string;
  driverId?: string
}

// สร้าง queue สำหรับ monitor shipment
export const monitorShipmentQueue = new Bull<FCMShipmentPayload>('monitorShipment');

// สร้าง queue สำหรับ cancel shipment
export const cancelShipmentQueue = new Bull<ShipmentPayload>('cancelShipment');