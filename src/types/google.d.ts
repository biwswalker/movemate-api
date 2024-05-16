interface IDistanceMatrixResponse {
    status: string // If it is "OK," the request was successful.
    originAddresses: string[]
    destinationAddresses: string[]
    rows: IDistanceMatrixRow[]
}

interface IDistanceMatrixRow {
    elements: IDistanceMatrixElement[]
}

interface IDistanceMatrixElement {
    status: string
    duration: IDistanceDuration
    distance: IDistanceValue
}

interface IDistanceDuration {
    value: number // Duration in seconds
    text: string // Human-readable duration
}

interface IDistanceValue {
    value: number // Distance in meters
    text: string // Human-readable distance
}