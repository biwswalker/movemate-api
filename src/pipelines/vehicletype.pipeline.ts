import { PipelineStage } from "mongoose";

export const GET_VEHICLE_CONFIG: PipelineStage[] = [
  { $sort: { type: -1 } },
  {
    $lookup: {
      from: "vehiclecosts",
      localField: "_id",
      foreignField: "vehicleType",
      as: "vehicleCosts",
    },
  },
  {
    $unwind: {
      path: "$vehicleCosts",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: "files",
      localField: "image",
      foreignField: "_id",
      as: "image",
    },
  },
  {
    $unwind: {
      path: "$image",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $addFields: {
      isAdditionalServicesConfigured: {
        $gt: [
          {
            $size: {
              $ifNull: ["$vehicleCosts.additionalServices", []],
            },
          },
          0,
        ],
      },
      isDistancesConfigured: {
        $gt: [
          {
            $size: {
              $ifNull: ["$vehicleCosts.distance", []],
            },
          },
          0,
        ],
      },
    },
  },
  {
    $addFields: {
      isConfigured: {
        $or: ["$isAdditionalServicesConfigured", "$isDistancesConfigured"],
      },
    },
  },
  {
    $addFields: {
      typeWeight: {
        $switch: {
          branches: [
            {
              case: {
                $eq: ["$type", "4W"],
              },
              then: 0,
            },
            {
              case: {
                $eq: ["$type", "6W"],
              },
              then: 1,
            },
            {
              case: {
                $eq: ["$type", "10W"],
              },
              then: 2,
            },
            {
              case: {
                $eq: ["$type", "other"],
              },
              then: 3,
            },
          ],
          default: 4,
        },
      },
    },
  },
  { $sort: { typeWeight: 1 } },
  { $project: { vehicleCosts: 0, typeWeight: 0 } },
];
