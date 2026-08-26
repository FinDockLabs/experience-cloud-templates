// Jest mock for the cpm managed-package module `cpm/paymentMethodValidators`.
// Mirrors the real code->field mapping so consumer component tests behave realistically.

const FIELD_MAPPABLE_CODES = ['201', '202', '203', '204', '206'];

function responseHasFieldLevelError(code) {
    return FIELD_MAPPABLE_CODES.includes(code);
}

function fieldErrorsForCode(code, message) {
    // Minimal stand-in; consumer tests only rely on the has-field-level check.
    return responseHasFieldLevelError(code) ? { field: message ?? '' } : {};
}

export { responseHasFieldLevelError, fieldErrorsForCode };
