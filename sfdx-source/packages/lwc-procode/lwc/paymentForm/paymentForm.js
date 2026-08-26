import { api, wire, LightningElement, track } from "lwc";
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';

import { currencyLocale, normalizeCurrency } from 'c/currencyUtils';
import { PAYMENT_FLOW_MESSAGE_TYPES, matchesGroup } from 'cpm/paymentFlowChannel';
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";

// Distinguishes multiple forms on one page (used as the channel correlation key).
let _nextInstanceId = 0;

// Only cadence supported today. Revisit as an @api property if other cadences are needed.
const RECURRING_FREQUENCY = 'Monthly';

// Maps the friendly App/Experience Builder "Default Frequency" values to internal codes.
// Falls back to the raw value so 'oneTime'/'recurring' still work if set programmatically.
const FREQUENCY_ALIASES = {
    'one time': 'oneTime',
    'monthly': 'recurring'
};

function normalizeFrequency(value) {
    if (!value) return 'oneTime';
    return FREQUENCY_ALIASES[value.toLowerCase()] ?? value;
}

function todayISODate() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

export default class PaymentForm extends LightningElement {
    @api defaultCurrency = 'EUR';
    // Amount in dot-decimal form (e.g. '10.50'), never a locale format like '10,50'.
    @api amount = '10.50';
    @api defaultFrequency = 'oneTime';
    // CSV of offered currencies (e.g. 'EUR,USD'); empty auto-detects the org's active currencies.
    @api allowedCurrencies = '';

    @track firstName = '';
    // Currency the payer picked in the currencyPicker; empty until they choose.
    @track _selectedCurrency = '';
    // True once the currencyPicker has reported, so '' is treated as "no currency", not "not yet".
    @track _currencyResolved = false;
    @track lastName = '';
    @track email = '';
    @track selectedPaymentMethod = null;
    @track paymentIntent = {};
    @track paymentError = null;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;
    _instanceId = ++_nextInstanceId;
    _subscription = null;
    // Structural validity of the shipped config; set once on connect (see _validateConfig).
    _configValid = true;

    // Per-instance key so two forms on a page don't cross-react on the channel.
    get paymentGroupId() {
        return `pf-${this._instanceId}`;
    }

    get frequency() {
        return normalizeFrequency(this.defaultFrequency);
    }

    get isRecurring() {
        return this.frequency === 'recurring';
    }

    get recurringStartDate() {
        return todayISODate();
    }

    get includeInitialPayment() {
        return this.isRecurring
            && this.selectedPaymentMethod?.recurringRequiresInitialPayment === true;
    }

    // Currency for display and the payment intent, normalized to a valid ISO 4217 code or ''.
    // Uses the currencyPicker's choice once it reports, else defaultCurrency. '' blocks payment.
    get activeCurrency() {
        const source = this._currencyResolved ? this._selectedCurrency : this.defaultCurrency;
        return normalizeCurrency(source);
    }

    // Single numeric reading of the admin-set amount, used for both display and validation.
    // NaN when the property is empty or not a plain number.
    get _amountNumber() {
        return this.amount == null || this.amount === '' ? NaN : Number(this.amount);
    }

    get formattedAmount() {
        if (Number.isNaN(this._amountNumber)) {
            return this.amount ? `${this.amount} ${this.activeCurrency}` : '';
        }
        try {
            return new Intl.NumberFormat(currencyLocale(), { style: 'currency', currency: this.activeCurrency }).format(this._amountNumber);
        } catch {
            return `${this.amount} ${this.activeCurrency}`;
        }
    }

    get frequencyLabel() {
        return this.isRecurring
            ? this.labels.ec_label_frequency_recurring
            : this.labels.ec_label_frequency_one_time;
    }

    // Route the amount into the pay button's one-time or recurring slot so it renders "Pay <amount>".
    // Display only — payment runs from paymentIntent.
    get displayAmountOneTime() {
        return this.isRecurring ? null : this.amount;
    }

    get displayAmountRecurring() {
        return this.isRecurring ? this.amount : null;
    }

    get isConfigValid() {
        return this._configValid;
    }

    get _hasValidAmount() {
        return this._amountNumber > 0;
    }

    // activeCurrency is '' only on a misconfiguration the payer cannot fix (invalid, inactive, or not
    // offered), so an empty value blocks payment.
    get _hasValidCurrency() {
        return Boolean(this.activeCurrency);
    }

    get isPayButtonDisabled() {
        const inputs = this.template.querySelectorAll('lightning-input');
        const allInputsValid = [...inputs].every(input => input.checkValidity());
        return !(
            this.firstName &&
            this.lastName &&
            this.email &&
            this._hasValidAmount &&
            this._hasValidCurrency &&
            this.selectedPaymentMethod &&
            allInputsValid
        );
    }

    connectedCallback() {
        this.subscribeToPaymentFlow();
        this._validateConfig();
        this._updatePaymentIntentContext();
    }

    disconnectedCallback() {
        unsubscribe(this._subscription);
        this._subscription = null;
    }

    @wire(MessageContext)
    messageContext;

    subscribeToPaymentFlow() {
        this._subscription = subscribe(
            this.messageContext,
            FINDOCK_PAYMENT_FLOW,
            (message) => this.handlePaymentFlowMessage(message)
        );
    }

    _validateConfig() {
        const config = PAYMENT_METHOD_CONFIG;
        const problems = [];

        if (!Array.isArray(config)) {
            problems.push('PAYMENT_METHOD_CONFIG must be an array.');
        } else if (config.length === 0) {
            problems.push('No payment methods are configured.');
        } else {
            config.forEach((entry, i) => {
                for (const field of ['paymentProcessor', 'paymentMethod']) {
                    if (!entry?.[field]) {
                        problems.push(`Entry #${i} is missing required field "${field}".`);
                    }
                }
            });
        }

        // Only the payment-method config gates the selector UI (isConfigValid); amount and currency
        // problems block payment instead (isPayButtonDisabled), so they are logged but do not hide it.
        this._configValid = problems.length === 0;

        if (!this._configValid) {
            // eslint-disable-next-line no-console
            console.error('Invalid paymentMethodConfiguration.js:\n- ' + problems.join('\n- '));
        }

        this._warnIfAmountMisconfigured();
    }

    _warnIfAmountMisconfigured() {
        if (!this._hasValidAmount) {
            // eslint-disable-next-line no-console
            console.error(`Amount "${this.amount}" must be a number greater than zero.`);
        }
    }

    _updatePaymentIntentContext() {
        const amount = this.amount != null ? String(this.amount) : '';
        const oneTimeBlock = { Amount: amount, CurrencyISOCode: this.activeCurrency };

        let scheduleBlocks;
        if (this.isRecurring) {
            scheduleBlocks = {
                Recurring: {
                    Amount: amount,
                    CurrencyISOCode: this.activeCurrency,
                    Frequency: RECURRING_FREQUENCY,
                    StartDate: this.recurringStartDate
                }
            };
            if (this.includeInitialPayment) {
                scheduleBlocks.OneTime = oneTimeBlock;
            }
        } else {
            scheduleBlocks = { OneTime: oneTimeBlock };
        }

        this.paymentIntent = {
            SuccessURL: 'https://example.com/success',
            FailureURL: 'https://example.com/failure',
            Payer: {
                Contact: {
                    SalesforceFields: {
                        FirstName: this.firstName,
                        LastName: this.lastName,
                        Email: this.email,
                    }
                }
            },
            ...scheduleBlocks,
            PaymentMethod: {
                Name: this.selectedPaymentMethod?.name,
                Processor: this.selectedPaymentMethod?.processor,
                Target: this.selectedPaymentMethod?.target
            }
        };
    }

    // Extension point: forwards Pay Button events (findockPaymentFlow channel) to parents as
    // paymenterror/paymentpending. Renders no banner itself, to avoid a duplicate error message.
    handlePaymentFlowMessage(message) {
        if (!matchesGroup(this.paymentGroupId, message)) {
            return;
        }
        if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR) {
            this.paymentError = message.body;
            this.dispatchEvent(new CustomEvent('paymenterror', { detail: message.body }));
        } else if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_PENDING
                && message.body?.isPending === true) {
            this.paymentError = null;
            this.dispatchEvent(new CustomEvent('paymentpending'));
        }
    }

    handleFieldChange(event) {
        this[event.target.dataset.field] = event.detail.value;
        this._updatePaymentIntentContext();
    }

    handlePaymentMethodChanged(event) {
        this.selectedPaymentMethod = event.detail;
        this._updatePaymentIntentContext();
    }

    handleCurrencyChange(event) {
        this._selectedCurrency = event.detail.currency || '';
        this._currencyResolved = true;
        this._updatePaymentIntentContext();
    }
}
