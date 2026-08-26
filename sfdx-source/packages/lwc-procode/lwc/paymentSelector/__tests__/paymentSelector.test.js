import { createElement } from 'lwc';
import PaymentSelector from 'c/paymentSelector';
const MOCK_CONFIG = [
    {
        paymentProcessor: 'PaymentHub-Stripe',
        paymentMethod: 'CreditCard',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: true,
        isDefaultOneTime: true,
        isDefaultRecurring: false,
        displayLabel: 'Credit Card',
        parameters: [
            {
                name: 'locale',
                value: 'nl-NL',
                visibleToCustomer: false,
                description: 'Locale string'
            }
        ]
    },
    {
        paymentProcessor: 'PaymentHub-Stripe',
        paymentMethod: 'Ideal',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: false,
        isDefaultOneTime: false,
        isDefaultRecurring: false,
        displayLabel: 'iDEAL | Wero',
        redirectInstruction: 'You will be redirected to your bank.'
    }
];

function createComponent(props = {}) {
    const element = createElement('c-payment-selector', { is: PaymentSelector });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function getSelector(element) {
    return element.shadowRoot.querySelector('cpm-payment-method-selector');
}

function getForwardedConfig(element) {
    const value = getSelector(element).paymentMethodConfig;
    return value ? JSON.parse(value) : null;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('paymentSelector', () => {
    describe('config forwarding', () => {
        it('forwards the config as a JSON string', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            expect(getForwardedConfig(element)).toHaveLength(2);
        });

        it('forwards the raw admin fields unchanged (no enrichment here)', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getForwardedConfig(element);
            expect(first.paymentProcessor).toBe('PaymentHub-Stripe');
            expect(first.paymentMethod).toBe('CreditCard');
            expect(first.target).toBe('Stripe-Main-Account');
            // The adapter does not derive key/name/processor — that is the managed selector's job.
            expect(first.key).toBeUndefined();
            expect(first.name).toBeUndefined();
            expect(first.processor).toBeUndefined();
        });

        it('accepts config already provided as a JSON string and passes it through verbatim', () => {
            const json = JSON.stringify(MOCK_CONFIG);
            const element = createComponent({ config: json });
            expect(getSelector(element).paymentMethodConfig).toBe(json);
        });

        it('forwards an empty array as "[]" (not null) so the managed selector renders no methods', () => {
            const element = createComponent({ config: [] });
            expect(getSelector(element).paymentMethodConfig).toBe('[]');
        });

        it('stringifies a non-array config object as-is (adapter is format-agnostic)', () => {
            const legacy = { oneTime: [], recurring: [] };
            const element = createComponent({ config: legacy });
            expect(JSON.parse(getSelector(element).paymentMethodConfig)).toEqual(legacy);
        });

        it('exposes the assigned config via its public getter', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            expect(element.config).toEqual(MOCK_CONFIG);
        });

        it('re-forwards the updated config when it changes after render', async () => {
            const element = createComponent({ config: MOCK_CONFIG });
            expect(getForwardedConfig(element)).toHaveLength(2);

            element.config = [MOCK_CONFIG[0]];
            await Promise.resolve();

            const forwarded = getForwardedConfig(element);
            expect(forwarded).toHaveLength(1);
            expect(forwarded[0].paymentMethod).toBe('CreditCard');
        });
    });

    describe('frequency normalization', () => {
        it('lowercases the frequency value', () => {
            const element = createComponent({ config: MOCK_CONFIG, frequency: 'Recurring' });
            expect(getSelector(element).frequency).toBe('recurring');
        });

        it('defaults to onetime when frequency is not set', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            expect(getSelector(element).frequency).toBe('onetime');
        });

        it('defaults to onetime when frequency is explicitly null', () => {
            const element = createComponent({ config: MOCK_CONFIG, frequency: null });
            expect(getSelector(element).frequency).toBe('onetime');
        });

        it('leaves an already-lowercase frequency unchanged', () => {
            const element = createComponent({ config: MOCK_CONFIG, frequency: 'recurring' });
            expect(getSelector(element).frequency).toBe('recurring');
        });
    });

    describe('edge cases', () => {
        it('forwards null config when config is not set', () => {
            const element = createComponent();
            expect(getSelector(element).paymentMethodConfig).toBeNull();
        });

        it('forwards the paymentGroupId through to the managed selector', () => {
            const element = createComponent({ config: MOCK_CONFIG, paymentGroupId: 'pf-1' });
            expect(getSelector(element).paymentGroupId).toBe('pf-1');
        });
    });

    describe('event handling', () => {
        it('re-emits paymentmethodchanged from the managed selector', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const handler = jest.fn();
            element.addEventListener('paymentmethodchanged', handler);

            getSelector(element).dispatchEvent(
                new CustomEvent('paymentmethodchanged', {
                    detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe', recurringRequiresInitialPayment: true },
                    bubbles: true,
                    composed: true
                })
            );

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail).toEqual({
                name: 'CreditCard',
                processor: 'PaymentHub-Stripe',
                recurringRequiresInitialPayment: true
            });
        });

        it('re-emits a bubbling, composed event so it crosses the shadow boundary', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const handler = jest.fn();
            element.addEventListener('paymentmethodchanged', handler);

            getSelector(element).dispatchEvent(
                new CustomEvent('paymentmethodchanged', {
                    detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe' },
                    bubbles: true,
                    composed: true
                })
            );

            const reEmitted = handler.mock.calls[0][0];
            expect(reEmitted.bubbles).toBe(true);
            expect(reEmitted.composed).toBe(true);
        });

        it('does not double-dispatch: the original child event is stopped and only the re-emitted one bubbles up', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const ancestorHandler = jest.fn();
            // Listen on an ancestor: without stopPropagation the child's own composed event would
            // also reach here, producing two calls.
            document.body.addEventListener('paymentmethodchanged', ancestorHandler);

            getSelector(element).dispatchEvent(
                new CustomEvent('paymentmethodchanged', {
                    detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe' },
                    bubbles: true,
                    composed: true
                })
            );

            expect(ancestorHandler).toHaveBeenCalledTimes(1);
            document.body.removeEventListener('paymentmethodchanged', ancestorHandler);
        });
    });
});
