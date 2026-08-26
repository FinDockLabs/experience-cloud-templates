/**
 * Jest stub for lightning/flowSupport. The default @salesforce/sfdx-lwc-jest
 * package does not ship a stub for this module, so we provide a minimal one
 * that mirrors the events used by the Flow screen components.
 */
export class FlowAttributeChangeEvent extends CustomEvent {
    constructor(attributeName, attributeValue) {
        super('flowattributechange', {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: { attributeName, attributeValue }
        });
    }
}

export class FlowNavigationNextEvent extends CustomEvent {
    constructor() {
        super('flownavigationnext', { composed: true, cancelable: true, bubbles: true });
    }
}

export class FlowNavigationBackEvent extends CustomEvent {
    constructor() {
        super('flownavigationback', { composed: true, cancelable: true, bubbles: true });
    }
}