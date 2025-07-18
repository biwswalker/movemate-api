import DriverPaymentModel from "@models/driverPayment.model";
import { ClientSession } from "mongoose";
import { generateWHTCert } from "reports/whtCert";

export async function generateDriverWHTCert(paymentId: string, session?: ClientSession) {
    const _driverPayment = await DriverPaymentModel.findById(paymentId).session(session);
    const { filePath, fileName, document } = await generateWHTCert(_driverPayment, undefined, session)
    return document._id
}