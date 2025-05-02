import { EShipmentStatus } from '@enums/shipments'
import { EUserRole, EUserValidationStatus } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import ShipmentModel from '@models/shipment.model'
import UserModel from '@models/user.model'
import {
  DashboardFinancialPayload,
  DashboardPayload,
  DashboardRegisteredPayload,
  DashboardShipmentPayload,
} from '@payloads/dashboard.payloads'
import { addMonths, endOfMonth, startOfMonth } from 'date-fns'
import { Query, Resolver, UseMiddleware } from 'type-graphql'

@Resolver()
export default class DashboardResolver {
  @Query(() => DashboardPayload)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async getDashboard(): Promise<DashboardPayload> {
    const currentDate = new Date()
    const startMonthDate = startOfMonth(currentDate)
    const endMonthDate = endOfMonth(currentDate)
    const startPrevMonthDate = startOfMonth(addMonths(currentDate, -1))
    const endPrevMonthDate = endOfMonth(addMonths(currentDate, -1))

    // Shipment: Daily
    const shipmentDaily = await ShipmentModel.countDocuments({ bookingDateTime: { $eq: currentDate } })
    const shipmentPrevDaily = 0
    const shipmentDailyPercent = 0
    // Shipment: Monthly
    const shipmentMonthly = await ShipmentModel.countDocuments({
      bookingDateTime: { $gt: startMonthDate, $lt: endMonthDate },
    })
    const shipmentPrevMonthly = 0
    const shipmentMonthlyPercent = 0
    // Shipment: All
    const shipmentAll = await ShipmentModel.countDocuments()
    const shipmentCancelled = await ShipmentModel.countDocuments({ status: EShipmentStatus.CANCELLED })
    // Shipment: Finish
    const shipmentFinish = await ShipmentModel.countDocuments({ status: EShipmentStatus.DELIVERED })
    const shipmentProgressing = await ShipmentModel.countDocuments({ status: EShipmentStatus.PROGRESSING })
    /**
     * Shipment
     */
    const shipment: DashboardShipmentPayload = {
      daily: shipmentDaily,
      prevDaily: shipmentPrevDaily,
      dailyPercent: shipmentDailyPercent,
      monthly: shipmentMonthly,
      prevMonthly: shipmentPrevMonthly,
      monthlyPercent: shipmentMonthlyPercent,
      all: shipmentAll,
      cancelled: shipmentCancelled,
      finish: shipmentFinish,
      progressing: shipmentProgressing,
    }

    // Financial: Income
    const financialIncome = 0
    const financialPrevIncome = 0
    const financialIncomePercent = 0
    // Financial: Expense
    const financialExpense = 0
    const financialPrevExpense = 0
    const financialExpensePercent = 0
    // Financial: Balance
    const financialBalance = 0
    const financialPrevBalance = 0
    const financialBalancePercent = 0
    // Financial: Tax
    const financialTax = 0
    const financialPrevTax = 0
    const financialTaxPercent = 0
    /**
     * Financial
     */
    const financial: DashboardFinancialPayload = {
      income: financialIncome,
      prevIncome: financialPrevIncome,
      incomePercent: financialIncomePercent,
      expense: financialExpense,
      prevExpense: financialPrevExpense,
      expensePercent: financialExpensePercent,
      balance: financialBalance,
      prevBalance: financialPrevBalance,
      balancePercent: financialBalancePercent,
      tax: financialTax,
      prevTax: financialPrevTax,
      taxPercent: financialTaxPercent,
    }

    // Registered: Pending
    const registerPending = await UserModel.countDocuments({
      userRole: EUserRole.CUSTOMER,
      validationStatus: EUserValidationStatus.PENDING,
    })
    const registerDenied = await UserModel.countDocuments({
      userRole: EUserRole.CUSTOMER,
      validationStatus: EUserValidationStatus.DENIED,
    })
    // Registered: Monthly
    const registerMonthly = await UserModel.countDocuments({
      userRole: EUserRole.CUSTOMER,
      createdAt: { $gt: startMonthDate, $lt: endMonthDate },
    })
    const registerPrevMonthly = await UserModel.countDocuments({
      userRole: EUserRole.CUSTOMER,
      validationStatus: EUserValidationStatus.PENDING,
      createdAt: { $gt: startPrevMonthDate, $lt: endPrevMonthDate },
    })
    const registerMonthlyPercent = 0
    // Registered: All
    const registerAll = await UserModel.countDocuments()
    const registerConfirmed = await UserModel.countDocuments({ isVerifiedPhoneNumber: true, isVerifiedEmail: true })
    /**
     * Registered
     */
    const registered: DashboardRegisteredPayload = {
      pending: registerPending,
      denied: registerDenied,
      monthly: registerMonthly,
      prevMonthly: registerPrevMonthly,
      monthlyPercent: registerMonthlyPercent,
      all: registerAll,
      confirmed: registerConfirmed,
    }

    return {
      shipment,
      financial,
      registered,
    }
  }
}
