import { prop as Property, getModelForClass } from '@typegoose/typegoose'

export class Couter {
    @Property({ required: true, default: 0 })
    customer_counter: number

    @Property({ required: true, default: 0 })
    business_counter: number

    @Property({ required: true, default: 0 })
    driver_counter: number

    @Property({ required: true, default: 0 })
    admin_counter: number

    @Property({ required: true, default: 0 })
    tracking_counter: number

    @Property({ required: true, default: 0 })
    upload: number

    static async getNextCouter(type: TGenerateIDType): Promise<number> {
        const query_option = { upsert: true, new: true }
        if (type === 'individual') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { customer_counter: 1 } }, query_option)
            return counter.customer_counter
        } else if (type === 'business') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { business_counter: 1 } }, query_option)
            return counter.business_counter
        } else if (type === 'driver') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { driver_counter: 1 } }, query_option)
            return counter.driver_counter
        } else if (type === 'admin') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { admin_counter: 1 } }, query_option)
            return counter.admin_counter
        } else if (type === 'tracking') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { tracking_counter: 1 } }, query_option)
            return counter.tracking_counter
        } else if (type === 'upload') {
            const counter = await CouterModel.findOneAndUpdate({}, { $inc: { upload: 1 } }, query_option)
            return counter.upload
        }
        return 0
    }
}

const CouterModel = getModelForClass(Couter)

export default CouterModel