import { GraphQLContext } from "@configs/graphQL.config";
import CouterModel from "@models/counter.model";
// import { format } from "date-fns";
// import { toZonedTime } from "date-fns-tz";
import padStart from "lodash/padStart";
import get from "lodash/get";

export function generateRandomNumberPattern(pattern = 'MM##########'): string {
    let trackingNumber: string = '';

    for (let i = 0; i < pattern.length; i++) {
        const currentChar: string = pattern.charAt(i);
        if (currentChar === '#') {
            trackingNumber += Math.floor(Math.random() * 10).toString();
        } else {
            trackingNumber += currentChar;
        }
    }

    return trackingNumber;
}

export const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

export const generateRef = (length = 4) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ref = '';
    for (let i = 0; i < length; i++) {
        ref += chars[Math.floor(Math.random() * chars.length)];
    }
    return ref;
};

export async function generateId(prefix: string, type: TGenerateIDType) {
    const counter = await CouterModel.getNextCouter(type)
    // const nowUTC = utcToZonedTime(new Date(), 'UTC')
    // const datetime_id = format(nowUTC, 'yyMM')
    const running_id = padStart(`${counter}`, 4, '0')
    return `${prefix}${running_id}`
}

export async function generateTrackingNumber(prefix: string, type: TGenerateIDType, len = 6) {
    const counter = await CouterModel.getNextCouter(type)
    const counterNumberStr = `${counter}`
    const running_id = counterNumberStr.length > len ? counterNumberStr : padStart(counterNumberStr, len, '0')
    return `${prefix}${running_id}`
}

export function getCurrentHost(ctx: GraphQLContext) {
    const protocol = get(ctx, 'req.protocol', 'https')
    const host = ctx.req.get('host')
    const activate_link = `${protocol}://${host}`
    return activate_link
}