import { LightningElement, api } from 'lwc';

export default class PaymentSelector extends LightningElement {
    @api frequency = 'onetime';
    @api paymentGroupId;

    @api
    get config() {
        return this._config;
    }
    set config(value) {
        this._config = value;
    }

    _config;

    get configString() {
        if (this._config == null) {
            return null;
        }
        return typeof this._config === 'string' ? this._config : JSON.stringify(this._config);
    }

    get normalizedFrequency() {
        return (this.frequency ?? 'onetime').toLowerCase();
    }

    handlePaymentMethodChanged(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('paymentmethodchanged', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
}
