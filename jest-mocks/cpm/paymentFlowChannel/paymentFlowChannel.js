// Jest mock for the cpm managed-package module `cpm/paymentFlowChannel`.
// Mirrors the real contract closely enough for consumer component tests.

const PAYMENT_FLOW_MESSAGE_TYPES = Object.freeze({
    PAYMENT_METHOD_VALIDITY: 'paymentMethodValidity',
    PAYMENT_PENDING: 'paymentPending',
    PAYMENT_ERROR: 'paymentError'
});

function matchesGroup(subscriberGroupId, message) {
    const messageGroupId = message?.body?.groupId;
    if (subscriberGroupId == null || messageGroupId == null) {
        return true;
    }
    return subscriberGroupId === messageGroupId;
}

function publishPaymentFlowMessage(messageContext, type, body, groupId) {
    // eslint-disable-next-line no-undef
    return { messageContext, type, body: groupId == null ? body : { ...body, groupId } };
}

function publishPaymentError(messageContext, result, groupId) {
    return {
        statusCode: result?.statusCode,
        errorCode: result?.errorCode,
        errorMessage: result?.errorMessage,
        errorLabel: result?.errorLabel
    };
}

export { PAYMENT_FLOW_MESSAGE_TYPES, matchesGroup, publishPaymentFlowMessage, publishPaymentError };
