import { createElement } from 'lwc';
import PaymentSelector from 'c/paymentSelector';

// toBeAccessible() is registered globally by jest.setup.a11y.js via @sa11y/jest setup().
// It runs axe-core with Salesforce preset rules covering WCAG 2.1 AA + WCAG 2.2 AA
// success criteria that can be verified automatically.

const MOCK_CONFIG = [
    {
        paymentMethod: 'CreditCard',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: true,
        isDefaultOneTime: true,
        isDefaultRecurring: false,
        displayLabel: 'Credit Card'
    },
    {
        paymentMethod: 'Ideal',
        paymentProcessor: 'PaymentHub-Stripe',
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

describe('c-payment-selector WCAG 2.2 AA accessibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    // ── 1. Default state — no config ──────────────────────────────────────────────
    // Covers: 4.1.2 Name, Role, Value
    // Without config the managed component receives a null payment-method-config.
    // The wrapper must not introduce any axe violations in this empty state.
    it('passes axe scan when no config is provided', async () => {
        const element = createComponent();
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 2. With full payment method config ────────────────────────────────────────
    // Covers: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value
    // Config is serialised and passed to the managed component. Our wrapper
    // must not introduce any additional axe violations.
    it('passes axe scan with a full payment method config', async () => {
        const element = createComponent({ config: MOCK_CONFIG, frequency: 'onetime' });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 3. Recurring frequency ────────────────────────────────────────────────────
    // Switching to recurring changes normalizedFrequency passed to the child.
    // The component structure must remain accessible with no ARIA violations.
    it('passes axe scan with frequency set to recurring', async () => {
        const element = createComponent({ config: MOCK_CONFIG, frequency: 'recurring' });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 4. Config as JSON string ──────────────────────────────────────────────────
    // paymentForm may pass a serialised string from a Flow variable. The enriched
    // output is identical — the wrapper must still produce no axe violations.
    it('passes axe scan when config is provided as a JSON string', async () => {
        const element = createComponent({ config: JSON.stringify(MOCK_CONFIG) });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 5. After paymentmethodchanged event ───────────────────────────────────────
    // Covers: 4.1.3 Status Messages
    // Dispatching a selection event must not alter the wrapper's DOM structure in a
    // way that introduces axe violations (event is re-emitted and DOM is unchanged).
    it('passes axe scan after a payment method is selected', async () => {
        const element = createComponent({ config: MOCK_CONFIG });
        await Promise.resolve();

        element.shadowRoot.querySelector('cpm-payment-method-selector').dispatchEvent(
            new CustomEvent('paymentmethodchanged', {
                detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe' },
                bubbles: true,
                composed: true
            })
        );
        await Promise.resolve();

        await expect(element).toBeAccessible();
    });
});
