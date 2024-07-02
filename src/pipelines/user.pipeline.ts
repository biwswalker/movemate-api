import { GetCustomersArgs } from "@inputs/user.input"
import { PipelineStage } from "mongoose"

export const GET_USERS = ({ email, name, phoneNumber, taxId, userNumber, username, ...query }: Partial<GetCustomersArgs>): PipelineStage[] => {

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
            } : {}

    return [
        {
            $match: {
                ...query,
                ...(userNumber
                    ? { userNumber: { $regex: userNumber, $options: "i" } }
                    : {}),
                ...(username
                    ? { username: { $regex: username, $options: "i" } }
                    : {}),
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
        },
        { $match: detailMatch }
    ]
}