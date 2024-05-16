"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDistanceMatrix = void 0;
// TODO: uncomment this
/**
 * How Multiple destination format
 * origin: `${lat},${lng}`
 * destinations: `${lat},${lng}|${lat},${lng}|${lat},${lng}`
 */
// async function getDistanceMatrix(origin: string, destinations: string): Promise<IDistanceMatrixResponse> {
//     const MAP_API_KEY = process.env.MAP_API_KEY
//     try {
//         const response = await axios.get<IDistanceMatrixResponse>(GOOGLEAPI_DISTANCE_MATRIX, {
//             params: {
//                 origin,
//                 destinations,
//                 key: MAP_API_KEY
//             }
//         })
//         return response.data
//     } catch (error) {
//         throw new Error(error)
//     }
// }
function getDistanceMatrix(origin, destinations) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield Promise.resolve({
                status: "OK",
                originAddresses: [
                    origin
                ],
                destinationAddresses: [
                    destinations
                ],
                rows: [
                    {
                        elements: [
                            {
                                status: "OK",
                                duration: {
                                    "value": 255060, // Duration in seconds
                                    "text": "2 days 22 hours" // Human-readable duration
                                },
                                distance: {
                                    "value": 3938812, // Distance in meters
                                    "text": "3,938 km" // Human-readable distance
                                }
                            }
                        ]
                    }
                ]
            });
            return response;
        }
        catch (error) {
            throw new Error(error);
        }
    });
}
exports.getDistanceMatrix = getDistanceMatrix;
//# sourceMappingURL=matrix.js.map