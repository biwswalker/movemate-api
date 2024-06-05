import { includes, isEmpty } from 'lodash'
import * as Yup from 'yup'

declare module 'yup' {
    interface MixedSchema {
        maxFileSize(size: number, message: string): Yup.MixedSchema
        fileFormat(format: string[], message: string): Yup.MixedSchema
    }
}

Yup.MixedSchema.prototype.maxFileSize = function (
    size: number,
    message: string,
) {
    return this.test('maxFileSize', message, (file: any) => {
        if (file && !isEmpty(file.size)) {
            return file.size <= size
        }
        return true
    })
}

Yup.MixedSchema.prototype.fileFormat = function (
    formats: string[],
    message: string,
) {
    return this.test('fileFormat', message, (file: any) => {
        if (file && !isEmpty(file.type)) {
            return includes(formats, file.type)
        }
        return true
    })
}

export default Yup
