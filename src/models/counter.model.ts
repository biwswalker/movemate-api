import { prop as Property, getModelForClass } from '@typegoose/typegoose'

export class Couter {
    @Property({ required: true, default: 0 })
    customerCounter: number

    @Property({ required: true, default: 0 })
    businessCounter: number

    @Property({ required: true, default: 0 })
    driverCounter: number

    @Property({ required: true, default: 0 })
    adminCounter: number

    @Property({ required: true, default: 0 })
    trackingCounter: number

    @Property({ required: true, default: 0 })
    upload: number

    @Property({ required: true, default: 0 })
    password: number

    @Property({ required: true, default: 0 })
    payment: number

    @Property({ required: true, default: 0 })
    invoice: number

    @Property({ required: true, default: 0 })
    receipt: number

    @Property({ required: true, default: 0 })
    quotation: number

    @Property({ required: true, default: 0 })
    wht: number

    @Property({ required: true, default: 0 })
    debitnote: number

    @Property({ required: true, default: 0 })
    creditnote: number

    static async getNextCouter(type: TGenerateIDType): Promise<number> {
        const query_option = { upsert: true, new: true }
        if (type === 'individual') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { customerCounter: 1 } }, query_option)
            return counter.customerCounter
        } else if (type === 'business') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { businessCounter: 1 } }, query_option)
            return counter.businessCounter
        } else if (type === 'driver') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { driverCounter: 1 } }, query_option)
            return counter.driverCounter
        } else if (type === 'admin') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { adminCounter: 1 } }, query_option)
            return counter.adminCounter
        } else if (type === 'tracking') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { trackingCounter: 1 } }, query_option)
            return counter.trackingCounter
        } else if (type === 'upload') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { upload: 1 } }, query_option)
            return counter.upload
        } else if (type === 'password') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { password: 1 } }, query_option)
            return counter.password
        } else if (type === 'payment') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { payment: 1 } }, query_option)
            return counter.payment
        } else if (type === 'invoice') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { invoice: 1 } }, query_option)
            return counter.invoice
        } else if (type === 'receipt') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { receipt: 1 } }, query_option)
            return counter.receipt
        } else if (type === 'quotation') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { quotation: 1 } }, query_option)
            return counter.quotation
        } else if (type === 'wht') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { wht: 1 } }, query_option)
            return counter.wht
        } else if (type === 'debitnote') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { debitnote: 1 } }, query_option)
            return counter.debitnote
        } else if (type === 'creditnote') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { creditnote: 1 } }, query_option)
            return counter.creditnote
        }
        return 0
    }
}

const CouterModel = getModelForClass(Couter)

export default CouterModel