import { GetCustomersArgs } from "@inputs/user.input"
import { PipelineStage } from "mongoose"

export const GET_USERS = (query: GetCustomersArgs): PipelineStage[] => [
    { $match: query },
    {
        $lookup: {
            from: "businesscustomers",
            localField: "businessDetail",
            foreignField: "_id",
            as: "businessDetail",
            pipeline: [
                {
                    $lookup: {
                        from: "businesscustomercreditpayments",
                        localField: "creditPayment",
                        foreignField: "_id",
                        as: "creditPayment"
                    }
                },
                {
                    $unwind: {
                        path: "$creditPayment",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "businesscustomercashpayments",
                        localField:
                            "cashPayment",
                        foreignField: "_id",
                        as: "cashPayment"
                    }
                },
                {
                    $unwind: {
                        path: "$cashPayment",
                        preserveNullAndEmptyArrays: true
                    }
                },
            ]
        }
    },
    {
        $unwind: {
            path: "$businessDetail",
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $lookup: {
            from: "individualcustomers",
            localField: "individualDetail",
            foreignField: "_id",
            as: "individualDetail"
        }
    },
    {
        $unwind: {
            path: "$individualDetail",
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $lookup: {
            from: "admins",
            localField: "adminDetail",
            foreignField: "_id",
            as: "adminDetail"
        }
    },
    {
        $unwind: {
            path: "$adminDetail",
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $lookup: {
            from: "files",
            localField: "profileImage",
            foreignField: "_id",
            as: "profileImage"
        }
    },
    {
        $unwind: {
            path: "$profileImage",
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $addFields: {
            statusWeight: {
                $switch: {
                    branches: [
                        {
                            case: {
                                $eq: ["$status", "pending"]
                            },
                            then: 0
                        }
                    ],
                    default: 1
                }
            }
        }
    }
]