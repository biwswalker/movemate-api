import { PipelineStage, Types } from "mongoose";


export const GET_VEHICLE_COST = (vehicleTypeId: string): PipelineStage[] => [
    {
        $match: {
            vehicleType: new Types.ObjectId(vehicleTypeId)
        }
    },
    // Populate additionalServices
    {
        $lookup: {
            from: "additionalservicecostpricings",
            localField: "additionalServices",
            foreignField: "_id",
            as: "additionalServices",
            pipeline: [
                // Populate additionalService within additionalServices
                {
                    $lookup: {
                        from: "additionalservices",
                        localField: "additionalService",
                        foreignField: "_id",
                        as: "additionalService",
                        pipeline: [
                            {
                                $addFields: {
                                    descriptions: {
                                        $map: {
                                            input: "$descriptions",
                                            as: "doc",
                                            in: {
                                                detail: "$$doc.detail",
                                                vehicleTypes: {
                                                    $map: {
                                                        input:
                                                            "$$doc.vehicleTypes",
                                                        as: "vtypes",
                                                        in: {
                                                            _id: "$$vtypes"
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    $unwind: {
                        path: "$additionalService",
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]
        }
    },
    // Re-populate vehicleType
    {
        $lookup: {
            from: "vehicletypes",
            localField: "vehicleType",
            foreignField: "_id",
            as: "vehicleType",
            pipeline: [
                {
                    $lookup: {
                        from: "files",
                        localField: "image",
                        foreignField: "_id",
                        as: "image"
                    }
                },
                {
                    $unwind: {
                        path: "$image",
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]
        }
    },
    {
        $unwind: "$vehicleType"
    },
    {
        $lookup: {
            from: "distancecostpricings",
            localField: "distance",
            foreignField: "_id",
            as: "distance"
        }
    },
    // Project the necessary fields
    {
        $project: {
            _id: 1,
            vehicleType: 1,
            distance: 1,
            additionalServices: 1,
            createdAt: 1,
            updatedAt: 1
        }
    },
]