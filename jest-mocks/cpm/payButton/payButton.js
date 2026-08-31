import { LightningElement, api } from 'lwc';

export default class PayButton extends LightningElement {
    @api paymentIntent;
    @api disabled;
    @api paymentGroupId;
    // Display inputs the real button uses to render its "Pay <amount>" label.
    @api amountOneTime;
    @api currencyOneTime;
    @api amountRecurring;
    @api currencyRecurring;
}
