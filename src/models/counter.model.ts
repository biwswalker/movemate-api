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
        }
        return 0
    }
}

const CouterModel = getModelForClass(Couter)

export default CouterModel