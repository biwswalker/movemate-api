import { PipelineStage } from 'mongoose'
import { userPipelineStage } from './user.pipeline'

export function billingDocumentLookup(fieldName: string): PipelineStage.Lookup {
  const lookup: PipelineStage.Lookup = {
    $lookup: {
      from: 'billingdocuments',
      localField: fieldName,
      foreignField: '_id',
      as: fieldName,
      pipeline: userPipelineStage('updatedBy'),
    },
  }
  return lookup
}

export function billingDocumentPipelineStage(fieldName: string) {
  const path = `$${fieldName}`

  const lookup = billingDocumentLookup(fieldName)
  const unwind: PipelineStage.Unwind = {
    $unwind: {
      path,
      preserveNullAndEmptyArrays: true,
    },
  }

  return [lookup, unwind]
}
