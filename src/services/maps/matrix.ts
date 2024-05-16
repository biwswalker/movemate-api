import axios from "axios";
import { GOOGLEAPI_DISTANCE_MATRIX } from '../constants'

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

async function getDistanceMatrix(origin: string, destinations: string): Promise<IDistanceMatrixResponse> {
    try {
        const response = await Promise.resolve({
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
        })
        return response
    } catch (error) {
        throw new Error(error)
    }
}

export {
    getDistanceMatrix
}