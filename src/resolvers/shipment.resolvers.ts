import { GraphQLContext } from "@configs/graphQL.config";
import { AuthGuard } from "@guards/auth.guards";
import PaymentModel, { Payment } from "@models/payment.model";
import PrivilegeModel from "@models/privilege.model";
import ShipmentModel, { Shipment, ShipmentInput } from "@models/shipment.model";
import ShipmentPricingModel from "@models/shipmentPricing.model";
import UserModel, { User } from "@models/user.model";
import { generateId } from "@utils/string.utils";
import { get } from "lodash";
import { Arg, Ctx, FieldResolver, Mutation, Query, Resolver, Root, UseMiddleware } from "type-graphql";

@Resolver(Shipment)
export default class ShipmentResolver {
    @Query(() => Shipment)
    @UseMiddleware(AuthGuard)
    async shipment(@Arg('id') id: string): Promise<Shipment> {
        try {
            const shipment = await ShipmentModel.findById(id)
            return shipment
        } catch (error) {
            console.log(error)
            throw new Error('Failed to get shipment')
        }
    }

    @Query(() => [Shipment])
    @UseMiddleware(AuthGuard)
    async shipments(): Promise<Shipment[]> {
        try {
            const shipment = await ShipmentModel.find()
            return shipment
        } catch (error) {
            console.log(error)
            throw new Error('Failed to get shipments')
        }
    }

    @Query(() => [Shipment])
    async customerShipments(@Arg('customerId') customerId: string): Promise<Shipment[]> {
        try {
            const shipments = await ShipmentModel.find({ customer: customerId })
            return shipments
        } catch (error) {
            console.error('Error fetching shipments:', error)
            return []
        }
    }

    @FieldResolver(() => User)
    async customer(@Root() shipment: Shipment): Promise<User | null> {
        try {
            const customerId = get(shipment, '_doc.customer', '') || get(shipment, 'customer', '')
            const customer = await UserModel.findById(customerId)
            if (!customer) { return null }
            return customer
        } catch (error) {
            console.error('Error get customer:', error);
            return null;
        }
    }

    @FieldResolver(() => User)
    async driver(@Root() shipment: Shipment): Promise<User | null> {
        try {
            const driverId = get(shipment, '_doc.driver', '') || get(shipment, 'driver', '')
            const driver = await UserModel.findById(driverId)
            if (!driver) { return null }
            return driver
        } catch (error) {
            console.error('Error get driver:', error);
            return null;
        }
    }

    @FieldResolver(() => Payment)
    async payment(@Root() shipment: Shipment): Promise<Payment | null> {
        try {
            const paymentId = get(shipment, '_doc.payment', '') || get(shipment, 'payment', '')
            const payment = await PaymentModel.findById(paymentId)
            if (!payment) { return null }
            return payment
        } catch (error) {
            console.error('Error get payment:', error);
            return null;
        }
    }

    @Mutation(() => Shipment)
    @UseMiddleware(AuthGuard)
    async createShipment(@Arg('data') data: ShipmentInput, @Ctx() ctx: GraphQLContext): Promise<Shipment> {
        try {
            const user_id = ctx.req.user_id
            // TODO: Create get pricing config 
            // TODO: Calculate distance and pricing here
            const amount = '7000'

            // data.privilege
            let discount = 0
            if (data.privilege) {
                const privilege = await PrivilegeModel.findById(data.privilege)
                if (privilege.discount_unit === 'CURRENCY') {
                    discount = privilege.discount_number
                } else if (privilege.discount_unit === 'PERCENTAGE') {
                    // before this must calculate route sub total first
                    // privilege.discount_number

                }
            }

            // TODO
            const shipmentPricing = new ShipmentPricingModel({ amount })
            await shipmentPricing.save()

            // TODO
            const payment = new PaymentModel({ amount })
            await payment.save()

            const tracking_number = generateId('TT', 'tracking')
            const shipment = new ShipmentModel({
                customer: user_id,
                ...data,
                tracking_number,
                status: 'PENDING',
                shiping_pricing: shipmentPricing,
                payment,

                // route: data,
                // vehicle_type: data.vehicle_type,
                // receive_datetime: data.receive_datetime,
                // broker_name: data.broker_name,
                // remark: data.remark,
                // transtrack_number: transtrack_number,
                // ct_status: 'ABCDEFG',
                // status: 'CUSTOMER_APPOINTMENT_SCHEDULED',
            })
            await shipment.save()

            return shipment
        } catch (error) {
            console.log(error)
            throw new Error('Failed to create shipment')
        }
    }
}