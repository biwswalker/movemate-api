import { PipelineStage } from 'mongoose'

export function fileLookup(fieldName: string): PipelineStage.Lookup {
  const lookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'files',
      localField: fieldName,
      foreignField: '_id',
      as: fieldName,
    },
  }
  return lookup
}

export function filePipelineStage(fieldName: string) {
  const path = `$${fieldName}`

  const lookup = fileLookup(fieldName)
  const unwind: PipelineStage.Unwind = {
    $unwind: {
      path,
      preserveNullAndEmptyArrays: true,
    },
  }

  return [lookup, unwind]
}
