import { LightningElement, api } from 'lwc';

export default class PaymentMethodSelector extends LightningElement {
    @api paymentMethodConfig;
    @api frequency;
    @api paymentIntentResponse;
    @api paymentGroupId;
}
