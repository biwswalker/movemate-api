import { GetUserArgs } from "@inputs/user.input"
import { PipelineStage, Types } from "mongoose"

export const GET_USERS = ({ email, name, phoneNumber, taxId, userNumber, username, lineId, serviceVehicleType, ...query }: Partial<GetUserArgs>): PipelineStage[] => {

    // lineId, serviceVehicleType

    const detailMatch = (query.userRole === 'customer' && query.userType === 'individual')
        ? {
            ...(email
                ? { "individualDetail.email": { $regex: email, $options: "i" } }
                : {}),
            ...(name
                ? {
                    $or: [{ "individualDetail.firstname": { $regex: name, $options: "i" } }, { "individualDetail.lastname": { $regex: name, $options: "i" } }],
                }
                : {}),
            ...(phoneNumber
                ? { "individualDetail.phoneNumber": { $regex: phoneNumber, $options: "i" } }
                : {}),
            ...(taxId
                ? { "individualDetail.taxId": { $regex: taxId, $options: "i" } }
                : {}),
        }
        : (query.userRole === 'customer' && query.userType === 'business')
            ? {
                ...(email
                    ? { "businessDetail.businessEmail": { $regex: email, $options: "i" } }
                    : {}),
                ...(name
                    ? { "businessDetail.businessName": { $regex: name, $options: "i" } }
                    : {}),
                ...(phoneNumber
                    ? { "businessDetail.contactNumber": { $regex: phoneNumber, $options: "i" } }
                    : {}),
                ...(taxId
                    ? { "businessDetail.taxNumber": { $regex: taxId, $options: "i" } }
                    : {}),
            }
            : (query.userRole === 'driver' && query.userType === 'individual')
                ? {
                    ...(lineId
                        ? { "individualDriver.lineId": { $regex: lineId, $options: "i" } }
                        : {}),
                    ...(name
                        ? { $or: [{ "individualDriver.firstname": { $regex: name, $options: "i" } }, { "individualDriver.lastname": { $regex: name, $options: "i" } }], }
                        : {}),
                    ...(phoneNumber
                        ? { "individualDriver.phoneNumber": { $regex: phoneNumber, $options: "i" } }
                        : {}),
                    ...(taxId
                        ? { "individualDriver.taxId": { $regex: taxId, $options: "i" } }
                        : {}),
                    ...(serviceVehicleType
                        ? { "individualDriver.serviceVehicleType._id": new Types.ObjectId(serviceVehicleType) }
                        : {}),
                } : {}

    const statusFilter = query.userRole === 'customer'
        ? [...((query.userType === 'business' && query.status === 'pending') || (query.userType === 'business' && query.status === undefined) ? [{
            userType: 'individual',
            validationStatus: 'pending',
            upgradeRequest: { $ne: null }
        }] : [])]
        : []

    return [
        {
            $match: {
                $or: [
                    {
                        ...query,
                        ...(userNumber
                            ? { userNumber: { $regex: userNumber, $options: "i" } }
                            : {}),
                        ...(username
                            ? { username: { $regex: username, $options: "i" } }
                            : {}),
                    },
                    ...statusFilter,
                ]
            }
        },
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
                from: "businesscustomers",
                localField: "upgradeRequest",
                foreignField: "_id",
                as: "upgradeRequest",
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
                path: "$upgradeRequest",
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
                from: "individualdrivers",
                localField: "individualDriver",
                foreignField: "_id",
                as: "individualDriver",
                pipeline: [
                    {
                        $lookup: {
                            from: "vehicletypes",
                            localField: "serviceVehicleType",
                            foreignField: "_id",
                            as: "serviceVehicleType",
                            pipeline: [
                                {
                                    $lookup: {
                                        from: "files",
                                        localField: "image",
                                        foreignField: "_id",
                                        as: "image",
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
                        $unwind: {
                            path: "$serviceVehicleType",
                            preserveNullAndEmptyArrays: true
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$individualDriver",
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
        },
        { $match: detailMatch }
    ]
}

export const EXISTING_USERS = (_id: string, email: string, userType: TUserType, userRole: TUserRole) => [
    {
        $match: {
            _id: { $ne: new Types.ObjectId(_id) },
            userRole,
            userType,
        }
    },
    ...(userRole === 'customer'
        ? userType === 'individual'
            ? [
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
                { $match: { "individualDetail.email": email } }
            ]
            : [
                {
                    $lookup: {
                        from: "businesscustomers",
                        localField: "businessDetail",
                        foreignField: "_id",
                        as: "businessDetail"
                    }
                },
                {
                    $unwind: {
                        path: "$businessDetail",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { "businessDetail.businessEmail": email } }
            ]
        : [])

]

export const GET_CUSTOMER_BY_EMAIL = (email: string) => [
    {
        $lookup: {
            from: 'individualcustomers',
            localField: 'individualDetail',
            foreignField: '_id',
            as: 'individualDetail'
        }
    },
    {
        $lookup: {
            from: 'businesscustomers',
            localField: 'businessDetail',
            foreignField: '_id',
            as: 'businessDetail'
        }
    },
    {
        $match: {
            $or: [
                { 'individualDetail.email': email },
                { 'businessDetail.businessEmail': email }
            ]
        }
    },
    {
        $unwind: {
            path: '$individualDetail',
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $unwind: {
            path: '$businessDetail',
            preserveNullAndEmptyArrays: true
        }
    }
]