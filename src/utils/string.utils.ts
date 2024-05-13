import CouterModel from "@models/counter.model";
import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { padStart } from "lodash";

export function generateRandomNumberPattern(pattern = 'TT##########'): string {
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

export async function generateId(prefix: string, type: TGenerateIDType) {
    const counter = await CouterModel.getNextCouter(type)
    // const nowUTC = utcToZonedTime(new Date(), 'UTC')
    // const datetime_id = format(nowUTC, 'yyMM')
    const running_id = padStart(`${counter}`, 4, '0')
    return `${prefix}${running_id}`
}