import { PaginationArgs } from '@inputs/query.input'
import { isArray, reduce } from 'lodash'
import { PaginateOptions } from 'mongoose'

export function reformPaginate({ sortField, sortAscending, ...paginate }: PaginationArgs): PaginateOptions {
  const pagination: PaginateOptions = {
    ...paginate,
    ...(isArray(sortField)
      ? {
          sort: reduce(
            sortField,
            function (result, value) {
              if (value) {
                return { ...result, [value]: sortAscending ? 1 : -1 }
              }
              return result
            },
            {},
          ),
        }
      : {}),
  }

  return pagination
}
