import { GraphQLError } from "graphql";
import { get, map } from "lodash";
import { ValidationError } from "yup";

const YUP_VALIDATION_ERROR = 'YUP_VALIDATION_ERROR'

type ErrorTypes = | 'required' | 'min' | 'max' | 'maxLength' | 'minLength' | 'validate' | 'value' | 'setValueAs' | 'shouldUnregister' | 'onChange' | 'onBlur' | 'disabled' | 'deps'

interface ErrorOption {
    path: string
    message: string
    type: ErrorTypes
}

export const yupValidationThrow = (errors: ValidationError): GraphQLError => {
    const result = map<ValidationError, ErrorOption>(errors.inner, (error: ValidationError) => {
        return {
            path: error.path,
            message: get(error, 'errors.0', ''),
            type: 'validate',
        }
    })

    return new GraphQLError(
        errors.message,
        {
            extensions: {
                code: YUP_VALIDATION_ERROR,
                errors: result
            },
        }
    );
}