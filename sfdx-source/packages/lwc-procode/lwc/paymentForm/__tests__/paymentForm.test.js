import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';
import { publish } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import { PAYMENT_FLOW_MESSAGE_TYPES } from 'cpm/paymentFlowChannel';
import { PAYMENT_METHOD_CONFIG } from '../paymentMethodConfiguration';
import EC_LABEL_FIRST_NAME from '@salesforce/label/c.ec_label_first_name';
import EC_LABEL_LAST_NAME from '@salesforce/label/c.ec_label_last_name';
import EC_LABEL_EMAIL_ADDRESS from '@salesforce/label/c.ec_label_email_address';

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function setField(element, field, value) {
    element.shadowRoot.querySelector(`lightning-input[data-field="${field}"]`).dispatchEvent(
        new CustomEvent('change', { detail: { value } })
    );
}

function selectMethod(element, { name, processor, target = 'Stripe-Main', recurringRequiresInitialPayment }) {
    element.shadowRoot.querySelector('c-payment-selector').dispatchEvent(
        new CustomEvent('paymentmethodchanged', {
            detail: { name, processor, target, recurringRequiresInitialPayment },
            bubbles: true,
            composed: true
        })
    );
}


afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('paymentForm', () => {
    describe('rendering', () => {
        it('renders the read-only summary, contact inputs, selector and pay button', () => {
            const element = createComponent({ amount: 25 });
            expect(element.shadowRoot.querySelector('.payment-summary')).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(3);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });

        it('does not render an amount input or a frequency toggle', () => {
            const element = createComponent({ amount: 25 });
            expect(element.shadowRoot.querySelector('.slds-input')).toBeNull();
            expect(element.shadowRoot.querySelector('.frequency-toggle')).toBeNull();
        });
    });

    describe('config validation', () => {
        // Structural problems (empty array, missing paymentProcessor/paymentMethod) are logged to the
        // console for the admin and gate rendering — no payer-facing error is shown. There is also no
        // way to pay: the Pay Button stays disabled until a method is selected.
        let original;
        let errorSpy;
        beforeEach(() => {
            original = [...PAYMENT_METHOD_CONFIG];
            errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });
        afterEach(() => {
            PAYMENT_METHOD_CONFIG.splice(0, PAYMENT_METHOD_CONFIG.length, ...original);
            errorSpy.mockRestore();
        });

        it('shows the unavailable message instead of the selector and logs when the config is empty', () => {
            PAYMENT_METHOD_CONFIG.length = 0;
            const element = createComponent({ amount: 25 });
            // Form still renders, but the selector is replaced by the packaged unavailable message.
            expect(element.shadowRoot.querySelector('.slds-card')).not.toBeNull();
            expect(element.shadowRoot.querySelector('c-payment-selector')).toBeNull();
            expect(element.shadowRoot.querySelector('.error-message')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button').disabled).toBe(true);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('shows the unavailable message and logs when an entry is missing a required field', () => {
            PAYMENT_METHOD_CONFIG.splice(0, PAYMENT_METHOD_CONFIG.length, {
                paymentProcessor: 'PaymentHub-Stripe' // paymentMethod missing
            });
            const element = createComponent({ amount: 25 });
            expect(element.shadowRoot.querySelector('c-payment-selector')).toBeNull();
            expect(element.shadowRoot.querySelector('.error-message')).not.toBeNull();
            expect(errorSpy).toHaveBeenCalled();
        });

        it('keeps the Pay Button disabled until a method is selected (valid config)', () => {
            const element = createComponent({ amount: 25 });
            setField(element, 'firstName', 'Jane');
            setField(element, 'lastName', 'Doe');
            setField(element, 'email', 'jane@example.com');
            // No method selected (e.g. the selector errored) → button must stay disabled.
            expect(element.shadowRoot.querySelector('cpm-pay-button').disabled).toBe(true);
        });
    });

    describe('currency', () => {
        it('renders the currency picker', () => {
            const element = createComponent({ amount: 25, allowedCurrencies: 'EUR,USD' });
            expect(element.shadowRoot.querySelector('c-currency-picker')).not.toBeNull();
        });

        it('reformats the amount and updates the intent when the payer changes currency', async () => {
            const element = createComponent({ amount: 1000, defaultCurrency: 'EUR', allowedCurrencies: 'EUR,USD' });
            await Promise.resolve();
            element.shadowRoot.querySelector('c-currency-picker').dispatchEvent(
                new CustomEvent('currencychange', { detail: { currency: 'USD' } })
            );
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
            expect(element.shadowRoot.querySelector('.payment-summary__amount').textContent).toContain('$');
        });

        it('blocks payment when the picker resolves to no currency (default inactive or not offered)', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const element = createComponent({ amount: 1000, defaultCurrency: 'EUR' });
            await Promise.resolve();
            // Picker offered nothing (default not active in the org, or excluded by allowedCurrencies).
            element.shadowRoot.querySelector('c-currency-picker').dispatchEvent(
                new CustomEvent('currencychange', { detail: { currency: '' } })
            );
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.disabled).toBe(true);
            expect(payBtn.paymentIntent.OneTime.CurrencyISOCode).toBe('');
            errorSpy.mockRestore();
        });
    });

    // The picker is optional: an admin who always charges one currency can remove <c-currency-picker>
    // from the template, and the form then uses the defaultCurrency design property directly. With no
    // picker there is no currencychange event, so these cases assert the pre-report fallback behavior.
    describe('currency without a picker (removed by admin)', () => {
        let errorSpy;
        beforeEach(() => {
            errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });
        afterEach(() => errorSpy.mockRestore());

        it('uses the default currency for the intent, normalized to upper case', () => {
            const element = createComponent({ amount: 1000, defaultCurrency: 'usd' });
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
        });

        it('blocks payment when the default currency is not a valid ISO code', () => {
            const element = createComponent({ amount: 1000, defaultCurrency: 'Euro' });
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.disabled).toBe(true);
            expect(payBtn.paymentIntent.OneTime.CurrencyISOCode).toBe('');
        });

        it('blocks payment and logs when the amount is not a positive number', () => {
            const element = createComponent({ amount: '0', defaultCurrency: 'EUR' });
            expect(element.shadowRoot.querySelector('cpm-pay-button').disabled).toBe(true);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('blocks payment and logs when the amount is not a plain number', () => {
            const element = createComponent({ amount: '1eee454.25', defaultCurrency: 'EUR' });
            expect(element.shadowRoot.querySelector('cpm-pay-button').disabled).toBe(true);
            expect(errorSpy).toHaveBeenCalled();
        });
    });

    describe('admin-configured amount and frequency (read-only)', () => {
        it('shows the admin amount, currency-formatted', () => {
            const element = createComponent({ amount: 1000, defaultCurrency: 'USD' });
            const amount = element.shadowRoot.querySelector('.payment-summary__amount').textContent;
            expect(amount).toContain('1,000');
            expect(amount).toContain('$');
        });

        it('renders a frequency label the payer cannot change', () => {
            const element = createComponent({ amount: 10, defaultFrequency: 'Monthly' });
            expect(element.shadowRoot.querySelector('.payment-summary__frequency').textContent.trim()).not.toBe('');
        });

        it('passes the one-time amount and currency to the pay button so it shows "Pay <amount>"', () => {
            const element = createComponent({ amount: 50, defaultCurrency: 'USD', defaultFrequency: 'One time' });
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.amountOneTime).toBe(50);
            expect(payBtn.currencyOneTime).toBe('USD');
            expect(payBtn.amountRecurring).toBeNull();
        });

        it('passes the recurring amount and currency to the pay button', () => {
            const element = createComponent({ amount: 50, defaultCurrency: 'USD', defaultFrequency: 'Monthly' });
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.amountRecurring).toBe(50);
            expect(payBtn.currencyRecurring).toBe('USD');
            expect(payBtn.amountOneTime).toBeNull();
        });
    });

    describe('payment intent context', () => {
        it('builds the intent from the configured amount as soon as it renders', async () => {
            const element = createComponent({ amount: 50, defaultFrequency: 'One time' });
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.OneTime.Amount).toBe('50');
        });

        it('includes the payer contact fields as they are entered', async () => {
            const element = createComponent({ amount: 50 });
            setField(element, 'firstName', 'Jane');
            setField(element, 'lastName', 'Doe');
            setField(element, 'email', 'jane@example.com');
            await Promise.resolve();
            const contact = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.Payer.Contact.SalesforceFields;
            expect(contact.FirstName).toBe('Jane');
            expect(contact.LastName).toBe('Doe');
            expect(contact.Email).toBe('jane@example.com');
        });

        it('uses the OneTime block when the admin frequency is one-time', async () => {
            const element = createComponent({ amount: 50, defaultFrequency: 'One time' });
            await Promise.resolve();
            const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
            expect(intent.OneTime.Amount).toBe('50');
            expect(intent.Recurring).toBeUndefined();
        });

        it('uses the Recurring block (Monthly, starting today) when the admin frequency is recurring', async () => {
            // Add a recurring-enabled method so the selector/pay button render on the recurring tab.
            PAYMENT_METHOD_CONFIG.push({
                paymentProcessor: 'Test-Processor', paymentMethod: 'RecurringCard',
                enabledRecurring: true
            });
            try {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                const today = new Date();
                const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                expect(intent.Recurring.Amount).toBe('15');
                expect(intent.Recurring.Frequency).toBe('Monthly');
                expect(intent.Recurring.StartDate).toBe(expected);
                expect(intent.OneTime).toBeUndefined();
            } finally {
                PAYMENT_METHOD_CONFIG.pop();
            }
        });

        // A OneTime block is added for recurring only when the selected method's
        // recurringRequiresInitialPayment (from the selector's change event) is true.
        describe('initial payment on recurring', () => {
            let original;
            beforeEach(() => {
                original = [...PAYMENT_METHOD_CONFIG];
                PAYMENT_METHOD_CONFIG.push(
                    { paymentProcessor: 'Test', paymentMethod: 'RequiresInitialCard', enabledOneTime: true, enabledRecurring: true },
                    { paymentProcessor: 'Test', paymentMethod: 'MandateOnlyCard', enabledOneTime: true, enabledRecurring: true }
                );
            });
            afterEach(() => {
                PAYMENT_METHOD_CONFIG.splice(0, PAYMENT_METHOD_CONFIG.length, ...original);
            });

            it('adds a OneTime initial payment when recurringRequiresInitialPayment is true', async () => {
                const element = createComponent({ amount: 15, defaultCurrency: 'EUR', defaultFrequency: 'Monthly' });
                await Promise.resolve();
                selectMethod(element, { name: 'RequiresInitialCard', processor: 'Test', recurringRequiresInitialPayment: true });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.Recurring.Amount).toBe('15');
                // Same amount/currency as the recurring schedule.
                expect(intent.OneTime).toEqual({ Amount: '15', CurrencyISOCode: 'EUR' });
            });

            it('omits the OneTime block when recurringRequiresInitialPayment is false (mandate only)', async () => {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
                await Promise.resolve();
                selectMethod(element, { name: 'MandateOnlyCard', processor: 'Test', recurringRequiresInitialPayment: false });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.OneTime).toBeUndefined();
            });

            it('omits the OneTime block when the selector does not report recurringRequiresInitialPayment', async () => {
                // Defensive: if the flag is absent (e.g. the live source was unavailable), the form
                // must treat it as "not required" and set up the mandate only — never coerce a
                // missing/loose value into adding an initial payment.
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
                await Promise.resolve();
                selectMethod(element, { name: 'MandateOnlyCard', processor: 'Test' }); // recurringRequiresInitialPayment omitted
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.OneTime).toBeUndefined();
            });

            it('does not add a OneTime block for a one-time payment (initial-payment logic is recurring-only)', async () => {
                const element = createComponent({ amount: 15, defaultCurrency: 'EUR', defaultFrequency: 'One time' });
                await Promise.resolve();
                selectMethod(element, { name: 'RequiresInitialCard', processor: 'Test', recurringRequiresInitialPayment: true });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.OneTime).toEqual({ Amount: '15', CurrencyISOCode: 'EUR' });
                expect(intent.Recurring).toBeUndefined();
            });
        });

        it('passes the configured currency to the intent', async () => {
            const element = createComponent({ amount: 10, defaultCurrency: 'USD', defaultFrequency: 'One time' });
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
        });
    });

    describe('accessibility structure', () => {
        it('groups the contact and payment-method sections in fieldsets with visible legends', () => {
            const element = createComponent({ amount: 25 });
            const legends = element.shadowRoot.querySelectorAll('fieldset > legend.section-header');
            expect(element.shadowRoot.querySelectorAll('fieldset')).toHaveLength(2);
            expect(legends).toHaveLength(2);
        });
    });

    describe('label rendering', () => {
        it('renders First Name label on the first input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="firstName"]').label).toBe(EC_LABEL_FIRST_NAME);
        });

        it('renders Last Name label on the second input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="lastName"]').label).toBe(EC_LABEL_LAST_NAME);
        });

        it('renders Email Address label on the email input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="email"]').label).toBe(EC_LABEL_EMAIL_ADDRESS);
        });
    });

    // The Pay Button publishes payment errors on the findockPaymentFlow channel; the form
    // re-surfaces them as events (extension point) without rendering its own banner.
    describe('payment error propagation (extension point)', () => {
        function publishError(body) {
            publish(undefined, FINDOCK_PAYMENT_FLOW, { type: PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR, body });
            return Promise.resolve();
        }

        it('re-dispatches a paymenterror event carrying the error detail', async () => {
            const element = createComponent();
            const handler = jest.fn();
            element.addEventListener('paymenterror', handler);
            await publishError({ statusCode: 422, errorMessage: 'boom' });
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail).toEqual({ statusCode: 422, errorMessage: 'boom' });
        });

        it('does not render an error banner of its own (the Pay Button shows the message)', async () => {
            const element = createComponent();
            await publishError({ statusCode: 422, errorMessage: 'boom' });
            expect(element.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('dispatches paymentpending when a new attempt starts', async () => {
            const element = createComponent();
            const handler = jest.fn();
            element.addEventListener('paymentpending', handler);
            publish(undefined, FINDOCK_PAYMENT_FLOW, {
                type: PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_PENDING,
                body: { isPending: true }
            });
            await Promise.resolve();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

});
